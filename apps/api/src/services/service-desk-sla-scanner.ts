import type { PrismaClient } from '@prisma/client';
import { decryptSecret } from '../utils/integrations.js';
import { isWorkspaceEntitled, getServiceDeskTelegramIntegration } from '../utils/service-desk.js';

const DONE_STATUS_KEYS = new Set(['done', 'canceled']);

async function sendTelegram(botToken: string, chatId: string, text: string) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text }),
    });
}

export function startServiceDeskSlaScanner(prisma: PrismaClient, intervalMs = 5 * 60 * 1000) {
    setInterval(async () => {
        try {
            const rules = await prisma.boardSlaRule.findMany({
                select: {
                    listId: true,
                    slaHours: true,
                    list: {
                        select: {
                            name: true,
                            statusKey: true,
                            board: { select: { id: true, name: true, workspaceId: true, type: true } },
                        },
                    },
                },
            });
            if (rules.length === 0) return;

            const ruleMap = new Map(rules.map(r => [r.listId, r]));
            const listIds = Array.from(ruleMap.keys());

            const candidates = await prisma.card.findMany({
                where: {
                    listId: { in: listIds },
                    serviceDeskOverdueNotifiedAt: null,
                    list: {
                        statusKey: { notIn: Array.from(DONE_STATUS_KEYS) },
                        board: { type: 'service_desk' },
                    },
                },
                select: {
                    id: true,
                    title: true,
                    listId: true,
                    lastStatusChangedAt: true,
                },
            });

            if (candidates.length === 0) return;

            const entitlements = new Map<string, boolean>();
            const integrations = new Map<string, { botTokenEncrypted: string; chatId: string }>();

            for (const card of candidates) {
                const rule = ruleMap.get(card.listId);
                if (!rule) continue;
                const overdueAt = new Date(card.lastStatusChangedAt);
                overdueAt.setHours(overdueAt.getHours() + rule.slaHours);
                if (overdueAt > new Date()) continue;

                if (rule.list.board.type !== 'service_desk') continue;
                const boardId = rule.list.board.id;
                const workspaceId = rule.list.board.workspaceId;
                if (!entitlements.has(workspaceId)) {
                    entitlements.set(workspaceId, await isWorkspaceEntitled(prisma, workspaceId));
                }
                if (!entitlements.get(workspaceId)) continue;

                if (!integrations.has(boardId)) {
                    const integ = await getServiceDeskTelegramIntegration(prisma, boardId, workspaceId);
                    if (integ) integrations.set(boardId, integ);
                }
                const integration = integrations.get(boardId);
                if (!integration) continue;

                try {
                    const token = decryptSecret(integration.botTokenEncrypted);
                    const text = [
                        `Service Desk overdue`,
                        `Board: ${rule.list.board.name}`,
                        `List: ${rule.list.name}`,
                        `Card: ${card.title}`,
                    ].join('\n');
                    await sendTelegram(token, integration.chatId, text);
                    await prisma.card.update({
                        where: { id: card.id },
                        data: { serviceDeskOverdueNotifiedAt: new Date() },
                    });
                } catch (err) {
                    console.error('[ServiceDesk] Overdue telegram failed', err);
                }
            }
        } catch (err) {
            console.error('[ServiceDesk] SLA scan failed', err);
        }
    }, intervalMs);
}

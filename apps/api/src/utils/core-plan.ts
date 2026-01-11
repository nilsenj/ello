import type { PrismaClient } from '@prisma/client';

export type CorePlanKey = 'core_free' | 'core_team' | 'core_business';

export type CorePlanLimits = {
    maxBoards?: number;
    maxMembers?: number;
};

export type CorePlanDefinition = {
    key: CorePlanKey;
    name: string;
    limits: CorePlanLimits;
};

export const CORE_PLANS: Record<CorePlanKey, CorePlanDefinition> = {
    core_free: {
        key: 'core_free',
        name: 'Core Free',
        limits: {
            maxBoards: 3,
            maxMembers: 5,
        },
    },
    core_team: {
        key: 'core_team',
        name: 'Core Team',
        limits: {
            maxBoards: 10,
            maxMembers: 10,
        },
    },
    core_business: {
        key: 'core_business',
        name: 'Core Business',
        limits: {
            maxBoards: 50,
            maxMembers: 50,
        },
    },
};

export function resolveCorePlan(planKey?: string | null): CorePlanDefinition {
    if (!planKey) return CORE_PLANS.core_free;
    return CORE_PLANS[(planKey as CorePlanKey) || 'core_free'] ?? CORE_PLANS.core_free;
}

async function hasActiveModuleEntitlement(prisma: PrismaClient, workspaceId: string): Promise<boolean> {
    const client = prisma as PrismaClient & {
        workspaceEntitlement?: { findFirst: Function };
    };
    if (!client.workspaceEntitlement?.findFirst) return false;
    const now = new Date();
    const row = await prisma.workspaceEntitlement.findFirst({
        where: {
            workspaceId,
            status: 'active',
            OR: [{ validUntil: null }, { validUntil: { gt: now } }],
        },
        select: { id: true },
    });
    return !!row;
}

export async function getCorePlanLimits(prisma: PrismaClient, workspaceId: string): Promise<CorePlanLimits | null> {
    if (await hasActiveModuleEntitlement(prisma, workspaceId)) return null;
    const ws = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { planKey: true },
    });
    return resolveCorePlan(ws?.planKey).limits;
}

export async function countWorkspaceCollaborators(prisma: PrismaClient, workspaceId: string): Promise<number> {
    const [workspaceMembers, boardMembers] = await Promise.all([
        prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: { userId: true },
        }),
        prisma.boardMember.findMany({
            where: { board: { workspaceId } },
            select: { userId: true },
        }),
    ]);
    const unique = new Set<string>();
    for (const member of workspaceMembers) unique.add(member.userId);
    for (const member of boardMembers) unique.add(member.userId);
    return unique.size;
}

export async function enforceCorePlanBoardLimit(prisma: PrismaClient, workspaceId: string) {
    const limits = await getCorePlanLimits(prisma, workspaceId);
    if (!limits?.maxBoards) return;
    const boardCount = await prisma.board.count({
        where: { workspaceId, isArchived: false, type: 'generic' },
    });
    if (boardCount >= limits.maxBoards) {
        const err: any = new Error(`Plan limit reached: max ${limits.maxBoards} boards for this workspace.`);
        err.statusCode = 403;
        throw err;
    }
}

export async function enforceCorePlanMemberLimit(prisma: PrismaClient, workspaceId: string) {
    const limits = await getCorePlanLimits(prisma, workspaceId);
    if (!limits?.maxMembers) return;
    const memberCount = await countWorkspaceCollaborators(prisma, workspaceId);
    if (memberCount >= limits.maxMembers) {
        const err: any = new Error(`Plan limit reached: max ${limits.maxMembers} members for this workspace.`);
        err.statusCode = 403;
        throw err;
    }
}

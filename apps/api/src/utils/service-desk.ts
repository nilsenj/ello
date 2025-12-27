import type { PrismaClient } from '@prisma/client';

export const SERVICE_DESK_MODULE_KEY = 'service_desk';

export async function isWorkspaceEntitled(prisma: PrismaClient, workspaceId: string) {
    const client = prisma as PrismaClient & { workspaceEntitlement?: { findUnique: Function } };
    if (!client.workspaceEntitlement?.findUnique) return false;
    const now = new Date();
    const row = await client.workspaceEntitlement.findUnique({
        where: { workspaceId_moduleKey: { workspaceId, moduleKey: SERVICE_DESK_MODULE_KEY } },
        select: { status: true, validUntil: true },
    });
    if (!row) return false;
    if (row.status !== 'active') return false;
    if (row.validUntil && row.validUntil < now) return false;
    return true;
}

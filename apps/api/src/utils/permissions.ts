import { PrismaClient } from '@prisma/client';

export async function ensureBoardAccess(prisma: PrismaClient, boardId: string, userId: string): Promise<void> {
    const board = await prisma.board.findUnique({
        where: { id: boardId },
        select: { workspaceId: true, visibility: true }
    });

    if (!board) {
        const e: any = new Error('Board not found');
        e.statusCode = 404;
        throw e;
    }

    const [boardMember, workspaceMember] = await Promise.all([
        prisma.boardMember.findUnique({
            where: { userId_boardId: { userId, boardId } },
            select: { id: true }
        }),
        prisma.workspaceMember.findUnique({
            where: { userId_workspaceId: { userId, workspaceId: board.workspaceId } },
            select: { id: true, role: true }
        })
    ]);

    console.log(`[ensureBoardAccess] Board: ${boardId}, User: ${userId}`);
    console.log(`[ensureBoardAccess] Visibility: ${board.visibility}`);
    console.log(`[ensureBoardAccess] BoardMember: ${!!boardMember}, WorkspaceMember: ${!!workspaceMember} (${workspaceMember?.role})`);

    // 1. Public boards are accessible to everyone
    if (board.visibility === 'public') {
        return;
    }

    // 2. Workspace admins/owners always have access
    if (workspaceMember && (workspaceMember.role === 'owner' || workspaceMember.role === 'admin')) {
        return;
    }

    // 3. Workspace visible boards are accessible to all workspace members
    if (board.visibility === 'workspace') {
        if (workspaceMember || boardMember) {
            return;
        }
    }

    // 4. Private boards (or fallback) are accessible only to board members
    if (boardMember) {
        return;
    }

    console.log('[ensureBoardAccess] Access Denied');
    const e: any = new Error('Forbidden');
    e.statusCode = 403;
    throw e;
}

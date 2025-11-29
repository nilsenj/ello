
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const boardId = 'cmi8458uk0003p87yys7ec7o2';
    console.log(`Checking board: ${boardId}`);

    const board = await prisma.board.findUnique({
        where: { id: boardId },
        include: { members: true }
    });

    if (!board) {
        console.log('Board not found');
        return;
    }

    console.log('Board found:', board.name);
    console.log('Members:', board.members);

    const userId = 'cmi7s0fug0003p8p6ygvx2b49';
    const isMember = board.members.some(m => m.userId === userId);

    if (!isMember) {
        console.log(`User ${userId} is NOT a member. Adding now...`);
        await prisma.boardMember.create({
            data: {
                boardId,
                userId: userId,
                role: 'owner'
            }
        });
        console.log('Member added.');
    } else {
        console.log(`User ${userId} is already a member.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });

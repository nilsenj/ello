import {PrismaClient} from '@prisma/client';
import {mid} from "../rank.js";

const prisma = new PrismaClient();

async function backfillLists() {
    const boards = await prisma.board.findMany({select: {id: true}});
    for (const b of boards) {
        const lists = await prisma.list.findMany({
            where: {boardId: b.id}, orderBy: {position: 'asc'}, select: {id: true, rank: true}
        });
        let prev: string | undefined = undefined;
        for (const l of lists) {
            const r: string = l.rank && l.rank !== 'n' ? l.rank : mid(prev, undefined);
            await prisma.list.update({where: {id: l.id}, data: {rank: r}});
            prev = r;
        }
    }
}

async function backfillCards() {
    const lists = await prisma.list.findMany({select: {id: true}});
    for (const l of lists) {
        const cards = await prisma.card.findMany({
            where: {listId: l.id}, orderBy: {position: 'asc'}, select: {id: true, rank: true}
        });
        let prev: string | undefined = undefined;
        for (const c of cards) {
            const r: string = c.rank && c.rank !== 'n' ? c.rank : mid(prev, undefined);
            await prisma.card.update({where: {id: c.id}, data: {rank: r}});
            prev = r;
        }
    }
}

(async () => {
    await backfillLists();
    await backfillCards();
    await prisma.$disconnect();
    console.log('Rank backfill complete');
})();

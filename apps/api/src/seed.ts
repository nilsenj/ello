// apps/api/src/seed.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function ensureWorkspace(name: string) {
  return prisma.workspace.upsert({
    where: { name }, // Workspace.name is unique
    update: {},
    create: { name },
    select: { id: true, name: true },
  });
}

async function ensureBoard(workspaceId: string, name: string) {
  // Requires @@unique([workspaceId, name]) in Board (you added this)
  return prisma.board.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: {},
    create: { name, workspaceId },
    select: { id: true, name: true },
  });
}

async function ensureLists(boardId: string, names: string[]) {
  // rank: 'n', 'nn', 'nnn' ... simple increasing ranks
  let ranks: string[] = [];
  for (let i = 0; i < names.length; i++) ranks.push('n'.repeat(i + 1));

  await prisma.$transaction(
      names.map((name, i) =>
          prisma.list.upsert({
            where: { // unique safeguard: one per board+name
              // If you don't have a unique, you can change to findFirst + create
              // but using an explicit composite is best:
              // @@unique([boardId, name]) in List (optional but handy)
              // For now, fallback to synthetic where that can’t exist → findFirst below
              id: '___never___' // force upsert create; or do findFirst + create
            },
            update: {},
            create: { name, boardId, rank: ranks[i] }
          })
      )
  ).catch(async () => {
    // If you don't have a unique on (boardId,name), do idempotent createMany with ignoreDuplicates
    await prisma.list.createMany({
      data: names.map((name, i) => ({ name, boardId, rank: ranks[i] })),
      skipDuplicates: true,
    });
  });
}

const DEFAULT_LABELS: { name: string; color: string }[] = [
  { name: 'green',  color: '#61BD4F' },
  { name: 'yellow', color: '#F2D600' },
  { name: 'orange', color: '#FF9F1A' },
  { name: 'red',    color: '#EB5A46' },
  { name: 'purple', color: '#C377E0' },
  { name: 'blue',   color: '#0079BF' },
  { name: 'pink',   color: '#FF78CB' },
  { name: 'lime',   color: '#51E898' },
  { name: 'sky',    color: '#00C2E0' },
  { name: 'black',  color: '#344563' },
];

async function ensureLabels(boardId: string) {
  // Label has @@unique([boardId, name])
  await prisma.$transaction(
      DEFAULT_LABELS.map(l =>
          prisma.label.upsert({
            where: {
              boardId_name_color: { boardId, name: l.name, color: l.color },
            },
            update: { color: l.color },
            create: { name: l.name, color: l.color, boardId },
          })
      )
  );
}

async function addDemoCardsWithLabels(boardId: string) {
  // Fetch lists and a couple of labels to attach to cards
  const lists = await prisma.list.findMany({ where: { boardId }, orderBy: { rank: 'asc' } });
  if (lists.length === 0) return;

  const [backlog, todo, inprogress] = [lists[0], lists[1], lists[2]];

  const labels = await prisma.label.findMany({
    where: { boardId, name: { in: ['green', 'yellow', 'red'] } },
  });
  const green = labels.find(l => l.name === 'green');
  const yellow = labels.find(l => l.name === 'yellow');
  const red = labels.find(l => l.name === 'red');

  // Helper to create card w/ optional labels by name
  const mk = async (listId: string, title: string, labelNames: string[] = []) => {
    const created = await prisma.card.upsert({
      where: { id: `seed_${listId}_${title}`.slice(0, 24) }, // stable id to keep upsert idempotent (shorten to avoid >25 chars)
      update: {},
      create: {
        id: `seed_${listId}_${title}`.slice(0, 24),
        title,
        listId,
        rank: 'n',
      },
    });

    if (labelNames.length) {
      const toConnect = labels.filter(l => labelNames.includes(l.name)).map(l => ({ cardId: created.id, labelId: l.id }));
      // connect ignoring duplicates
      await prisma.cardLabel.createMany({ data: toConnect, skipDuplicates: true });
    }
  };

  await mk(backlog.id, 'Collect requirements', ['green']);
  await mk(todo.id, 'Design wireframes', ['yellow']);
  await mk(inprogress.id, 'Implement auth', ['red', 'yellow']);
}

async function main() {
  // 1) Workspace
  const ws = await ensureWorkspace('Demo Workspace');

  // 2) Boards
  const demoBoard = await ensureBoard(ws.id, 'Demo Board');
  const productBoard = await ensureBoard(ws.id, 'Product Launch');

  // 3) Lists per board
  const defaultLists = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
  await ensureLists(demoBoard.id, defaultLists);
  await ensureLists(productBoard.id, defaultLists);

  // 4) Labels per board
  await ensureLabels(demoBoard.id);
  await ensureLabels(productBoard.id);

  // 5) A few cards + labels on Demo Board
  await addDemoCardsWithLabels(demoBoard.id);

  console.log('✅ Seed completed: workspace, boards, lists, labels, and demo cards.');
}

main()
    .catch(e => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());

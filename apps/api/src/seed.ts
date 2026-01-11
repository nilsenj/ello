// apps/api/src/seed.ts
import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/* ========== AUTH USERS ========== */
async function seedAuthUsers() {
  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);

  const users = [
    { email: 'admin@ello.dev', name: 'Admin',     password: 'admin123', role: 'owner' as Role, isSuperAdmin: true },
    { email: 'user@ello.dev',  name: 'Demo User', password: 'user123',  role: 'member' as Role, isSuperAdmin: false },
  ];

  const created: Record<'admin' | 'demo', { id: string; email: string }> = {} as any;

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, rounds);

    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, password: hash, isSuperAdmin: u.isSuperAdmin },
      create: { email: u.email, name: u.name, password: hash, isSuperAdmin: u.isSuperAdmin },
      select: { id: true, email: true },
    });

    // Create/refresh a long-lived dev refresh token (idempotent)
    const token = `dev-${user.id}-refresh`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 3600 * 1000); // +30d

    await prisma.refreshToken.upsert({
      where: { token },
      update: { expiresAt, userId: user.id },
      create: { token, userId: user.id, expiresAt },
    });

    if (u.email.startsWith('admin')) created.admin = user as any;
    if (u.email.startsWith('user'))  created.demo  = user as any;

    console.log(`Seeded user: ${u.email} (pw: ${u.password})`);
  }

  return created;
}

/* ========== WORKSPACE / BOARD HELPERS ========== */
async function ensureWorkspace(name: string) {
  return prisma.workspace.upsert({
    where: { name },
    update: {},
    create: { name },
    select: { id: true, name: true },
  });
}

async function ensureBoard(workspaceId: string, name: string) {
  return prisma.board.upsert({
    where: { workspaceId_name: { workspaceId, name } },
    update: {},
    create: { name, workspaceId },
    select: { id: true, name: true },
  });
}

async function ensureLists(boardId: string, names: string[]) {
  const ranks = names.map((_, i) => 'n'.repeat(i + 1));

  // Stable upserts by synthetic IDs (idempotent)
  await prisma.$transaction(
      names.map((name, i) =>
          prisma.list.upsert({
            where: { id: `seed_list_${boardId}_${i}`.slice(0, 48) },
            update: {},
            create: { id: `seed_list_${boardId}_${i}`.slice(0, 48), name, boardId, rank: ranks[i] },
          })
      )
  ).catch(async () => {
    await prisma.list.createMany({
      data: names.map((name, i) => ({ name, boardId, rank: ranks[i] })),
      skipDuplicates: true,
    });
  });
}

const DEFAULT_LABELS = [
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
] as const;

async function ensureLabels(boardId: string) {
  await prisma.$transaction(
      DEFAULT_LABELS.map(l =>
          prisma.label.upsert({
            where: { boardId_name_color: { boardId, name: l.name, color: l.color } },
            update: { color: l.color },
            create: { name: l.name, color: l.color, boardId },
          })
      )
  );
}

async function addDemoCardsWithLabels(boardId: string) {
  const lists = await prisma.list.findMany({ where: { boardId }, orderBy: { rank: 'asc' } });
  if (lists.length < 3) return;
  const [backlog, todo, inprogress] = [lists[0], lists[1], lists[2]];

  const labels = await prisma.label.findMany({
    where: { boardId, name: { in: ['green', 'yellow', 'red'] } },
  });

  const mk = async (listId: string, title: string, labelNames: string[] = []) => {
    const id = `seed_${listId}_${title}`.replace(/\s+/g, '_').slice(0, 48);
    const created = await prisma.card.upsert({
      where: { id },
      update: {},
      create: { id, title, listId, rank: 'n' },
      select: { id: true },
    });

    if (labelNames.length) {
      const toConnect = labels
          .filter(l => labelNames.includes(l.name))
          .map(l => ({ cardId: created.id, labelId: l.id }));
      await prisma.cardLabel.createMany({ data: toConnect, skipDuplicates: true });
    }
  };

  await mk(backlog.id, 'Collect requirements', ['green']);
  await mk(todo.id,    'Design wireframes',    ['yellow']);
  await mk(inprogress.id, 'Implement auth',    ['red', 'yellow']);
}

/* ========== MEMBERSHIP HELPERS ========== */
async function ensureWorkspaceMember(workspaceId: string, userId: string, role: Role) {
  await prisma.workspaceMember.upsert({
    where: { userId_workspaceId: { userId, workspaceId } },
    update: { role },
    create: { userId, workspaceId, role },
  });
}

async function ensureBoardMember(boardId: string, userId: string, role: Role) {
  await prisma.boardMember.upsert({
    where: { userId_boardId: { userId, boardId } },
    update: { role },
    create: { userId, boardId, role },
  });
}

/* ========== MAIN ========== */
async function main() {
  // 0) Users (auth + refresh tokens)
  const { admin, demo } = await seedAuthUsers();

  // 1) Workspace & boards
  const ws = await ensureWorkspace('Demo Workspace');
  const demoBoard    = await ensureBoard(ws.id, 'Demo Board');
  const productBoard = await ensureBoard(ws.id, 'Product Launch');

  // 2) Link users to workspace/boards with roles
  await ensureWorkspaceMember(ws.id, admin.id, 'owner');
  await ensureWorkspaceMember(ws.id, demo.id,  'member');

  for (const b of [demoBoard, productBoard]) {
    await ensureBoardMember(b.id, admin.id, 'owner');
    await ensureBoardMember(b.id, demo.id,  'member');
  }

  // 3) Lists, labels, demo cards
  const defaultLists = ['Backlog', 'To Do', 'In Progress', 'Review', 'Done'];
  await ensureLists(demoBoard.id, defaultLists);
  await ensureLists(productBoard.id, defaultLists);

  await ensureLabels(demoBoard.id);
  await ensureLabels(productBoard.id);

  await addDemoCardsWithLabels(demoBoard.id);

  console.log('✅ Seed completed: users + memberships + workspace/boards/lists/labels/cards.');
}

main()
    .catch(e => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());

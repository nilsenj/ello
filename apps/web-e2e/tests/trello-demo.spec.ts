import { expect, test, type Page } from '@playwright/test';

type User = {
  name: string;
  email: string;
  password: string;
};

function isDemoRun(): boolean {
  return process.env.E2E_DEMO === '1' || process.env.E2E_DEMO === 'true';
}

function makeName(base: string): string {
  // Non-demo runs always use unique names.
  if (!isDemoRun()) return `${base} ${Date.now()}`;

  // Demo mode is for recordings. By default still avoid collisions.
  // If you want stable names for marketing, set E2E_RUN_ID to a fixed value
  // (or reset the DB before running).
  const runId = (process.env.E2E_RUN_ID || '').trim();
  return runId ? `${base} ${runId}` : `${base} ${Date.now()}`;
}

async function registerViaUi(page: Page, user: User) {
  await page.goto('/register');

  await page.getByPlaceholder('Your name').fill(user.name);
  await page.getByPlaceholder('Email').fill(user.email);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign up' }).click();

  // Home page is guarded; this should only appear when authed.
  await expect(page.locator('user-header')).toBeVisible();
}

test('workspace → invite member → template board → create card → tweak board settings', async ({
  page,
  browser,
}) => {
  const password = 'password123';

  // Create an invitee account in a separate context (UI-only).
  const invitee: User = {
    name: 'Invitee',
    email: `invitee+${Date.now()}@example.com`,
    password,
  };

  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();
  await registerViaUi(inviteePage, invitee);
  await inviteeContext.close();

  // Owner account (main flow).
  const owner: User = {
    name: 'Owner',
    email: `owner+${Date.now()}@example.com`,
    password,
  };

  await registerViaUi(page, owner);

  // Create workspace (opens modal from sidebar).
  const workspaceName = makeName('Demo Workspace');
  await page.getByLabel('Create workspace').first().click();

  const createWorkspaceDialog = page
    .locator('section[role="dialog"]')
    .filter({ hasText: 'Create Workspace' });

  await expect(createWorkspaceDialog).toBeVisible();

  await createWorkspaceDialog
    .getByPlaceholder('e.g. Engineering, Marketing, Personal')
    .fill(workspaceName);

  await Promise.all([
    page.waitForResponse((r) =>
      r.url().includes('/api/workspaces') && r.request().method() === 'POST' && r.ok(),
    ),
    createWorkspaceDialog
      .getByRole('button', { name: 'Create Workspace', exact: true })
      .click(),
  ]);

  // Workspace creation triggers a full reload via window.location.reload().
  await page.waitForLoadState('load');

  // Ensure the created workspace exists and select it explicitly.
  const workspaceItem = page.locator('.workspace-item', { hasText: workspaceName }).first();
  await expect(workspaceItem).toBeVisible({ timeout: 60_000 });
  await workspaceItem.click();

  await expect(page.getByRole('heading', { name: workspaceName })).toBeVisible();

  // Invite the other account to workspace.
  await page.getByRole('button', { name: 'Members' }).click();

  const membersDialog = page
    .locator('section[role="dialog"]')
    .filter({ hasText: 'Workspace Members' });

  await expect(membersDialog).toBeVisible();
  await membersDialog
    .getByPlaceholder('Enter email address to invite...')
    .fill(invitee.email);

  await membersDialog.getByRole('button', { name: 'Invite' }).click();

  // The backend may hide pending emails; toast is the stable UI signal.
  await expect(
    membersDialog.getByText(/Invitation sent successfully|Member added successfully/),
  ).toBeVisible();

  // Close modal.
  await membersDialog.locator('header button').last().click();

  // Create a board from template.
  await page.getByRole('button', { name: 'Templates' }).click();
  await expect(page.getByText('Start with a Template')).toBeVisible();

  await page.getByRole('heading', { name: 'Kanban Board' }).click();
  await page.waitForURL(/\/b\//);

  // Assert lists exist.
  await expect(page.getByText('To Do')).toBeVisible();
  await expect(page.getByText('In Progress')).toBeVisible();
  await expect(page.getByText('Done')).toBeVisible();

  // Create a card in the first list.
  const cardTitle = makeName('Launch checklist');
  const todoColumn = page.locator('list-column').filter({ hasText: 'To Do' }).first();

  await todoColumn.getByRole('button', { name: '+ Add a card' }).click();
  await todoColumn
    .locator('textarea[placeholder="Enter a title for this card..."]')
    .fill(cardTitle);
  await todoColumn.getByRole('button', { name: 'Add card' }).click();

  await expect(page.getByText(cardTitle)).toBeVisible();

  // Open board menu and tweak visibility.
  await page.getByRole('button', { name: /show menu/i }).click();
  const boardMenu = page.locator('board-menu');

  await boardMenu.getByRole('button', { name: 'Visibility' }).click();

  const publicOption = boardMenu.locator('button').filter({ hasText: 'Public' }).first();
  await publicOption.click();
  await expect(publicOption).toHaveClass(/border-blue-500/);
});

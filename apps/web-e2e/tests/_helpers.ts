import { expect, type Locator, type Page } from '@playwright/test';

type User = {
  name: string;
  email: string;
  password: string;
};

export function isDemoRun(): boolean {
  return process.env.E2E_DEMO === '1' || process.env.E2E_DEMO === 'true';
}

export function demoPauseMs(): number {
  if (!isDemoRun()) return 0;
  const raw = (process.env.E2E_PAUSE_MS || '').trim();
  const parsed = raw ? Number(raw) : 1200;
  return Number.isFinite(parsed) ? parsed : 1200;
}

export async function demoPause(page: Page, ms = demoPauseMs()): Promise<void> {
  if (!isDemoRun()) return;
  if (ms <= 0) return;
  await page.waitForTimeout(ms);
}

export function makeName(base: string): string {
  // Non-demo runs always use unique names.
  if (!isDemoRun()) return `${base} ${Date.now()}`;

  // Demo runs: allow stable naming via E2E_RUN_ID, otherwise still keep unique.
  const runId = (process.env.E2E_RUN_ID || '').trim();
  return runId ? `${base} ${runId}` : `${base} ${Date.now()}`;
}

export function makeUser(label: string, password = 'password123'): User {
  const stamp = Date.now();
  return {
    name: label,
    email: `${label.toLowerCase()}+${stamp}@example.com`,
    password,
  };
}

export async function registerViaUi(page: Page, user: User): Promise<void> {
  await page.goto('/register');
  await page.getByPlaceholder('Your name').fill(user.name);
  await page.getByPlaceholder('Email').fill(user.email);
  await page.getByPlaceholder('Password').fill(user.password);
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page.locator('user-header').first()).toBeVisible();
}

export async function ensureWorkspaceSelected(page: Page, workspaceName: string): Promise<void> {
  // If workspace exists, just select it.
  const existing = page.locator('.workspace-item', { hasText: workspaceName }).first();
  if (await existing.count()) {
    await existing.click();
    await expect(page.getByRole('heading', { name: workspaceName })).toBeVisible();
    return;
  }

  // Otherwise create it.
  await page.getByRole('button', { name: 'Create workspace', exact: true }).click();

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

  const workspaceItem = page.locator('.workspace-item', { hasText: workspaceName }).first();
  await expect(workspaceItem).toBeVisible({ timeout: 60_000 });
  await workspaceItem.click();

  await expect(page.getByRole('heading', { name: workspaceName })).toBeVisible();
}

export async function createBoardFromTemplate(page: Page, templateName: string): Promise<void> {
  await page.getByRole('button', { name: 'Templates' }).click();
  await expect(page.getByText('Start with a Template')).toBeVisible();

  await page.getByRole('heading', { name: templateName }).click();
  await page.waitForURL(/\/b\//);
}

export async function createCardInList(page: Page, listName: string, title: string): Promise<void> {
  const column = page.locator('list-column').filter({ hasText: listName }).first();
  await column.getByRole('button', { name: '+ Add a card' }).click();
  await column
    .locator('textarea[placeholder="Enter a title for this card..."]')
    .fill(title);
  await column.getByRole('button', { name: 'Add card' }).click();
  await expect(page.getByText(title)).toBeVisible();
}

export function cardModal(page: Page): Locator {
  return page.locator('card-modal .cm-panel').first();
}

export async function openCardModal(page: Page, cardTitle: string): Promise<Locator> {
  await page.getByText(cardTitle, { exact: true }).click();

  // Card modal is a custom component rendered as `.cm-panel`.
  // Use `.first()` to avoid strict-mode issues if Angular duplicates nodes briefly.
  const modal = cardModal(page);
  await expect(modal).toBeVisible();
  return modal;
}

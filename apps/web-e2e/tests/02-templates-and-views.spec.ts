import { expect, test } from '@playwright/test';
import {
  createBoardFromTemplate,
  demoPause,
  ensureWorkspaceSelected,
  makeName,
  makeUser,
  registerViaUi,
} from './_helpers';

test.afterEach(async ({ page }) => {
  await demoPause(page);
});

test('templates: create board, switch views (board/table/calendar)', async ({ page }) => {
  const user = makeUser('Viewer');
  await registerViaUi(page, user);

  const workspaceName = makeName('Templates Workspace');
  await ensureWorkspaceSelected(page, workspaceName);
  await demoPause(page);

  await createBoardFromTemplate(page, 'Scrum Board');
  await demoPause(page);

  // Switch views. The UI menu is occasionally flaky under demo slow-mo,
  // so use the query param that the app already supports.
  const url = new URL(page.url());

  url.searchParams.set('view', 'table');
  await page.goto(url.toString());
  await expect(page.getByText('Due Date', { exact: true })).toBeVisible();
  await demoPause(page);

  url.searchParams.set('view', 'calendar');
  await page.goto(url.toString());
  await expect(page.getByRole('button', { name: 'Today' })).toBeVisible();
  await demoPause(page);

  // Back to board view.
  url.searchParams.delete('view');
  await page.goto(url.toString());
  await expect(page.getByRole('searchbox', { name: 'Filter cards…' }).first()).toBeVisible();
});

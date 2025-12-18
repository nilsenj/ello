import { expect, test } from '@playwright/test';
import {
  createBoardFromTemplate,
  createCardInList,
  demoPause,
  ensureWorkspaceSelected,
  makeName,
  makeUser,
  registerViaUi,
} from './_helpers';

test.afterEach(async ({ page }) => {
  await demoPause(page);
});

test('overview: workspace → invite → template board → card → board settings', async ({
  page,
  browser,
}) => {
  const owner = makeUser('Owner');
  const invitee = makeUser('Invitee');

  // Create an invitee account in a separate context (UI-only).
  const inviteeContext = await browser.newContext();
  const inviteePage = await inviteeContext.newPage();
  await registerViaUi(inviteePage, invitee);
  await inviteeContext.close();

  await registerViaUi(page, owner);
  await demoPause(page);

  const workspaceName = makeName('Demo Workspace');
  await ensureWorkspaceSelected(page, workspaceName);
  await demoPause(page);

  // Invite member to workspace.
  await page.getByRole('button', { name: 'Members' }).click();
  const membersDialog = page
    .locator('section[role="dialog"]')
    .filter({ hasText: 'Workspace Members' });

  await expect(membersDialog).toBeVisible();
  await membersDialog
    .getByPlaceholder('Enter email address to invite...')
    .fill(invitee.email);
  await membersDialog.getByRole('button', { name: 'Invite' }).click();
  await expect(
    membersDialog.getByText(/Invitation sent successfully|Member added successfully/),
  ).toBeVisible();
  await demoPause(page);
  await membersDialog.locator('header button').last().click();

  // Create a board from template.
  await createBoardFromTemplate(page, 'Kanban Board');
  await demoPause(page);

  // Create a card.
  await expect(page.getByText('To Do')).toBeVisible();
  const cardTitle = makeName('Launch checklist');
  await createCardInList(page, 'To Do', cardTitle);
  await demoPause(page);

  // Open board menu and tweak visibility.
  await page.getByRole('button', { name: /show menu/i }).click();
  const boardMenu = page.locator('board-menu');
  await boardMenu.getByRole('button', { name: 'Visibility' }).click();

  const publicOption = boardMenu.locator('button').filter({ hasText: 'Public' }).first();
  await publicOption.click();
  await expect(publicOption).toHaveClass(/border-blue-500/);
  await demoPause(page);
});

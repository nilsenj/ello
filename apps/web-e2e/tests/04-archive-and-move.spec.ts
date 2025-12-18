import { expect, test } from '@playwright/test';
import {
  cardModal,
  createBoardFromTemplate,
  createCardInList,
  demoPause,
  ensureWorkspaceSelected,
  makeName,
  makeUser,
  openCardModal,
  registerViaUi,
} from './_helpers';

test.afterEach(async ({ page }) => {
  await demoPause(page);
});

test('workflow: attach URL → move card → archive/restore', async ({ page }) => {
  const user = makeUser('Owner');
  await registerViaUi(page, user);

  const workspaceName = makeName('Workflow Workspace');
  await ensureWorkspaceSelected(page, workspaceName);

  await createBoardFromTemplate(page, 'Kanban Board');
  await demoPause(page);

  const cardTitle = makeName('Design review');
  await createCardInList(page, 'To Do', cardTitle);

  const modal = await openCardModal(page, cardTitle);
  await demoPause(page);

  // Attach a local URL (no external network dependency).
  await modal
    .getByRole('button', { name: 'Attachment' })
    .first()
    .dispatchEvent('click');

  const attachUrlInput = modal.locator('input.cm-input[placeholder^="https://example.com"]');
  await expect(attachUrlInput).toBeVisible();
  await attachUrlInput.fill(
    'http://localhost:3000/uploads/1762978631362_1c1dd57f6344e6cdfa91a53d3b637cc4.png',
  );

  await modal.getByRole('button', { name: 'Attach URL' }).dispatchEvent('click');
  await expect(modal.getByText('No attachments yet.')).not.toBeVisible();
  await demoPause(page);

  // Move the card to "Done" using the modal Move action.
  await modal.getByRole('button', { name: 'Move' }).first().dispatchEvent('click');

  const movePanel = modal.locator('[data-panel="move"]');
  await expect(movePanel).toBeVisible();

  await movePanel.getByLabel('List').selectOption({ label: 'Done' });
  await movePanel.getByRole('button', { name: 'Move' }).dispatchEvent('click');
  await demoPause(page);

  // Close card modal.
  await modal.locator('button.cm-close').dispatchEvent('click');
  await expect(page.locator('card-modal .cm-panel')).toHaveCount(0);

  const doneColumn = page.locator('list-column').filter({ hasText: 'Done' }).first();
  await expect(doneColumn.getByText(cardTitle)).toBeVisible();
  await demoPause(page);

  // Archive the card (accept confirm dialog).
  await doneColumn.getByText(cardTitle, { exact: true }).click();
  const modal2 = cardModal(page);
  await expect(modal2).toBeVisible();

  page.once('dialog', (d) => d.accept());
  await modal2
    .locator('button.cm-add', { hasText: 'Archive' })
    .first()
    .dispatchEvent('click');
  await demoPause(page);

  // Open board menu → archived items → restore.
  await page.getByRole('button', { name: /show menu/i }).click();
  const boardMenu = page.locator('board-menu');
  await boardMenu.getByRole('button', { name: 'Archived items' }).click();

  const sendToBoard = boardMenu.getByRole('button', { name: 'Send to board' }).first();
  await expect(sendToBoard).toBeVisible();
  await sendToBoard.click();
  await demoPause(page);

  await expect(doneColumn.getByText(cardTitle)).toBeVisible();
});

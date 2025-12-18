import { expect, test } from '@playwright/test';
import {
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

test('card details: description, labels, checklist, planning', async ({ page }) => {
  const user = makeUser('Editor');
  await registerViaUi(page, user);

  const workspaceName = makeName('Card Details Workspace');
  await ensureWorkspaceSelected(page, workspaceName);

  await createBoardFromTemplate(page, 'Kanban Board');
  await demoPause(page);

  const cardTitle = makeName('Ship v1');
  await createCardInList(page, 'To Do', cardTitle);
  await demoPause(page);

  const modal = await openCardModal(page, cardTitle);

  // Add description (markdown). Use dispatchEvent to avoid pointer-interception flakiness.
  await modal
    .locator('text=Add a more detailed description')
    .first()
    .dispatchEvent('click');
  const descTextarea = modal.locator('textarea[placeholder^="Add a more detailed description"]');
  await expect(descTextarea).toBeVisible();
  await descTextarea.fill('## Lightweight Trello alternative\n\n- Free\n- Open source\n- Fast');
  await modal.getByRole('button', { name: 'Save' }).first().dispatchEvent('click');
  await demoPause(page);

  // Create & assign a label.
  await modal.locator('button.cm-add', { hasText: 'Labels' }).first().dispatchEvent('click');
  const labelsPanel = modal.locator('[data-panel="labels"]');
  await expect(labelsPanel).toBeVisible();

  await labelsPanel.getByRole('button', { name: 'Create a new label' }).dispatchEvent('click');
  await labelsPanel.getByPlaceholder('Label name').fill('Feature');
  await labelsPanel.getByRole('button', { name: 'Create' }).dispatchEvent('click');
  await demoPause(page);

  // Checklist.
  await modal
    .locator('button.cm-add', { hasText: 'Checklist' })
    .first()
    .dispatchEvent('click');

  const checklistPanel = modal.locator('[data-panel="checklists"]');
  await expect(checklistPanel).toBeVisible();

  await checklistPanel.getByRole('button', { name: 'Add checklist' }).dispatchEvent('click');
  await expect(checklistPanel.locator('input.cm-input').first()).toHaveValue('Checklist');
  await checklistPanel.getByRole('button', { name: 'Add item' }).first().dispatchEvent('click');
  await demoPause(page);

  // Planning (priority/risk/estimate).
  await modal
    .locator('button.cm-add', { hasText: 'Planning' })
    .first()
    .dispatchEvent('click');

  const planningPanel = modal.locator('[data-panel="planning"]');
  await expect(planningPanel).toBeVisible();

  await planningPanel.getByLabel('Priority').selectOption('high');
  await planningPanel.getByLabel('Risk').selectOption('medium');
  await planningPanel.getByPlaceholder('e.g. 3').fill('3');
  await demoPause(page);

  // Close modal.
  await modal.locator('button.cm-close').dispatchEvent('click');
  await expect(page.getByText(cardTitle)).toBeVisible();
});

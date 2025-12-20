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

test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
        if (msg.type() === 'error' || msg.type() === 'warning' || msg.type() === 'log') {
            console.log(`BROWSER ${msg.type().toUpperCase()}:`, msg.text());
        }
    });
    page.on('dialog', dialog => dialog.accept());
});

test.afterEach(async ({ page }) => {
    await demoPause(page);
});

test('card modal: actions and activity', async ({ page }) => {
    const user = makeUser('Tester');
    await registerViaUi(page, user);

    const workspaceName = makeName('Actions Workspace');
    await ensureWorkspaceSelected(page, workspaceName);

    await createBoardFromTemplate(page, 'Kanban Board');
    await demoPause(page);

    const cardTitle = makeName('Test Card Actions');
    await createCardInList(page, 'To Do', cardTitle);
    await demoPause(page);

    let modal = await openCardModal(page, cardTitle);

    // --- Test Activity Feed ---
    // Change description to trigger an activity log
    await modal.locator('text=Add a more detailed description').first().dispatchEvent('click');
    const descTextarea = modal.locator('textarea[placeholder^="Add a more detailed description"]');
    await descTextarea.fill('New Description Change');
    const buttons = await modal.locator('button').allInnerTexts();
    const saveButton = modal.locator('button').filter({ hasText: 'Save' }).first();
    await saveButton.dispatchEvent('click');
    await expect(modal.locator('textarea[placeholder^="Add a more detailed description"]')).not.toBeVisible();
    await demoPause(page);

    // Check activity feed
    const activitySection = modal.locator('section', { hasText: 'Activity' });
    const activityText = await activitySection.innerText();
    await expect(activitySection.getByText('changed the description of this card')).toBeVisible();

    // Add a comment
    const commentTextarea = modal.locator('textarea[placeholder="Write a comment…"]');
    await commentTextarea.fill('This is a test comment');
    const commentSection = modal.locator('section', { hasText: 'Comments' });
    const commentButton = commentSection.getByRole('button', { name: 'Comment' });

    // Ensure button is ready
    await expect(commentButton).toBeVisible();
    await expect(commentButton).toBeEnabled();

    await commentButton.dispatchEvent('click');
    await demoPause(page);
    await expect(commentTextarea).toHaveValue('');

    const commentList = commentSection.locator('.cm-comments');
    await expect(modal.getByText('This is a test comment')).toBeVisible();

    // --- Test Copy ---
    const copyButton = modal.locator('button.cm-add').filter({ hasText: 'Copy' });
    await copyButton.click({ force: true });
    const copyPanel = page.locator('[data-panel="copy"]');
    await expect(copyPanel).toBeVisible({ timeout: 15000 });
    const copyTitleInput = copyPanel.locator('textarea.cm-input');
    const copyTitle = cardTitle + ' (Copy)';
    await copyTitleInput.fill(copyTitle);

    // Select list if not selected
    const listSelect = copyPanel.locator('select').nth(1); // Second select is usually List
    await expect(listSelect).toBeEnabled();
    const listValue = await listSelect.inputValue();

    const copyConfirmButton = copyPanel.getByRole('button', { name: 'Copy' });
    await expect(copyConfirmButton).toBeEnabled();
    await copyConfirmButton.click({ force: true });
    await demoPause(page);
    await expect(copyPanel).not.toBeVisible();

    // Close modal and verify copy exists in the list
    await modal.locator('button.cm-close').click({ force: true });
    await expect(modal).not.toBeVisible();
    await expect(page.getByText(copyTitle)).toBeVisible();

    // --- Test Move ---
    modal = await openCardModal(page, copyTitle);
    const moveButton = modal.locator('button.cm-add').filter({ hasText: 'Move' });
    await moveButton.dispatchEvent('click');
    const movePanel = modal.locator('[data-panel="move"]');
    await expect(movePanel).toBeVisible({ timeout: 15000 });

    // Choose 'In Progress' list
    const moveListSelect = movePanel.getByLabel('List');
    await moveListSelect.selectOption({ label: 'In Progress' });
    const selectedList = await moveListSelect.inputValue();

    const moveConfirmButton = movePanel.getByRole('button', { name: 'Move' });
    await expect(moveConfirmButton).toBeEnabled(); // Ensure enabled
    await moveConfirmButton.dispatchEvent('click');
    await demoPause(page);

    // Close modal after move
    await modal.locator('button.cm-close').click({ force: true });
    await expect(modal).not.toBeVisible();

    // Verify it moved to 'In Progress'
    const inProgressList = page.locator('list-column', { hasText: 'In Progress' });
    await expect(inProgressList.getByText(copyTitle)).toBeVisible();

    // --- Test Archive ---
    modal = await openCardModal(page, copyTitle);
    const archiveButton = modal.locator('button.cm-add').filter({ hasText: 'Archive' });
    await archiveButton.click({ force: true });
    await demoPause(page);
    await expect(modal).not.toBeVisible();
    await expect(page.getByText(copyTitle)).not.toBeVisible();

    // --- Test Delete ---
    modal = await openCardModal(page, cardTitle); // Back to original card
    const deleteButton = modal.locator('button.cm-add').filter({ hasText: 'Delete' });
    await deleteButton.click({ force: true });
    const deletePanel = page.locator('[data-panel="delete"]');
    await expect(deletePanel).toBeVisible({ timeout: 15000 });
    const deleteConfirmButton = deletePanel.getByRole('button', { name: 'Delete' });
    await deleteConfirmButton.click({ force: true });
    await demoPause(page);
    await expect(page.getByText(cardTitle)).not.toBeVisible();
});

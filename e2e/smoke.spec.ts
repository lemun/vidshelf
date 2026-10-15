import { expect, test, type Page } from '@playwright/test';
import path from 'node:path';

const FIXTURE = path.join(__dirname, 'fixtures', 'sample.webm');

async function playerState(page: Page) {
  return page.getByTestId('player').evaluate((video: HTMLVideoElement) => ({
    readyState: video.readyState,
    currentTime: video.currentTime,
  }));
}

test('sign up, upload a video, watch it play, find it in search', async ({ page }) => {
  const id = Date.now().toString(36);
  const username = `smoke_${id}`;
  const title = `Smoke test ${id}`;

  await page.goto('/signup');
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Email').fill(`${username}@example.com`);
  await page.getByLabel('Password').fill('correct-horse-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByTestId('current-user')).toContainText(username);

  await page.getByRole('link', { name: 'Upload', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles(FIXTURE);
  await expect(page.getByAltText('Poster frame')).toBeVisible(); // thumbnail grabbed in-browser
  await page.getByLabel('Title').fill(title);
  await page.getByLabel(/Description/).fill('Uploaded by the Playwright smoke test.');
  await page.getByRole('button', { name: 'Publish' }).click();

  await expect(page).toHaveURL(/\/watch\/[0-9a-f]{24}$/);
  await expect(page.getByRole('heading', { name: title })).toBeVisible();

  // Streams from a presigned MinIO URL and actually plays.
  await expect.poll(async () => (await playerState(page)).readyState).toBeGreaterThanOrEqual(2);
  await page.getByTestId('player').evaluate((video: HTMLVideoElement) => {
    video.muted = true;
    return video.play();
  });
  await expect.poll(async () => (await playerState(page)).currentTime).toBeGreaterThan(0);
  await expect(page.getByTestId('view-count')).toContainText('1 view');

  await page.getByRole('button', { name: /0 likes/ }).click();
  await expect(page.getByTestId('like-count')).toHaveText('1 like');

  await page.getByLabel('Search videos').fill(`smoke ${id}`);
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.getByTestId('video-card').filter({ hasText: title })).toBeVisible();
});

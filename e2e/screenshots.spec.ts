import { expect, test } from '@playwright/test';
import path from 'node:path';

/**
 * Regenerates the README screenshots from a live stack. Skipped unless SCREENSHOTS=1:
 *   docker compose up --build -d && SCREENSHOTS=1 npx playwright test screenshots
 */
test.skip(!process.env.SCREENSHOTS, 'set SCREENSHOTS=1 to regenerate docs/screenshots');

const fixtures = path.join(__dirname, 'fixtures');
const out = (name: string) => path.join(__dirname, '..', 'docs', 'screenshots', name);

const uploads = [
  {
    file: 'mandelbrot.webm',
    title: 'Mandelbrot zoom, four seconds',
    description: 'Rendered with ffmpeg.',
  },
  {
    file: 'gradients.webm',
    title: 'Indigo to amber gradient loop',
    description: 'A calm colour study.',
  },
  { file: 'sample.webm', title: 'Test pattern with timer', description: 'The classic.' },
];

test('README screenshots', async ({ page }) => {
  const id = Date.now().toString(36);
  await page.goto('/signup');
  await page.getByLabel('Username').fill(`demo_${id}`);
  await page.getByLabel('Email').fill(`demo_${id}@example.com`);
  await page.getByLabel('Password').fill('correct-horse-42');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByTestId('current-user')).toBeVisible();

  for (const upload of uploads) {
    await page.goto('/upload');
    await page.locator('input[type=file]').setInputFiles(path.join(fixtures, upload.file));
    await expect(page.getByAltText('Poster frame')).toBeVisible();
    await page.getByLabel('Title').fill(upload.title);
    await page.getByLabel(/Description/).fill(upload.description);
    if (upload === uploads.at(-1)) await page.screenshot({ path: out('upload.png') });
    await page.getByRole('button', { name: 'Publish' }).click();
    await expect(page).toHaveURL(/\/watch\//);
  }

  await page.getByRole('button', { name: /likes?/ }).click();
  await expect(page.getByTestId('like-count')).toHaveText('1 like');
  await page.screenshot({ path: out('watch.png') });

  await page.goto('/');
  await expect(page.getByTestId('video-card').first()).toBeVisible();
  await page.screenshot({ path: out('home.png') });
});

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

async function main() {
  const url = 'http://127.0.0.1:39007/manual_full.html';
  const outPath = path.resolve('e:/总任务/任务三-音频处理大师/Audio Converter/docs/音频处理大师用户使用说明书.pdf');
  await ensureDir(path.dirname(outPath));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(1000);

  await page.pdf({
    path: outPath,
    format: 'A4',
    printBackground: true,
    margin: { top: '0.4in', right: '0.4in', bottom: '0.5in', left: '0.4in' }
  });

  await browser.close();
  console.log('[OK] exported PDF ->', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

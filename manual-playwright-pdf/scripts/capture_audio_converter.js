const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function ensureDir(p) {
  await fs.promises.mkdir(p, { recursive: true });
}

function arg(name, def) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return def;
}

async function main() {
  const baseUrl = arg('base', 'http://127.0.0.1:39006/index.html');
  const outDir = arg('out', path.resolve('e:/总任务/任务三-音频处理大师/Audio Converter/docs/full_manual_assets/screenshots'));
  const testDir = arg('test', path.resolve('e:/总任务/任务三-音频处理大师/Audio Converter/test'));
  const testAudio = path.join(testDir, '葛仙山3.mp3');

  const features = [
    { label: '音频转换', shot: 'convert.png' },
    { label: '音频剪切', shot: 'cut.png' },
    { label: '视频提取音频', shot: 'video-extract.png' },
    { label: '音频合并', shot: 'merge.png' },
    { label: '人声-伴奏提取', shot: 'vocal-separate.png' },
    { label: '音频录制', shot: 'record.png' },
    { label: '音频降噪', shot: 'denoise.png' },
    { label: '音频变速', shot: 'speed.png' },
    { label: '添加背景音', shot: 'bgm.png' },
    { label: '淡入淡出', shot: 'fade.png' },
    { label: '视频替换音频', shot: 'video-replace.png' },
    { label: '截去静音', shot: 'silence.png' },
    { label: '均衡器', shot: 'equalizer.png' },
    { label: '视频消除人声', shot: 'video-remove-vocal.png' },
  ];

  await ensureDir(outDir);

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1366, height: 768 } });
  const page = await context.newPage();

  async function waitLoading() {
    for (let i = 0; i < 30; i++) {
      const c = await page.locator('#loading').count();
      if (c === 0) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(500);
  }

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await waitLoading();
  await page.screenshot({ path: path.join(outDir, 'home-overview.png'), type: 'png' });

  async function tryUpload() {
    const candidates = ['点击添加文件', '点击添加音频', '点击添加视频', '添加音频', '添加视频'];
    for (const text of candidates) {
      const locator = page.getByText(text, { exact: false });
      if (await locator.count()) {
        const [chooser] = await Promise.all([
          page.waitForEvent('filechooser', { timeout: 2000 }).catch(() => null),
          locator.first().click().catch(() => null),
        ]);
        if (chooser) {
          try {
            await chooser.setFiles(testAudio);
            await page.waitForTimeout(800);
            return true;
          } catch {}
        }
      }
    }
    return false;
  }

  for (const f of features) {
    const menuItem = page.getByText(f.label, { exact: true });
    if (await menuItem.count()) {
      await menuItem.first().click();
      await page.waitForTimeout(600);
      await tryUpload();
      await page.screenshot({ path: path.join(outDir, f.shot), type: 'png' });
    }
  }

  await browser.close();
  console.log('[OK] screenshots captured to:', outDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

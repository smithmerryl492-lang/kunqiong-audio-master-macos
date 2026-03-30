async (page) => {
  const out = "__OUT_DIR__";
  const plan = __PLAN_JSON__;

  await page.setViewportSize({ width: 1366, height: 768 });

  async function go(url) {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    for (let i = 0; i < 20; i++) {
      const c = await page.getByText("Loading...").count();
      if (c === 0) break;
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(500);
  }

  const done = [];
  for (const item of plan) {
    await go(item.url);
    await page.screenshot({ path: `${out}/${item.screenshot}`, type: "png" });
    done.push(item.screenshot);
  }
  return done;
};

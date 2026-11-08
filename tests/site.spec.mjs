import { test, expect } from "@playwright/test";

test("all canonical headings, news and booklet order", async ({ page }) => {
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText(/שבוע טוב.*מס׳ 10/);
  await expect(page.locator(".hero__edition")).toHaveText("פותחים שבוע");
  const weight = await page.locator(".hero__edition").evaluate(n => getComputedStyle(n).fontWeight);
  expect(Number(weight)).toBeGreaterThanOrEqual(800);
  await expect(page.locator(".hero__day")).toContainText("יום ראשון | 08.11.2026");
  await expect(page.locator(".hero__hebrew")).toHaveText("כ״ח בחשוון תשפ״ז");
  await expect(page.locator(".hero__issue")).toHaveText("THE TEACHERS JOURNAL / ISSUE 10");
  for (const id of ["news", "coming", "courses", "teaching", "model"]) {
    await expect(page.locator("#" + id)).toBeVisible();
  }
  await expect(page.locator("#news article")).toHaveCount(3);
  await expect(page.locator("#coming .table-frame--desktop tbody tr")).toHaveCount(10);
  await expect(page.locator("#coming .table-frame--desktop .row-featured")).toHaveCount(1);
  await expect(page.locator("#coming .table-frame--desktop .row-featured")).toContainText("207516");
  await expect(page.locator("#coming .table-frame--desktop th")).toHaveText(["תאריך", "האירוע", "מצפ״ן", "שעה", "קישור"]);
  await expect(page.locator("#courses tbody tr")).toHaveCount(10);
  await expect(page.locator("#teaching .table-frame--desktop tbody tr")).toHaveCount(10);
  await expect(page.locator("#teaching .table-frame--mobile tbody tr")).toHaveCount(10);
  await expect(page.locator("#model .table-frame").first().locator("tbody tr:not(.group-row)")).toHaveCount(6);
  await expect(page.locator("#model .table-frame--desktop .group-head")).toHaveText(["משימות חובה בכיתה ז׳", "משימת הערכה בכיתה ז׳", "משימות חובה בכיתה ח׳", "משימת הערכה בכיתה ח׳"]);
  await expect(page.locator("#model .table-frame--desktop thead")).not.toContainText("סוג");
  await expect(page.locator("#booklet details")).toHaveCount(6);
  const tableFirst = await page.evaluate(() => {
    const model = document.querySelector("#model");
    return model.querySelector(".table-frame").compareDocumentPosition(model.querySelector("#booklet")) & Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(tableFirst).toBeTruthy();
  expect(errors).toEqual([]);
});

test("source photographs remain permission-gated", async ({ page }) => {
  let unauthorized = [];
  page.on("request", request => {
    if (request.url().includes("/content/captures/")) unauthorized.push(request.url());
  });
  await page.goto("/");
  await page.locator("#booklet details").first().locator("summary").click();
  await expect(page.locator("#booklet details").first().locator(".photo-unavailable")).toBeVisible();
  expect(unauthorized).toEqual([]);
  await expect(page.locator("#booklet img")).toHaveCount(0);
});

for (const width of [320, 360, 390, 430, 768, 1440]) {
  test("viewport width " + width + " renders accessible RTL tables", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("#coming .table-frame:visible table")).toBeVisible();
    await expect(page.locator("#teaching .table-frame:visible table")).toBeVisible();
    await expect(page.locator("#model .table-frame:visible table").first()).toBeVisible();
    const values = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      inner: window.innerWidth,
      lang: document.documentElement.lang,
      direction: document.documentElement.dir
    }));
    expect(values.lang).toBe("he");
    expect(values.direction).toBe("rtl");
    expect(values.scroll).toBeLessThanOrEqual(values.inner + 2);
    if (width === 390 || width === 1440) {
      await page.screenshot({ path: "test-results/sikum10-" + width + ".png", fullPage: true, animations: "disabled" });
    }
  });
}

test("reduced motion leaves no running animation", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(page.locator(".hero")).toBeVisible();
  const running = await page.evaluate(() => document.getAnimations().filter(a => a.playState === "running").length);
  expect(running).toBe(0);
});

import { test, expect } from "@playwright/test";

test("all canonical headings, news and booklet order", async ({ page }) => {
  const errors = [];
  page.on("pageerror", err => errors.push(err.message));
  await page.goto("/");
  await expect(page.locator("h1")).toHaveText("פותחים שבוע");
  await expect(page.getByText("סיכום שבועי מספר 10").first()).toBeVisible();
  for (const id of ["news", "coming", "courses", "teaching", "model"]) {
    await expect(page.locator("#" + id)).toBeVisible();
  }
  await expect(page.locator("#news article")).toHaveCount(3);
  await expect(page.locator("#coming tbody tr")).toHaveCount(10);
  await expect(page.locator("#courses tbody tr")).toHaveCount(10);
  await expect(page.locator("#teaching .table-frame--desktop tbody tr")).toHaveCount(10);
  await expect(page.locator("#teaching .table-frame--mobile tbody tr")).toHaveCount(10);
  await expect(page.locator("#model .table-frame").first().locator("tbody tr")).toHaveCount(6);
  await expect(page.locator("#booklet details")).toHaveCount(6);
  const tableFirst = await page.evaluate(() => {
    const model = document.querySelector("#model");
    return model.querySelector(".table-frame").compareDocumentPosition(model.querySelector("#booklet")) & Node.DOCUMENT_POSITION_FOLLOWING;
  });
  expect(tableFirst).toBeTruthy();
  expect(errors).toEqual([]);
});

test("every canonical record is faithfully rendered with real source links", async ({ page }) => {
  const response = await page.request.get("/data/edition.json");
  expect(response.ok()).toBeTruthy();
  const data = await response.json();
  await page.goto("/");

  const news = page.locator("#news article");
  for (const [index, item] of data.news.entries()) {
    const row = news.nth(index);
    await expect(row.locator("h3")).toHaveText(item.title);
    await expect(row).toContainText(item.description);
    if (item.url) await expect(row.locator("a").first()).toHaveAttribute("href", item.url);
  }

  const events = page.locator("#coming tbody tr");
  for (const [index, item] of data.events.entries()) {
    const row = events.nth(index);
    await expect(row).toContainText(item.date);
    await expect(row).toContainText(item.title);
    await expect(row).toContainText(item.status === "time-unverified" ? "השעה טרם אומתה" : item.time);
    if (item.course) await expect(row).toContainText(item.course);
    if (item.url) await expect(row.locator("a")).toHaveAttribute("href", item.url);
    if (item.status === "time-unverified") await expect(row).toContainText("השעה טרם אומתה");
    if (item.status === "proposed") await expect(row).toContainText("מועד מוצע");
  }

  const courses = page.locator("#courses tbody tr");
  for (const [index, item] of data.courses.entries()) {
    const row = courses.nth(index);
    for (const text of [item.date, item.mode, item.topic, item.description]) {
      await expect(row).toContainText(text);
    }
    await expect(row.locator("a")).toHaveAttribute("href", item.syllabus);
  }

  const desktopTeaching = page.locator("#teaching .table-frame--desktop tbody tr");
  const mobileTeaching = page.locator("#teaching .table-frame--mobile tbody tr");
  for (const [index, item] of data.curriculum.entries()) {
    for (const row of [desktopTeaching.nth(index), mobileTeaching.nth(index)]) {
      for (const text of [item.grade, item.track, item.domain, item.subjects]) {
        await expect(row).toContainText(text);
      }
      await expect(row.locator("a")).toHaveAttribute("href", item.url);
    }
  }

  const desktopTasks = page.locator("#model > .section__body .table-frame--desktop tbody tr");
  const mobileTasks = page.locator("#model > .section__body .table-frame--mobile tbody tr");
  const details = page.locator("#booklet details");
  for (const [index, task] of data.tasks.entries()) {
    for (const row of [desktopTasks.nth(index), mobileTasks.nth(index)]) {
      await expect(row).toContainText(task.title);
      await expect(row).toContainText(task.kind);
      await expect(row.locator("a")).toHaveAttribute("href", task.sourceUrl);
    }
    await expect(details.nth(index).locator("summary")).toContainText(task.title);
  }
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
    await expect(page.locator("#coming table")).toBeVisible();
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

test("reduced motion disables rotating emblem", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animation = await page.locator(".emblem__ring").evaluate(n => getComputedStyle(n).animationName);
  expect(animation).toBe("none");
});

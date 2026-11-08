import { test, expect } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

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
  await expect(page.locator("#coming .event--tnufa-guidance")).toContainText("איילת קריספין");
  await expect(page.locator("#coming tbody tr")).toHaveCount(11);
  await expect(page.locator("#courses tbody tr")).toHaveCount(10);
  await expect(page.locator("#teaching .table-frame--desktop tbody tr")).toHaveCount(10);
  await expect(page.locator("#teaching .table-frame--mobile tbody tr")).toHaveCount(10);
  await expect(page.locator("#model .table-frame").first().locator("tbody tr")).toHaveCount(6);
  await expect(page.locator("#booklet .task-table-block")).toHaveCount(6);
  await expect(page.locator("#booklet .task-table-block .table-frame")).toHaveCount(12);
  await expect(page.locator("#model > .section__body > div:nth-child(2) .table-frame--desktop tbody tr")).toHaveCount(8);
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

  const desktopTasks = page.locator("#model > .section__body > div:first-child .table-frame--desktop tbody tr");
  const mobileTasks = page.locator("#model > .section__body > div:first-child .table-frame--mobile tbody tr");
  const taskSections = page.locator("#booklet .task-table-block");
  for (const [index, task] of data.tasks.entries()) {
    for (const row of [desktopTasks.nth(index), mobileTasks.nth(index)]) {
      await expect(row).toContainText(task.title);
      await expect(row).toContainText(task.kind);
      await expect(row.locator("a")).toHaveAttribute("href", task.sourceUrl);
    }
    await expect(taskSections.nth(index).locator("h4")).toContainText(task.title);
    await expect(taskSections.nth(index).locator("table")).toHaveCount(2);
    await expect(taskSections.nth(index).locator(".table-frame:last-child tbody tr")).toHaveCount(task.items.length);
  }
});

test("source photographs remain permission-gated", async ({ page }) => {
  let unauthorized = [];
  page.on("request", request => {
    if (/\/captures\//.test(request.url())) unauthorized.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("#booklet .task-table-block")).toHaveCount(6);
  await expect(page.locator("#booklet .task-table-block").first()).toContainText("הצגה והפצה חסומות");
  expect(unauthorized).toEqual([]);
  await expect(page.locator("#booklet img")).toHaveCount(0);
  await expect(page.locator("#booklet details")).toHaveCount(0);
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

test("320px mobile links are comfortable touch targets", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto("/");
  const targets = await page.locator(".nav-strip a:visible, .table-link:visible").evaluateAll(elements =>
    elements.map(element => ({
      text: (element.textContent || "").trim(),
      height: element.getBoundingClientRect().height
    }))
  );
  expect(targets.length).toBeGreaterThan(10);
  for (const target of targets) {
    expect(target.height, target.text).toBeGreaterThanOrEqual(43.9);
  }
});

test("print preview renders real A4 portrait pages without unpublished photos", async ({ page }) => {
  const unauthorized = [];
  page.on("request", request => {
    if (/\/captures\//.test(request.url())) unauthorized.push(request.url());
  });
  await page.goto("/");
  // The page's JSON is fetched asynchronously. Wait for all canonical sections before printing.
  await expect(page.locator("#booklet .task-table-block")).toHaveCount(6);
  await expect(page.locator("#coming tbody tr")).toHaveCount(11);
  await expect(page.locator("#model .table-frame").first().locator("tbody tr")).toHaveCount(6);
  await page.emulateMedia({ media: "print" });
  await page.evaluate(() => document.fonts.ready);
  const printLayout = await page.evaluate(() => ({
    mainText: document.querySelector("#main")?.textContent?.length,
    mainHeight: Math.round(document.querySelector("#main")?.getBoundingClientRect()?.height || 0),
    bodyHeight: document.body.scrollHeight,
    sectionCount: document.querySelectorAll("#main > div > .section").length,
    sections: [...document.querySelectorAll("#main > div > .section")].map(e => ({
      name:e.id,
      height:Math.round(e.getBoundingClientRect().height),
      display:getComputedStyle(e).display,
      breakBefore:getComputedStyle(e).breakBefore,
      visibility:getComputedStyle(e).visibility
    })),
    paper: [...document.styleSheets].length
  }));
  console.log("PRINT_LAYOUT", JSON.stringify(printLayout));
  expect(printLayout.sectionCount).toBe(5);
  expect(printLayout.mainText).toBeGreaterThan(6000);
  const pdfBytes = await page.pdf({ preferCSSPageSize: true, printBackground: true });
  const document = await PDFDocument.load(pdfBytes);
  expect(document.getPageCount()).toBeGreaterThanOrEqual(5);
  for (const pdfPage of document.getPages()) {
    const { width, height } = pdfPage.getSize();
    expect(Math.abs(width - 595.28)).toBeLessThan(1);
    expect(Math.abs(height - 841.89)).toBeLessThan(1);
  }
  expect(unauthorized).toEqual([]);
});

test("reduced motion disables rotating emblem", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const animation = await page.locator(".emblem__ring").evaluate(n => getComputedStyle(n).animationName);
  expect(animation).toBe("none");
});

test("A4-inspired sheets are contiguous, separated in teal, and mobile text stays readable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const desk = await page.evaluate(() => {
    const hero = document.querySelector("#main > div > .hero");
    const section = document.querySelector("#main > div > .section");
    const style = getComputedStyle(hero);
    const sectionStyle = getComputedStyle(section);
    return {
      heroWidth: hero.getBoundingClientRect().width,
      heroHeight: hero.getBoundingClientRect().height,
      heroBorder: parseFloat(style.borderBottomWidth),
      heroBorderColor: style.borderBottomColor,
      sectionMarginTop: parseFloat(sectionStyle.marginTop),
      sectionRadius: sectionStyle.borderRadius,
      sectionShadow: sectionStyle.boxShadow
    };
  });
  expect(desk.heroWidth).toBeGreaterThan(750);
  expect(desk.heroWidth).toBeLessThan(850);
  expect(desk.heroHeight / desk.heroWidth).toBeGreaterThan(1.40);
  expect(desk.heroBorder).toBeGreaterThanOrEqual(2);
  expect(desk.sectionMarginTop).toBe(0);
  expect(desk.sectionShadow).toBe("none");
  expect(desk.sectionRadius).toBe("0px");

  await page.setViewportSize({ width: 320, height: 900 });
  await page.reload();
  const mobile = await page.evaluate(() => {
    const el = document.querySelector("#main > div");
    const table = document.querySelector("#model .table-frame--mobile table");
    return {
      pageWidth: el.getBoundingClientRect().width,
      pageOverflow: document.documentElement.scrollWidth - window.innerWidth,
      textSize: parseFloat(getComputedStyle(table.querySelector("td")).fontSize),
      tableRows: document.querySelectorAll("#model .task-table-block").length
    };
  });
  expect(mobile.pageWidth).toBeLessThanOrEqual(320);
  expect(mobile.pageOverflow).toBeLessThanOrEqual(2);
  expect(mobile.textSize).toBeGreaterThanOrEqual(13);
  expect(mobile.tableRows).toBe(6);
});

test("Ayelet Krespins November 10 workshop is prominent and source-accurate", async ({ page }) => {
  await page.goto("/");
  const event = page.locator("#coming tr.event--tnufa-guidance");
  await expect(event).toHaveCount(1);
  await expect(event).toContainText("10.11.2026");
  await expect(event).toContainText("18:00");
  await expect(event).toContainText("איילת קריספין");
  await expect(event.locator("a")).toHaveCount(0);
  const actual = await event.locator(".event__highlight").evaluate(el => ({
    fontSize: parseFloat(getComputedStyle(el).fontSize),
    color: getComputedStyle(el).color
  }));
  expect(actual.fontSize).toBeGreaterThanOrEqual(18);
  expect(actual.color).toBe("rgb(7, 90, 58)");
});

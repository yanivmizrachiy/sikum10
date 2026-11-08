import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const data = JSON.parse(readFileSync(new URL("../data/edition.json", import.meta.url), "utf8"));
const app = readFileSync(new URL("../assets/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../assets/app.css", import.meta.url), "utf8");
const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("canonical edition identity and publication gate", () => {
  assert.equal(data.edition.number, 10);
  assert.equal(data.edition.date, "2026-11-08");
  assert.match(data.edition.displayDate, /יום ראשון.*כ״ח בחשוון תשפ״ז.*8\.11\.2026/);
  assert.equal(data.edition.title, "פותחים שבוע");
  assert.equal(data.edition.greeting, "שבוע טוב");
  assert.equal(data.edition.region, "הדרכה במחוז ירושלים והעיר ירושלים – מנח״י");
  assert.ok(!/פרשת|שבת שלום/.test(JSON.stringify(data.edition)));
  assert.equal(data.permissions.distributionApproved, false);
  assert.equal(data.permissions.showCaptureImages, false);
  assert.equal(data.permissions.publicSiteApproved, false);
});
test("runtime section guards match the canonical dataset", () => {
  const guard = app.match(/const expected\s*=\s*\{([^}]+)\}/)?.[1];
  assert.ok(guard, "Missing runtime section-count guard");
  for (const section of ["news", "events", "curriculum", "courses", "tasks", "model"]) {
    const re = new RegExp("\\b" + section + "\\s*:\\s*(\\d+)\\b");
    const matched = guard.match(re);
    assert.ok(matched, "Missing runtime count for " + section);
    assert.equal(Number(matched[1]), data[section].length, section + " runtime/data count mismatch");
  }
  assert.equal(new Set(data.events.map(e => [e.date, e.time, e.title].join("|"))).size,
    data.events.length, "Duplicate schedule entries");
});

test("complete unique sections and editorial accuracy", () => {
  assert.equal(data.news.length, 3);
  assert.equal(data.events.length, 11);
  assert.equal(data.courses.length, 10);
  assert.equal(data.curriculum.length, 10);
  assert.equal(data.model.length, 8);
  assert.equal(data.news[0].id, "tnufa");
  assert.equal(data.news[1].id, "training");
  assert.equal(data.news[2].id, "resources");
  assert.ok(!data.events.some(e => /מרצה:|בהנחיית/.test(e.title)));
  assert.equal(data.events[1].id, "tnufa-guidance");
  assert.equal(data.events[1].date, "10.11.2026");
  assert.equal(data.events[1].time, "18:00");
  assert.ok(data.events[1].title.includes("איילת קריספין"));
  assert.equal(data.events[1].url, null);
  assert.equal(data.events[1].course, null);
  assert.ok(data.events.some(e => e.date === "17.11.2026" && e.status === "time-unverified" && e.verifiedTime === null));
  assert.ok(data.events.some(e => e.date === "18.11.2026" && e.status === "proposed"));
  assert.ok(data.curriculum.some(x => x.grade === "ט׳" && x.track === "פריסה רגילה"));
  assert.ok(data.curriculum.some(x => x.grade === "ט׳" && x.track === "פריסה מצומצמת"));
});
test("six original tasks, 36 questions, 6 contextual items, 43 captured parts", () => {
  assert.equal(data.tasks.length, 6);
  assert.equal(new Set(data.tasks.map(t => t.id)).size, 6);
  assert.equal(data.tasks.reduce((sum, t) => sum + t.questionCount, 0), 36);
  assert.deepEqual(data.tasks.map(t => [t.grade, t.kind]), [
    ["ז׳", "חובה"], ["ז׳", "חובה"], ["ז׳", "הערכה"],
    ["ח׳", "חובה"], ["ח׳", "הערכה"], ["ח׳", "חובה"]
  ]);
  const items = data.tasks.flatMap(t => t.items);
  assert.equal(items.length, 42);
  assert.equal(new Set(items.map(i => i.id)).size, 42);
  const parts = items.flatMap(i => i.parts);
  assert.equal(parts.length, 43);
  assert.ok(parts.every(p => p.file.startsWith("captures/") && p.file.endsWith(".png") && p.width > 0 && p.height > 0));
  assert.ok(data.tasks.every(t => t.items.length >= t.questionCount));
  assert.ok(data.tasks.every(t => t.grade !== "ט׳"));
});
test("authentic updated submission dates with explicit unknowns", () => {
  const g7 = data.tasks.find(t => t.id === "g7-assessment-1");
  const g8 = data.tasks.find(t => t.id === "g8-10-assessment-1");
  assert.deepEqual(g7.submission.map(s => s.to), ["2026-11-20", "2026-11-20"]);
  assert.deepEqual(g8.submission.map(s => s.to), ["2026-11-13", "2026-11-13"]);
  assert.equal(g7.submission.find(s => s.track === "עמ״ט").verification, "requires-confirmation");
  assert.equal(data.tasks.filter(t => t.kind === "חובה" && t.missingDeadline && t.submission.length === 0).length, 4);
  assert.ok(data.tasks.every(t => t.kind === "חובה" || t.submission.length === 2));
  const assessments = data.tasks.filter(t => t.kind === "הערכה");
  assert.equal(assessments.length, 2);
  assert.ok(assessments.every(t => t.photoTrackCaution?.includes("עמ״ט")));
  assert.ok(assessments.every(t => t.photoTrackCaution?.includes("לא")));

});
test("safe markup and a real summary table before the booklet", () => {
  assert.match(html, /lang="he" dir="rtl"/);
  assert.match(html, /assets\/app\.js/);
  assert.match(html, /assets\/app\.css/);
  assert.match(app, /data\/edition\.json/);
  assert.match(app, /drawTable\(/);
  assert.ok(app.indexOf("body.append(taskTable(data.tasks))") >= 0);
  assert.ok(app.indexOf("body.append(taskTable(data.tasks))") < app.indexOf("body.append(booklet(data))"));
  assert.match(app, /edition\.permissions\.showCaptureImages\s*&&\s*edition\.permissions\.distributionApproved\s*&&\s*edition\.permissions\.publicSiteApproved/);
  assert.ok(!/\binnerHTML\s*=/.test(app));
  assert.ok(!/window\.print\(\)/.test(app), "No pretend PDF download while images are unlicensed");
  assert.match(css, /@page\s*\{\s*size:A4 portrait/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.grade--7/);
  assert.match(css, /\.grade--8/);
  assert.match(css, /\.grade--9/);
  assert.match(css, /--sheet-divider:#075861/);
  assert.match(css, /#coming \.event--tnufa-guidance/);
  assert.match(app, /function tracksTable\(tasks\)/);
  assert.match(app, /task-table-block/);
  assert.doesNotMatch(app, /make\("details",\s*"task"\)/);
  assert.match(app, /items\.map\(item/);
});
test("do not embed images from earlier project in public source", () => {
  const root = new URL("../", import.meta.url);
  const top = readdirSync(root, { withFileTypes: true }).map(f => f.name);
  assert.ok(!top.includes("captures"));
  assert.ok(!top.includes("booklet"));
  assert.ok(data.sources.photographRepo.includes("yaniv-raz-math-presentation"));
  assert.ok(!data.permissions.distributionApproved);
});

test("one private local booklet builder, no unsafe public artifact release", () => {
  const root = new URL("../", import.meta.url);
  const scripts = readdirSync(new URL("../scripts/", import.meta.url));
  const actions = readdirSync(new URL("../.github/workflows/", import.meta.url));
  assert.equal(scripts.filter(x => /booklet.*\.mjs$/.test(x)).length, 1);
  assert.ok(scripts.includes("build-private-booklet.mjs"));
  assert.ok(!actions.includes("build-booklet.yml"));
  assert.ok(!actions.includes("private-booklet-review.yml"));
  const generator = readFileSync(new URL("../scripts/build-private-booklet.mjs",import.meta.url), "utf8");
  assert.match(generator, /SIKUM10_ORIGINAL_REPO/);
  assert.match(generator, /sourceRead\(entry\.part\.file\)/);
  assert.match(generator, /photographManifestSha/);
  assert.match(generator, /data\.tasks\.flatMap\(task => \{/);
  assert.match(generator, /sourceRead\("manifest\.json"\)/);
  assert.ok(!generator.includes("raw.githubusercontent.com"));
  assert.ok(!generator.includes("await fetch("));
  assert.ok(!generator.includes("upload-artifact"));
  assert.ok(!generator.includes("git push"));
  assert.match(generator, /PDFDocument\.load/);
  assert.match(generator, /document\.getPageCount\(\)/);
});

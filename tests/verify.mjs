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
  assert.equal(data.edition.weekday, "יום ראשון");
  assert.equal(data.edition.hebrewDate, "כ״ח בחשוון תשפ״ז");
  assert.equal(data.edition.series, "שבוע טוב");
  assert.ok(!/סיכום שבועי/.test(app + html + JSON.stringify(data.edition)), "headline must not say סיכום שבועי");
  assert.equal(data.edition.title, "פותחים שבוע");
  assert.ok(!/פרשת|שבת שלום/.test(JSON.stringify(data.edition)));
  assert.equal(data.permissions.distributionApproved, false);
  assert.equal(data.permissions.showCaptureImages, false);
  assert.equal(data.permissions.publicSiteApproved, false);
});
test("edition date, weekday and Hebrew date agree with the calendar", () => {
  const he = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("he-IL-u-ca-hebrew",
    { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
  assert.match(he(data.edition.date), /^יום ראשון, 28 בחשוון 5787$/);
  assert.equal(data.edition.weekday, "יום ראשון");
  const weekday = iso => new Date(iso + "T12:00:00Z").toLocaleDateString("he-IL", { weekday: "long", timeZone: "UTC" });
  assert.equal("יום " + weekday(data.edition.date).replace(/^יום /, ""), data.edition.weekday);
  for (const e of data.events) {
    const [d, m, y] = e.date.split(".");
    assert.equal(weekday(y + "-" + m + "-" + d).replace(/^יום /, ""), e.day, "weekday mismatch for " + e.date);
  }
  const nov25 = data.events.find(e => e.date === "25.11.2026");
  assert.match(he("2026-11-25"), /15 בכסלו/);
  assert.match(nov25.details, /ט״ו בכסלו/);
});
test("cover wording mirrors earlier summaries and has no parasha or weekend blessing", () => {
  assert.equal(data.edition.field, "מתמטיקה · חטיבות הביניים");
  assert.equal(data.edition.region, "הדרכה במחוז ירושלים והעיר ירושלים – מנח״י");
  assert.equal(data.edition.lead, "בהובלת איילת קריספין");
  assert.equal(data.edition.credit, "יניב רז | מדריך מחוזי חט״ב בעיר ירושלים");
  assert.match(app, /issueLabel\(edition\)/);
  assert.ok(!/פרשת|שבת שלום/.test(app + html + JSON.stringify(data.edition)));
  // Edition facts live in data/edition.json only: the static page may not repeat the weekly figures.
  assert.ok(!/<(header|footer)\b/.test(html), "static HTML must not hard-code masthead or footer text");
});
test("unverified submission windows are always flagged", () => {
  assert.match(app, /s\.verification === "verified" \? "" : " \(טעון אימות\)"/);
  const g7 = data.tasks.find(t => t.id === "g7-assessment-1");
  assert.equal(g7.submission.filter(s => s.verification !== "verified").length, 1);
});
test("coming table has date, event, course number, time and link columns", () => {
  assert.match(app, /\["תאריך", "האירוע", "מצפ״ן", "שעה", "קישור"\]/);
});
test("complete unique sections and editorial accuracy", () => {
  assert.equal(data.news.length, 3);
  assert.equal(data.events.length, 10);
  assert.equal(data.courses.length, 10);
  assert.equal(data.curriculum.length, 10);
  assert.equal(data.model.length, 8);
  assert.equal(data.news[0].id, "tnufa");
  assert.equal(data.news[1].id, "training");
  assert.equal(data.news[2].id, "resources");
  assert.ok(!data.events.some(e => /מרצה:|בהנחיית/.test(e.title)));
  assert.ok(data.events.some(e => e.date === "17.11.2026" && e.status === "time-unverified" && e.verifiedTime === null));
  assert.ok(data.events.some(e => e.date === "18.11.2026" && e.status === "proposed"));
  assert.ok(data.curriculum.some(x => x.grade === "ט׳" && x.track === ""), "regular ninth-grade rows carry no track label");
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
  assert.match(app, /p\.showCaptureImages && p\.distributionApproved && p\.publicSiteApproved/);
  assert.ok(!/\binnerHTML\s*=/.test(app));
  assert.ok(!/window\.print\(\)/.test(app), "No pretend PDF download while images are unlicensed");
  assert.match(css, /@page\s*\{\s*size:A4 portrait/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\.grade--7/);
  assert.match(css, /\.grade--8/);
  assert.match(css, /\.grade--9/);
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

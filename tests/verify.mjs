// Static gate for the published Summary 10 edition (the only edition file in this repo).
// No network, no writes. Run: npm run check
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../editions/2026-11-22/final/index.html", import.meta.url), "utf8");
const body = html.slice(html.indexOf("<body"));
const text = body.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");

test("identity: number, dates, title", () => {
  assert.match(text, /סיכום מס׳ 10/);
  assert.match(text, /22\.11\.2026/);
  assert.match(text, /י״ב בכסלו תשפ״ז/);
  assert.match(html, /<title>[^<]*פותחים שבוע/);
});

test("pages are numbered 2..N without gaps", () => {
  const folios = [...body.matchAll(/<section[^>]*class="folio[^"]*"/g)].length;
  const nums = [...body.matchAll(/<span>(\d{2}) \/ (\d{2})<\/span>/g)];
  assert.ok(folios >= 10, `too few pages: ${folios}`);
  for (const m of nums) assert.equal(Number(m[2]), folios, `folio total ${m[2]} != ${folios}`);
  assert.deepEqual(nums.map((m) => Number(m[1])), Array.from({ length: folios - 1 }, (_, i) => i + 2));
});

test("unique ids and no dead internal anchors", () => {
  const ids = [...body.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids");
  for (const [, href] of body.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.includes(href), `dead anchor #${href}`);
});

test("owner-removed wording and private links stay out", () => {
  for (const banned of ["לוח מועדים", "תמונת מצב", "הבהרה מקצועית", "יומן מעודכן", "לפי בית הספר", "לפי הנחיות בית הספר",
    "ModEL", "חוברת דיגיטלית", "שימוש בכיתה", "בגישה ישירה מהסיכום", "ציבור הערבי", "84572359840"]) {
    assert.ok(!text.includes(banned), `banned text present: ${banned}`);
  }
  assert.ok(!/rama\.gov\.il\/assessments\/tnufa/.test(body), "Tnufa row must link only to the district site");
  assert.ok(!/class="closing-links"/.test(body), "closing-page buttons were removed by the owner");
});

test("Tnufa appears in one place only", () => {
  assert.equal([...body.matchAll(/class="[^"]*tnufa-row/g)].length, 1);
});

test("motivation journal: giant 5, title page, five move pages", () => {
  assert.match(body, /id="motivation-1"[\s\S]*?class="mj-five-num"[^>]*>5</);
  assert.match(body, /id="motivation-2"/);
  for (let k = 1; k <= 5; k++) assert.match(body, new RegExp(`id="motivation-move-${k}"`));
});

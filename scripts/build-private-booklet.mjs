import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

const root = resolve(import.meta.dirname, "..");
const data = JSON.parse(await readFile(join(root, "data/edition.json"), "utf8"));
const sha = data.sources.photographCommitSha;
if (!/^[0-9a-f]{40}$/.test(sha)) throw Error("Original source commit is not pinned");
if (data.tasks.length !== 6 ||
    data.tasks.reduce((sum, task) => sum + task.questionCount, 0) !== 36)
  throw Error("Task or question count mismatch");
const images = data.tasks.flatMap(task => task.items.flatMap(item =>
  item.parts.map((part, index) => ({ task, item, part, index }))
));
if (images.length !== 43) throw Error("Not exactly 43 original photograph parts");
const work = join(root, ".private-output");
const imageDirectory = join(work, "images");
await mkdir(imageDirectory, { recursive: true });
const escape = value => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const date = iso => /^\d{4}-\d{2}-\d{2}$/.test(iso || "") ?
  iso.slice(8,10) + "." + iso.slice(5,7) + "." + iso.slice(0,4) : "מועד לא אומת";
// Read the source Git tree at the exact pinned commit, not a website or working tree.
 // The original repository is never checked out, modified, committed or pushed by this script.
const originalRepo = process.env.SIKUM10_ORIGINAL_REPO;
if (!originalRepo) throw Error("Set SIKUM10_ORIGINAL_REPO to the local read-only original Git repository");
const sourceGit = resolve(originalRepo);
const sourceRead = file => execFileSync("git",
  ["-C", sourceGit, "show", sha + ":public/content/" + file],
  { maxBuffer: 32 * 1024 * 1024, stdio: ["ignore","pipe","pipe"] });
const manifestBytes = sourceRead("manifest.json");
const blobSha = createHash("sha1").update(Buffer.concat([
  Buffer.from("blob " + manifestBytes.length + "\0"),manifestBytes
])).digest("hex");
if (blobSha !== data.sources.photographManifestSha) throw Error("Canonical manifest SHA mismatch");
const manifest = JSON.parse(manifestBytes.toString("utf8"));
const manifestQuestions = new Map(manifest.questions.map(q => [q.id, q]));
if (manifest.tasks.length !== 6 || manifest.questions.length !== 42) throw Error("Original manifest is incomplete");
for (const task of data.tasks) {
  const originTask = manifest.tasks.find(t=>t.id===task.id);
  if (!originTask || originTask.title!==task.title ||
      originTask.expectedQuestionCount!==task.questionCount)
    throw Error("Task identity mismatch: " + task.id);
  for (const item of task.items) {
    const orig=manifestQuestions.get(item.id);
    if (!orig || orig.taskId!==task.id ||
        orig.parts.length!==item.parts.length ||
        item.parts.some((p,i)=>p.file!==orig.parts[i].file))
      throw Error("Photo assignment changed: " + item.id);
  }
}
const results = Array(images.length);

async function downloadOriginal(entry, i) {
  if (!/^[a-zA-Z0-9/_-]+\.png$/.test(entry.part.file))
    throw Error("Unexpected photograph pathname");
  const bytes = sourceRead(entry.part.file);
  if (bytes.length < 2000 || bytes.subarray(0,8).toString("hex") !== "89504e470d0a1a0a")
    throw Error("Invalid source PNG: " + entry.part.file);
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== entry.part.width || height !== entry.part.height)
    throw Error("Original photo changed: " + entry.part.file);
  const filename = String(i+1).padStart(3,"0") + ".png";
  await writeFile(join(imageDirectory, filename), bytes);
  results[i] = { task: entry.task, item: entry.item, part: entry.part, filename,
    sha256: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.length };
}
let cursor = 0;
async function worker() {
  while (cursor < images.length) {
    const i = cursor++;
    await downloadOriginal(images[i], i);
  }
}
await Promise.all(Array.from({length:4}, worker));
if (results.filter(Boolean).length !== 43) throw Error("Incomplete original photo download");

const css = await readFile(join(root, "assets/private-booklet.css"), "utf8");
function page(body, name) {
  return '<section class="page ' + (name || "") + '">' + body +
    '<div class="footer">פותחים שבוע · סיכום שבועי מספר 10 · ' +
    escape(data.edition.region) + '</div></section>';
}
const book = [];
book.push(page(
  '<p class="mast">' + escape(data.edition.region) + '</p>' +
  '<h1>פותחים שבוע</h1><h2>חוברת המשימות ב־ModEL</h2>' +
  '<p class="sub">משימות החובה וההערכה · כיתות ז׳–ח׳</p>' +
  '<p class="date">' + escape(data.edition.displayDate) + '</p>' +
  '<div class="line"></div>' +
  '<p class="credit">' + escape(data.edition.lead) + '<br>' +
  escape(data.edition.credit) + '</p>' +
  '<p class="greeting">' + escape(data.edition.greeting) + '</p>',
  "hero"
));
const rows = data.tasks.flatMap(task => {
  const options=task.submission.length ? task.submission : [null];
  const color=task.grade==="ז׳" ? "g7" : "g8";
  const link = /^https:\/\/moodlemoe\.lms\.education\.gov\.il\//.test(task.sourceUrl) ?
    '<a href="' + escape(task.sourceUrl) + '">למשימה</a>' : "";
  return options.map(option => '<tr><td class="' + color + '">' + escape(task.grade) +
    '</td><td>' + escape(task.kind) + '</td><td>' + escape(task.title) +
    '</td><td>' + escape(option?.track || "—") + '</td><td>' + date(option?.from) +
    '</td><td><strong>' + date(option?.to) + '</strong></td><td>' + link + '</td></tr>');
}).join("");
book.push(page(
  '<div class="head"><p class="sup">ריכוז משימות ומועדי הגשה</p>' +
  '<h2>מה צריך להגיש ב־ModEL?</h2>' +
  '<p class="meta">כל שש המשימות המקוריות בפתיחת החוברת</p></div>' +
  '<table><thead><tr><th style="width:8%">שכבה</th><th style="width:10%">סוג</th>' +
  '<th style="width:30%">משימה</th><th style="width:12%">מסלול</th>' +
  '<th style="width:14%">פתיחה</th><th style="width:14%">סיום</th>' +
  '<th style="width:12%">ModEL</th></tr></thead><tbody>' + rows + '</tbody></table>' +
  '<div class="notice">המועדים המעודכנים חלים על משימת ההערכה הראשונה בלבד:' +
  ' כיתה ח׳ עד 13.11.2026, כיתה ז׳ עד 20.11.2026.' +
  ' לגבי ארבע משימות החובה אין מועד הגשה מאומת במקור.</div>' +
  '<div class="coverage">בחוברת: שש משימות, 36 שאלות, שישה פריטי הקשר ו־43 חלקי צילום מקוריים.</div>',
  "summary"
));
book.push(page(
  '<div class="head"><p class="sup">לפי שכבות ומשימות</p><h2>תוכן העניינים</h2></div>' +
  '<div class="toc">' + data.tasks.map((task,index) =>
    '<div class="item"><div class="grade">' + escape(task.grade) +
    ' · ' + escape(task.kind) + ' · ' + (index+1) + '</div>' +
    '<div class="title">' + escape(task.title) + '</div></div>').join("") + '</div>',
  "contents"
));
for (const task of data.tasks) {
  const range = task.submission.length ?
    task.submission.map(s => escape(s.track) + ': ' + date(s.from) + ' עד ' +
      date(s.to) + (s.verification === "requires-confirmation" ? ' (טעון אימות לפני הפצה)' : "")).join('<br>') :
    "מועד הגשה לא אומת במקור.";
  const sourceLink = /^https:\/\/moodlemoe\.lms\.education\.gov\.il\//.test(task.sourceUrl) ?
    '<a href="' + escape(task.sourceUrl) + '">המשימה המקורית ב־ModEL</a>' : '';
  book.push(page(
    '<div class="grade">כיתה ' + escape(task.grade) + ' · ' + escape(task.kind) + '</div>' +
    '<h2>' + escape(task.title) + '</h2>' +
    '<p class="meta">משימה מקורית · ' + task.questionCount + ' שאלות</p>' +
    '<div class="terms"><p><strong>חלונות ביצוע והגשה:</strong><br>' + range +
    '</p>' +
    (task.photoTrackCaution ? '<p class="warning">' + escape(task.photoTrackCaution) + '</p>' : '') +
    '<p>' + sourceLink + '</p></div>',
    "task-cover"
  ));
  const taskPhotos = results.filter(record => record.task.id === task.id);
  for (const photo of taskPhotos) {
    const item = photo.item;
    const name = item.label || "שאלה " + item.number;
    const header = '<div class="head"><p class="sup">כיתה ' +
      escape(task.grade) + ' · ' + escape(task.title) +
      '</p><h2>' + escape(name) + '</h2><p class="meta">' +
      (item.parts.length > 1 ? "חלק " + (photo.part === item.parts[0] ? 1 : 2) +
        " מתוך " + item.parts.length : "צילום מקור") + '</p></div>';
    const img = '<div class="photo"><img src="images/' + photo.filename + '" width="' +
      photo.part.width + '" height="' + photo.part.height + '" alt="' + escape(name) + '"></div>';
    const foot = '<p class="caption">' + escape(name) + ' · ' + escape(task.title) + '</p>';
    book.push(page(header + img + foot, "capture"));
  }
}
const html = '<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">' +
  '<title>חוברת המשימות במודל · סיכום 10</title><style>' + css +
  '</style></head><body>' + book.join("\n") + '</body></html>';
const htmlPath = join(work, "booklet.html");
await writeFile(htmlPath, html);
const browser = await chromium.launch();
try {
  const pageInstance = await browser.newPage({viewport:{width:900,height:1200}});
  await pageInstance.goto(pathToFileURL(htmlPath).href,{waitUntil:"load",timeout:60000});
  const dimensions = await pageInstance.evaluate(async () => {
    const list = Array.from(document.images);
    await Promise.all(list.map(image => image.decode()));
    return list.map(image => ({width:image.naturalWidth,height:image.naturalHeight}));
  });
  if (dimensions.length !== 43) throw Error("Printed document image count mismatch");
  for (let i=0;i<dimensions.length;i++) {
    if (dimensions[i].width !== results[i].part.width ||
        dimensions[i].height !== results[i].part.height)
      throw Error("Printed image dimension mismatch: " + results[i].part.file);
  }
  const pdfPath = join(work,"booklet_modell_sikum10_private.pdf");
  const pdf = await pageInstance.pdf({path:pdfPath,preferCSSPageSize:true,printBackground:true,
    displayHeaderFooter:false,margin:{top:"0",right:"0",bottom:"0",left:"0"}});
  const document = await PDFDocument.load(pdf);
  if (document.getPageCount() !== book.length)
    throw Error("Page count mismatch: expected " + book.length + " got " + document.getPageCount());
  for (const page of document.getPages()) {
    const size = page.getSize();
    if (Math.abs(size.width-595.28)>1 || Math.abs(size.height-841.89)>1)
      throw Error("A non-portrait page was generated: "+JSON.stringify(size));
  }
  const report = {
    status:"PRIVATE_RENDER_VERIFIED_NOT_PUBLISHED",
    sourceCommit:sha,sourcePartCount:43,
    embeddedPartCount:dimensions.length,
    questionCount:36,contextualItems:6,taskCount:6,
    portrait:true,PDFPages:document.getPageCount(),
    pdfBytes:pdf.length,
    sha256:createHash("sha256").update(pdf).digest("hex"),
    distributionApproved:data.permissions.distributionApproved,
    publicUrl:null
  };
  await writeFile(join(work,"report.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  await browser.close();
}

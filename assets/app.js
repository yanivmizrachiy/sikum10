"use strict";
// Source of truth: data/edition.json. Photographs remain disabled until explicitly approved.
const DATA_FILE = "./data/edition.json";
function make(tag, className, value) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (value !== undefined && value !== null) e.textContent = String(value);
  return e;
}
function append(parent, ...children) {
  for (const child of children.flat()) {
    if (child === undefined || child === null || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}
function safeUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && u.hostname.length > 0 && !u.username && !u.password;
  } catch (_) { return false; }
}
function external(url, text, className) {
  if (!safeUrl(url)) return null;
  const a = make("a", className || "link", text);
  a.href = url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  return a;
}
function sourceLink(url, title) {
  return external(url, title || "למקור", "table-link") || make("span", "subtle", "ללא קישור מאומת");
}
function fmt(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso || "")) return "מועד לא אומת";
  return iso.slice(8, 10) + "." + iso.slice(5, 7) + "." + iso.slice(0, 4);
}
function cssGrade(grade) {
  return grade === "ז׳" ? "grade--7" : grade === "ח׳" ? "grade--8" : "grade--9";
}
function titleBar(id, count, heading, description) {
  const section = make("section", "section container");
  section.id = id;
  section.setAttribute("aria-labelledby", id + "-title");
  const header = make("header", "section__head");
  const title = make("h2", "section__title", heading);
  title.id = id + "-title";
  append(header, title, make("span", "section__number", String(count).padStart(2, "0")));
  append(section, header, make("div", "section__rule"));
  if (description) section.append(make("p", "section__intro", description));
  const body = make("div", "section__body");
  section.append(body);
  return { section, body };
}
function drawTable(headings, rows, caption, widths) {
  const frame = make("div", "table-frame");
  const table = make("table");
  if (caption) table.append(make("caption", "table-caption", caption));
  if (widths) {
    const cols = make("colgroup");
    for (const width of widths) {
      const c = make("col");
      c.style.width = width + "%";
      cols.append(c);
    }
    table.append(cols);
  }
  const head = make("thead");
  const trHead = make("tr");
  for (const h of headings) {
    const th = make("th", null, h);
    th.scope = "col";
    trHead.append(th);
  }
  head.append(trHead);
  table.append(head);
  const tbody = make("tbody");
  for (const row of rows) {
    const tr = make("tr");
    for (const item of row) {
      const td = make("td");
      if (item && typeof item === "object" && "grade" in item) {
        td.className = "grade-cell " + cssGrade(item.grade);
        td.append(item.element);
      } else if (item instanceof Node) {
        td.append(item);
      } else {
        td.textContent = item === null || item === undefined ? "" : String(item);
      }
      tr.append(td);
    }
    tbody.append(tr);
  }
  table.append(tbody);
  frame.append(table);
  return frame;
}
function check(data) {
  if (!data || data.edition?.number !== 10 || data.edition?.date !== "2026-11-08")
    throw Error("Invalid edition identity");
  const expected = { news: 3, events: 10, curriculum: 10, courses: 10, tasks: 6, model: 8 };
  for (const [field, count] of Object.entries(expected)) {
    if (!Array.isArray(data[field]) || data[field].length !== count)
      throw Error("Invalid section: " + field);
  }
  if (data.tasks.some(t => !["ז׳", "ח׳"].includes(t.grade)))
    throw Error("Unexpected task grade");
  if (data.tasks.reduce((n, t) => n + t.questionCount, 0) !== 36)
    throw Error("Expected 36 questions");
  if (data.tasks.flatMap(t => t.items.flatMap(i => i.parts)).length !== 43)
    throw Error("Expected 43 photograph parts");
  if (!data.permissions || !data.sources?.sheetUrl) throw Error("Missing permissions");
  if (!/^[0-9a-f]{40}$/.test(data.sources.photographCommitSha || ""))
    throw Error("Unpinned photograph source");
  // Fail closed even when a future edit toggles just one approval bit.
  if (data.permissions.showCaptureImages &&
     (!data.permissions.distributionApproved || !data.permissions.publicSiteApproved))
    throw Error("Photograph publication not approved");
  return data;
}
function cover(root, edition) {
  const header = make("header", "hero");
  const grid = make("div", "container hero__grid");
  const prose = make("div");
  const lines = make("div", "hero__byline");
  append(lines,
    make("p", null, edition.field),
    make("p", null, edition.lead),
    make("p", null, edition.credit)
  );
  append(prose,
    make("p", "eyebrow", edition.region),
    make("h1", null, edition.title),
    make("p", "hero__subtitle", edition.subtitle),
    make("p", "hero__date", edition.displayDate),
    lines,
    make("span", "hero__greeting", edition.greeting)
  );
  const emblem = make("div", "emblem");
  const ring = make("span", "emblem__ring");
  ring.setAttribute("aria-hidden", "true");
  const logo = make("img");
  logo.src = "./assets/district-logo.png";
  logo.alt = "סמל מחוז ירושלים";
  logo.loading = "eager";
  logo.addEventListener("error", () => {
    logo.hidden = true;
    emblem.setAttribute("aria-label", "מחוז ירושלים");
  });
  append(emblem, ring, logo);
  append(grid, prose, emblem);
  header.append(grid);
  root.append(header);
}
function navigation(root) {
  const nav = make("nav", "nav-strip");
  nav.setAttribute("aria-label", "ניווט בין מדורי הסיכום");
  const inner = make("div", "container");
  [
    ["news", "מה חדש השבוע"],
    ["coming", "מה צפוי"],
    ["courses", "מפגשי השתלמות"],
    ["teaching", "מה אנחנו מלמדים"],
    ["model", "מה צריך לעשות במודל"]
  ].forEach(([id, text]) => {
    const a = make("a", null, text);
    a.href = "#" + id;
    inner.append(a);
  });
  nav.append(inner);
  root.append(nav);
}
function news(root, items) {
  const { section, body } = titleBar("news", 1, "מה חדש השבוע?", "שלושה עדכונים למורי המתמטיקה בחטיבת הביניים");
  const grid = make("div", "news-grid");
  items.forEach((item, index) => {
    const card = make("article", "news-card");
    append(card,
      make("span", "card__kicker", "ידיעה " + (index + 1)),
      make("h3", null, item.title),
      make("p", null, item.description)
    );
    if (item.course) card.append(make("p", "course-number", "מצפ״ן " + item.course + " · " + item.fullName));
    const a = external(item.url, item.linkText || "למקור");
    if (a) card.append(a);
    if (item.id === "training") {
      const registration = external("https://mpm.education.gov.il/rishum", "לרישום במצפ״ן", "link link--outline");
      if (registration) {
        registration.style.marginInlineStart = "10px";
        card.append(registration);
      }
    }
    if (item.footnote) card.append(make("p", "note", item.footnote));
    grid.append(card);
  });
  body.append(grid);
  root.append(section);
}
function coming(root, items) {
  const { section, body } = titleBar("coming", 2, "מה צפוי?", "תאריך, שם ההשתלמות המלא ומצפ״ן — ללא שמות מרצים");
  const rows = items.map(e => {
    const date = make("div");
    append(date, make("strong", "date-strong", e.date), make("div", "subtle", e.day));
    const topic = make("div");
    topic.append(make("strong", null, e.title));
    if (e.course) topic.append(make("div", "subtle course-number", "מצפ״ן / פתרון למידה: " + e.course));
    if (e.status === "proposed") topic.append(make("p", "subtle", "מועד מוצע, טעון אישור"));
    const details = make("div");
    const time = e.status === "time-unverified" ? "השעה טרם אומתה" : e.time;
    append(details, make("strong", null, time), make("div", "subtle", e.details));
    if (e.url) details.append(sourceLink(e.url, "לפרטים"));
    return [date, topic, details];
  });
  body.append(drawTable(
    ["תאריך", "האירוע ומספר מצפ״ן", "שעה ופרטים"],
    rows, "אירועי נובמבר 2026", [24, 42, 34]
  ));
  root.append(section);
}
function courses(root, items, newsItems) {
  const training = newsItems.find(item => item.id === "training");
  if (!training || !training.fullName || !training.course)
    throw Error("Course title missing from canonical data");
  const synchronous = items.filter(item => item.mode === "סינכרוני").length;
  const asynchronous = items.length - synchronous;
  const { section, body } = titleBar(
    "courses", 3, "מפגשי ההשתלמות",
    training.fullName + " · מצפ״ן " + training.course + " · המועדים מוצעים בסילבוס"
  );
  const rows = items.map((e, i) => {
    const date = make("div");
    append(date, make("strong", null, String(i + 1)), make("div", "subtle", e.date));
    const details = make("div");
    append(details, make("strong", null, e.topic), make("p", "subtle", e.description));
    return [date, e.mode, details, sourceLink(e.syllabus, "לסילבוס")];
  });
  body.append(drawTable(
    ["מפגש ותאריך", "סוג", "הנושא ותיאורו", "מקור"],
    rows, synchronous + " מפגשים סינכרוניים ו־" + asynchronous + " א־סינכרוניים", [20, 20, 46, 14]
  ));
  root.append(section);
}
function teaching(root, items) {
  const { section, body } = titleBar(
    "teaching", 4, "מה אנחנו מלמדים?", "פריסת נובמבר תשפ״ז — טבלה מדויקת לפי שכבה ומסלול"
  );
  const rows = items.map(e => [
    { grade: e.grade, element: make("strong", null, e.grade) },
    make("strong", null, e.track),
    make("strong", null, e.domain),
    e.subjects,
    sourceLink(e.url, "לפריסה")
  ]);
  const desktopTable = drawTable(
    ["שכבה", "מסלול", "תחום", "הנושאים ותתי־הנושאים", "מקור"],
    rows, "שכבה ז׳ — כחול · ח׳ — ירוק־כחול · ט׳ — בורדו", [11, 17, 17, 42, 13]
  );
  desktopTable.classList.add("table-frame--desktop");
  const compactRows = items.map(e => {
    const grade = make("div");
    append(grade, make("strong", null, e.grade), make("div", "subtle", e.track));
    const subjects = make("div");
    append(subjects, make("strong", null, e.domain), make("div", null, e.subjects));
    return [{grade:e.grade,element:grade}, subjects, sourceLink(e.url,"לפריסה")];
  });
  const mobileTable = drawTable(
    ["שכבה ומסלול", "נושאים ותתי־נושאים", "מקור"],
    compactRows, "פריסות נובמבר · טבלת נייד", [26, 58, 16]
  );
  mobileTable.classList.add("table-frame--mobile");
  body.append(desktopTable, mobileTable);
  root.append(section);
}
function deadline(task) {
  if (!task.submission.length) return "מועד הגשה לא אומת";
  return [...new Set(task.submission.map(s => fmt(s.to)))].join(" / ");
}
function tracks(task) {
  if (!task.submission.length) return "לא אומת מועד למשימת חובה";
  return task.submission.map(s => s.track + ": " + fmt(s.from) + "–" + fmt(s.to)).join(" | ");
}
function taskTable(tasks) {
  const rows = tasks.map(t => {
    const due = make("div");
    append(due, make("strong", "date-strong", deadline(t)), make("div", "subtle", tracks(t)));
    return [
      { grade: t.grade, element: make("strong", null, t.grade) },
      make("strong", null, t.title),
      t.kind, due, sourceLink(t.sourceUrl, "למשימה")
    ];
  });
  const desktop = drawTable(
    ["שכבה", "משימה שיש לבצע ולהגיש", "סוג", "חלון ומועד הגשה", "ModEL"],
    rows, "טבלה מסכמת בתחילת מדור ModEL — 6 משימות מקור", [10, 31, 13, 32, 14]
  );
  desktop.classList.add("table-frame--desktop");
  const compact = tasks.map(t=>{
    const name = make("div");
    append(name, make("strong", null, t.title), make("div", "subtle", t.kind));
    const due = make("div");
    append(due, make("strong", "date-strong", deadline(t)),
      make("div", "subtle", tracks(t)), sourceLink(t.sourceUrl,"למשימה"));
    return [{grade:t.grade,element:make("strong",null,t.grade)},name,due];
  });
  const mobile = drawTable(["שכבה","משימה וסוג","הגשה וקישור"],
    compact, "טבלת הגשות · מותאמת לנייד", [13,44,43]);
  mobile.classList.add("table-frame--mobile");
  const result = make("div");
  append(result,desktop,mobile);
  return result;
}
function taskDetail(task, edition) {
  const detail = make("details", "task");
  detail.id = "task-" + task.id;
  const summary = make("summary");
  append(summary, make("span", "task__name", task.grade + " · " + task.title),
    make("span", "task__badge", task.kind));
  detail.append(summary);
  const body = make("div", "task__body");
  body.append(make("p", null, task.questionCount + " שאלות מקור · " + task.kind));
  if (task.submission.length) {
    body.append(make("p", null, "מועדי הגשה לפי מסלול: " + tracks(task)));
    if (task.submission.some(s => s.verification === "requires-confirmation"))
      body.append(make("p", "task__warning", "מועד מסלול עמ״ט בכיתה ז׳ טעון אימות פרטני לפני הפצה."));
    if (task.photoTrackCaution)
      body.append(make("p", "task__warning", task.photoTrackCaution));
  } else {
    body.append(make("p", "task__warning",
      "מועד ההגשה למשימה זו אינו מופיע במניפסט המקורי. אין להסיק תאריך מהחודש שבו פורסמה."));
  }
  const source = external(task.sourceUrl, "פתיחת המשימה המקורית ב־ModEL");
  if (source) body.append(source);
  // A public commit must never unexpectedly surface source photos: all gates must pass.
  const p = edition.permissions;
  const allowPhotos = p.showCaptureImages && p.distributionApproved && p.publicSiteApproved;
  if (!allowPhotos) {
    body.append(make("p", "photo-unavailable",
      "הצילומים המקוריים מופו לפי שאלה וחלק, אך הצגתם והפצתם ממתינות לאישור זכויות ולהשלמת חוברת ההורדה. המשימה המקורית זמינה בקישור ModEL."));
  } else {
    const base = "https://raw.githubusercontent.com/" +
      edition.sources.photographRepo + "/" + edition.sources.photographCommitSha + "/" + edition.sources.photographBasePath;
    task.items.forEach(item => {
      const figure = make("figure", "source-photo");
      item.parts.forEach(part => {
        const image = make("img");
        image.src = base + part.file;
        image.alt = item.label || ("משימה " + task.title + " — שאלה " + item.number);
        image.width = part.width;
        image.height = part.height;
        image.loading = "lazy";
        figure.append(image);
      });
      figure.append(make("figcaption", null, item.label || "שאלה " + item.number));
      body.append(figure);
    });
  }
  detail.append(body);
  return detail;
}
function booklet(data) {
  const article = make("article", "booklet");
  article.id = "booklet";
  const head = make("header", "booklet__head");
  append(head,
    make("span", "booklet__tag", "חוברת נלווית · סיכום שבועי מספר 10"),
    make("h3", null, "משימות החובה וההערכה ב־ModEL — מועדים והגשות"),
    make("p", null, "חוברת חדשה לאורך לכיתות ז׳–ח׳, המבוססת על המצגת והצילומים המקוריים."),
    make("p", "subtle",
      data.tasks.length + " משימות · " +
      data.tasks.reduce((total, t) => total + t.questionCount, 0) + " שאלות · " +
      (data.tasks.flatMap(t => t.items).length - data.tasks.reduce((total, t) => total + t.questionCount, 0)) +
      " פריטי הקשר · " + data.tasks.flatMap(t => t.items.flatMap(i => i.parts)).length +
      " חלקי צילום מופו במקור.")
  );
  article.append(head);
  const nav = make("nav", "nav-strip");
  nav.setAttribute("aria-label", "תוכן עניינים של החוברת");
  const navInner = make("div", "container");
  data.tasks.forEach((task, i) => {
    const a = make("a", null, task.grade + " · " + String(i + 1) + ". " + task.title);
    a.href = "#task-" + task.id;
    navInner.append(a);
  });
  nav.append(navInner);
  article.append(nav);
  ["ז׳", "ח׳"].forEach(grade => {
    const h = make("h4", "section__title", "משימות כיתה " + grade);
    h.style.marginBlock = "24px 12px";
    article.append(h);
    data.tasks.filter(t => t.grade === grade).forEach(t => article.append(taskDetail(t, data)));
  });
  // No misleading PDF/download/share buttons until a real licensed file exists.
  article.append(make("div", "notice",
    "הורדה ושיתוף של החוברת המלאה יופעלו רק לאחר שילוב כל הצילומים, בדיקת הקובץ ואישור הפצה. בשלב זה ניתן לפתוח את המשימות ב־ModEL."));
  return article;
}
function model(root, data) {
  const { section, body } = titleBar(
    "model", 5, "מה צריך לעשות במודל",
    "בראש המדור: טבלה מסכמת של כל המשימות ומועדי ההגשה. אחריה החוברת הדיגיטלית החדשה לאורך."
  );
  body.append(taskTable(data.tasks));
  const assessments = data.tasks.filter(t => t.kind === "הערכה");
  const missingDates = data.tasks.filter(t => t.kind === "חובה" && t.missingDeadline).length;
  body.append(make("div", "notice",
    "מועדי ההערכה הראשונה המעודכנים: " +
    assessments.map(t => "כיתה " + t.grade + " עד " + deadline(t)).join("; ") +
    ". " + missingDates + " משימות חובה ללא מועד הגשה מאומת."));
  body.append(booklet(data));
  const heading = make("h3", "section__title", "הנחיות נוספות ב־ModEL");
  heading.style.marginBlock = "30px 14px";
  body.append(heading);
  const grid = make("div", "learning-grid");
  data.model.filter(m => m.type !== "חוברת דיגיטלית נלווית").forEach(m => {
    const card = make("article", "learning-item");
    append(card, make("h3", null, m.grade + " · " + m.type),
      make("p", null, m.title), make("p", "subtle", m.description));
    if (m.url) card.append(sourceLink(m.url, "למקור"));
    grid.append(card);
  });
  body.append(grid);
  root.append(section);
}
async function main() {
  const target = document.getElementById("main");
  try {
    const response = await fetch(DATA_FILE, { cache: "no-store" });
    if (!response.ok) throw Error("Unable to load edition data");
    const data = check(await response.json());
    const root = make("div");
    cover(root, data.edition);
    navigation(root);
    news(root, data.news);
    coming(root, data.events);
    courses(root, data.courses, data.news);
    teaching(root, data.curriculum);
    model(root, data);
    const notes = make("div", "container");
    notes.append(make("p", "subtle",
      "מהדורת " + data.edition.displayDate + ". מידע חסר ומועדים מוצעים אינם מוצגים כמאומתים. כל שינוי בפרסום מותנה בבקרת מקור."));
    notes.append(sourceLink(data.sources.sheetUrl, "מקור התכנון והבקרה"));
    root.append(notes);
    target.replaceChildren(root);
  } catch (err) {
    console.error("Summary 10 validation failed", err);
    const error = make("section", "status");
    error.setAttribute("role", "alert");
    append(error, make("h1", null, "לא ניתן להציג את הסיכום"),
      make("p", null, "נמצאה בעיה בטעינה או באימות הנתונים. כדי למנוע מידע שגוי, התצוגה נעצרה."),
      sourceLink("https://docs.google.com/spreadsheets/d/1xEchRCl2W5eV1WQEhQmmTLYuz_rr1UoXzS0gnf2BiBE/edit","קובץ התכנון"));
    target.replaceChildren(error);
  }
}
main();

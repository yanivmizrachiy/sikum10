"use strict";
// Source of truth: data/edition.json. Photographs remain disabled until explicitly approved.
const DATA_FILE = "./data/edition.json";
function make(tag, className, value) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (value instanceof Node) e.append(value);
  else if (value !== undefined && value !== null) e.textContent = String(value);
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
    if (row.rowClass) tr.className = row.rowClass;
    if (!Array.isArray(row)) {
      tr.className = "group-row";
      const th = make("th", "group-head " + cssGrade(row.grade), row.heading);
      th.colSpan = headings.length;
      th.scope = "colgroup";
      tr.append(th);
      tbody.append(tr);
      continue;
    }
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
  const expected = { news: 3, events: 10, curriculum: 10, courses: 10, tasks: 6 };
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
function issueLabel(edition) {
  return edition.journal + " / ISSUE " + String(edition.number).padStart(2, "0");
}
function cover(root, edition) {
  const header = make("header", "hero");
  const inner = make("div", "container hero__inner");
  const logo = make("img");
  logo.src = "./assets/district-logo.png";
  logo.alt = "סמל מחוז ירושלים";
  logo.loading = "eager";
  logo.width = 71;
  logo.height = 71;
  logo.addEventListener("error", () => { logo.hidden = true; });
  const issue = make("span", "hero__issue", issueLabel(edition));
  issue.dir = "ltr";
  const masthead = make("div", "hero__masthead");
  append(masthead, make("div", "hero__mark"), issue);
  masthead.firstChild.append(logo);
  const title = make("h1");
  append(title, make("span", null, edition.series),
    make("span", "hero__number", "מס׳ " + edition.number));
  const meta = make("div", "hero__meta");
  const dayLine = make("div", "hero__day");
  append(dayLine, edition.weekday + " | ");
  const dateText = make("span", null, fmt(edition.date));
  dateText.dir = "ltr";
  dayLine.append(dateText);
  append(meta, dayLine, make("div", "hero__hebrew", edition.hebrewDate));
  const credit = make("div", "hero__credit");
  append(credit,
    make("div", "hero__eyebrow", edition.field),
    make("div", "hero__district", edition.region),
    make("div", "hero__lead", edition.lead),
    make("div", "hero__writer", edition.credit));
  append(inner, masthead, title, make("div", "hero__rule"),
    make("p", "hero__edition", edition.title), meta, credit);
  header.append(inner);
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
    ["model", "מה צריך לעשות במודל?"]
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
// Clock ranges are left-to-right digits: isolate them so RTL does not print 21:30–19:00.
function ltr(text) {
  const span = make("span", "ltr", text);
  span.dir = "ltr";
  return span;
}
function eventTime(e) {
  const strong = make("strong");
  if (e.status === "time-unverified") strong.textContent = "השעה טרם אומתה";
  else if (/^[0-9]{2}:[0-9]{2}(–[0-9]{2}:[0-9]{2})?$/.test(e.time)) strong.append(ltr(e.time));
  else strong.textContent = e.time;
  return strong;
}
function eventTitle(e) {
  const topic = make("div");
  if (e.highlight) topic.append(make("span", "pill", e.highlight));
  topic.append(make("strong", null, e.title));
  if (e.status === "proposed" && !/טעון אישור/.test(e.details || ""))
    topic.append(make("p", "subtle", "מועד מוצע, טעון אישור"));
  if (e.details) topic.append(make("p", "subtle", e.details));
  return topic;
}
function eventDate(e, compact) {
  const date = make("div");
  if (compact) {
    append(date, make("strong", "date-strong", e.date.slice(0, 5)),
      make("div", "subtle", e.day + " · " + e.date.slice(6)));
  } else {
    append(date, make("strong", "date-strong", e.date), make("div", "subtle", e.day));
  }
  return date;
}
function coming(root, items) {
  const { section, body } = titleBar("coming", 2, "מה צפוי?", "תאריך, שם ההשתלמות המלא, מספר מצפ״ן, שעה וקישור — ללא שמות מרצים");
  const featured = (row, e) => Object.assign(row, { rowClass: e.highlight ? "row-featured" : "" });
  const full = items.map(e => featured([
    eventDate(e),
    eventTitle(e),
    e.course ? make("strong", "course-number", e.course) : make("span", "subtle", "—"),
    eventTime(e),
    e.url ? sourceLink(e.url, "לפרטים") : make("span", "subtle", "ללא קישור")
  ], e));
  const desktop = drawTable(
    ["תאריך", "האירוע", "מצפ״ן", "שעה", "קישור"],
    full, "אירועי נובמבר 2026", [13, 40, 11, 18, 18]
  );
  desktop.classList.add("table-frame--desktop");
  const compact = items.map(e => {
    const topic = eventTitle(e);
    if (e.course) topic.prepend(make("div", "course-number", "מצפ״ן " + e.course));
    const when = make("div");
    when.append(make("div", null, eventTime(e)));
    if (e.url) when.append(sourceLink(e.url, "לפרטים"));
    return featured([eventDate(e, true), topic, when], e);
  });
  const mobile = drawTable(
    ["תאריך", "האירוע ומצפ״ן", "שעה וקישור"],
    compact, "אירועי נובמבר 2026 · טבלת נייד", [19, 50, 31]
  );
  mobile.classList.add("table-frame--mobile");
  body.append(desktop, mobile);
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
    compactRows, "פריסות נובמבר · טבלת נייד", [24, 50, 26]
  );
  mobileTable.classList.add("table-frame--mobile");
  body.append(desktopTable, mobileTable);
  root.append(section);
}
function deadline(task) {
  if (!task.submission.length) return "ללא מועד הגשה מאומת";
  return [...new Set(task.submission.map(s => fmt(s.to)))].join(" / ");
}
function trackLines(task) {
  return task.submission.map(s => s.track + ": מ־" + fmt(s.from) + " עד " + fmt(s.to) +
    (s.verification === "verified" ? "" : " (טעון אימות)"));
}
function tracks(task) {
  return trackLines(task).join(" | ");
}
function groupHeading(kind, grade) {
  return (kind === "חובה" ? "משימות חובה" : "משימת הערכה") + " בכיתה " + grade;
}
function taskGroups(tasks) {
  const groups = [];
  for (const grade of ["ז׳", "ח׳"]) {
    for (const kind of ["חובה", "הערכה"]) {
      const list = tasks.filter(t => t.grade === grade && t.kind === kind);
      if (list.length) groups.push({ grade, kind, list });
    }
  }
  return groups;
}
function taskTable(tasks) {
  const groups = taskGroups(tasks);
  const dueCell = (t, withLink) => {
    const due = make("div");
    append(due, make("strong", "date-strong", deadline(t)),
      ...trackLines(t).map(line => make("div", "subtle", line)));
    if (withLink) due.append(sourceLink(t.sourceUrl, "למשימה"));
    return due;
  };
  const build = (headings, cells, caption, widths, cls) => {
    const rows = groups.flatMap(g => [
      { heading: groupHeading(g.kind, g.grade), grade: g.grade },
      ...g.list.map(t => cells(t))
    ]);
    const frame = drawTable(headings, rows, caption, widths);
    frame.classList.add(cls);
    return frame;
  };
  const desktop = build(
    ["משימה שיש לבצע ולהגיש", "חלון ומועד הגשה", "Moodle"],
    t => [make("strong", null, t.title), dueCell(t, false), sourceLink(t.sourceUrl, "למשימה")],
    "טבלה מסכמת בתחילת מדור Moodle — 6 משימות מקור", [46, 38, 16], "table-frame--desktop");
  const mobile = build(
    ["משימה", "הגשה וקישור"],
    t => [make("strong", null, t.title), dueCell(t, true)],
    "טבלת הגשות · מותאמת לנייד", [46, 54], "table-frame--mobile");
  const result = make("div");
  append(result, desktop, mobile);
  return result;
}
function taskDetail(task, edition) {
  const detail = make("details", "task");
  detail.id = "task-" + task.id;
  const summary = make("summary");
  append(summary, make("span", "task__name", task.title));
  detail.append(summary);
  const body = make("div", "task__body");
  body.append(make("p", null, task.questionCount + " שאלות מקור"));
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
  const source = external(task.sourceUrl, "פתיחת המשימה המקורית ב־Moodle");
  if (source) body.append(source);
  // A public commit must never unexpectedly surface source photos: all gates must pass.
  const p = edition.permissions;
  const allowPhotos = p.showCaptureImages && p.distributionApproved && p.publicSiteApproved;
  if (!allowPhotos) {
    body.append(make("p", "photo-unavailable",
      "הצילומים המקוריים מופו לפי שאלה וחלק, אך הצגתם והפצתם ממתינות לאישור זכויות ולהשלמת חוברת ההורדה. המשימה המקורית זמינה בקישור Moodle."));
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
    make("span", "booklet__tag", "חוברת נלווית · שבוע טוב מס׳ 10"),
    make("h3", null, "משימות החובה וההערכה ב־Moodle — מועדים והגשות"),
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
    const h = make("h4", "section__title", "משימות בכיתה " + grade);
    h.style.marginBlock = "24px 12px";
    article.append(h);
    data.tasks.filter(t => t.grade === grade).forEach(t => article.append(taskDetail(t, data)));
  });
  // No misleading PDF/download/share buttons until a real licensed file exists.
  article.append(make("div", "notice",
    "הורדה ושיתוף של החוברת המלאה יופעלו רק לאחר שילוב כל הצילומים, בדיקת הקובץ ואישור הפצה. בשלב זה ניתן לפתוח את המשימות ב־Moodle."));
  return article;
}
function model(root, data) {
  const { section, body } = titleBar(
    "model", 5, "מה צריך לעשות במודל?",
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
  root.append(section);
}
function footer(root, edition) {
  const tail = make("footer", "footer");
  const inner = make("div", "container");
  inner.append(make("p", null, edition.series + " מס׳ " + edition.number + " · " + edition.region));
  tail.append(inner);
  root.append(tail);
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
      "מהדורת " + data.edition.weekday + " " + fmt(data.edition.date) + " · " + data.edition.hebrewDate + ". מידע חסר ומועדים מוצעים אינם מוצגים כמאומתים. כל שינוי בפרסום מותנה בבקרת מקור."));
    notes.append(sourceLink(data.sources.sheetUrl, "מקור התכנון והבקרה"));
    root.append(notes);
    footer(root, data.edition);
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

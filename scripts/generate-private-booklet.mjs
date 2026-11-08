import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const root=process.cwd();
const source=path.join(root,"source/public/content");
const d=JSON.parse(fs.readFileSync("data/edition.json","utf8"));
const bytes=fs.readFileSync(path.join(source,"manifest.json"));
const m=JSON.parse(bytes.toString("utf8"));
const hash=crypto.createHash("sha1").update(Buffer.concat([Buffer.from("blob "+bytes.length+"\0"),bytes])).digest("hex");
if(hash!==d.sources.photographManifestSha)throw Error("Manifest SHA changed");
if(d.permissions.distributionApproved)throw Error("Review must be privately gated");
if(d.tasks.length!==6||m.tasks.length!==6||m.questions.length!==42)throw Error("Missing source tasks/items");
const qMap=new Map(m.questions.map(q=>[q.id,q]));
let partCount=0,totalQ=0;
for(const t of d.tasks){
 const srcTask=m.tasks.find(x=>x.id===t.id);
 if(!srcTask||srcTask.title!==t.title||srcTask.expectedQuestionCount!==t.questionCount)throw Error("Task source mismatch: "+t.id);
 totalQ+=t.questionCount;
 for(const item of t.items){
  const q=qMap.get(item.id);
  if(!q||q.taskId!==t.id||q.parts.length!==item.parts.length)throw Error("Question source mismatch: "+item.id);
  item.parts.forEach((p,i)=>{
   const src=q.parts[i],file=path.resolve(source,p.file);
   if(src.file!==p.file||!file.startsWith(source+path.sep)||!fs.existsSync(file))throw Error("Missing capture "+p.file);
   const b=fs.readFileSync(file);
   if(b.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||b.readUInt32BE(16)!==p.width||b.readUInt32BE(20)!==p.height)throw Error("Invalid image "+p.file);
   partCount++;
  });
 }
}
if(totalQ!==36||partCount!==43)throw Error("Unexpected question/capture totals");
const esc=s=>String(s??"").replace(/[&<>\"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt=s=>s?s.slice(8,10)+"."+s.slice(5,7)+"."+s.slice(0,4):"לא אומת";
const g=t=>t.grade==="ז׳"?"g7":"g8";
const htmlParts=[];
const rows=d.tasks.flatMap(t=>(t.submission.length?t.submission:[null]).map(s=>
 '<tr class="'+g(t)+'"><td>'+esc(t.grade)+'</td><td>'+esc(t.kind)+'</td><td>'+esc(t.title)+'</td><td>'+esc(s?.track||"—")+'</td><td>'+fmt(s?.from)+'</td><td><b>'+fmt(s?.to)+'</b></td></tr>'
 )).join("");
const contents=d.tasks.map((t,i)=>'<li><a href="#t'+(i+1)+'">'+esc(t.grade)+" · "+esc(t.title)+'</a></li>').join("");
htmlParts.push('<section class="page cover"><img class="seal" src="../assets/district-logo.png" alt="סמל מחוז ירושלים"><p class="small-caps">פותחים שבוע · סיכום שבועי מספר 10</p><h1>משימות החובה וההערכה<br>ב־ModEL</h1><h2>חוברת דיגיטלית · מועדי הגשה</h2><p>צילומי המקור · כיתות ז׳–ח׳</p><p class="edition-date">יום ראשון | כ״ח בחשוון תשפ״ז | 8.11.2026</p><p class="greeting">שבוע טוב</p><p>מחוז ירושלים והעיר ירושלים<br>יניב רז · הדרכה מחוזית במתמטיקה</p></section>');
htmlParts.push('<section class="page index"><p class="small-caps">פותחים שבוע · מדריך המשימות</p><h2>מה צריך להגיש במודל?</h2><p>טבלה מסכמת של משימות החובה וההערכה, כולל חלונות ביצוע כשהם מאומתים.</p><table><thead><tr><th>שכבה</th><th>סוג</th><th>משימה</th><th>מסלול</th><th>פתיחה</th><th>סיום</th></tr></thead><tbody>'+rows+'</tbody></table><p class="notice">העדכון חל על ההערכה הראשונה בלבד: ח׳ עד 13.11.2026; ז׳ עד 20.11.2026. בארבע משימות החובה אין מועד הגשה מאומת. מסלול עמ״ט ז׳ טעון אימות נוסף לפני הפצה.</p><h2>תוכן החוברת</h2><ol>'+contents+'</ol></section>');
d.tasks.forEach((t,i)=>{
 let deadlines=t.submission.length?t.submission.map(s=>'<div class="deadline"><b>'+esc(s.track)+'</b> · '+fmt(s.from)+' עד <b>'+fmt(s.to)+'</b>'+(s.verification==="requires-confirmation"?" (טעון אימות פרטני)":"")+'</div>').join(""):'<div class="notice">מועד ההגשה למשימת חובה זו לא אומת במקור.</div>';
 htmlParts.push('<section class="page chapter '+g(t)+'" id="t'+(i+1)+'"><p class="small-caps">משימות ModEL · סיכום 10</p><p class="tag">שכבה '+esc(t.grade)+' · '+esc(t.kind)+' · '+t.questionCount+' שאלות</p><h2>'+esc(t.title)+'</h2><p>המשימה מוצגת כאן בשלמותה באמצעות הצילומים המקוריים, לפי סדר השאלות במניפסט המאומת.</p><h3>תנאים ומועדי הגשה</h3>'+deadlines+'<p><a href="'+esc(t.sourceUrl)+'">פתיחת המשימה המקורית ב־ModEL</a></p></section>');
 t.items.forEach(item=>item.parts.forEach((part,k)=>{
  const label=item.label||((item.number==="0")?"פתיחת המשימה":"שאלה "+item.number);
  htmlParts.push('<section class="page shot '+g(t)+'"><div class="shot-head"><span>'+esc(t.grade)+" · "+esc(t.title)+'</span><span>'+esc(label)+(item.parts.length>1?" · חלק "+(k+1)+"/"+item.parts.length:"")+'</span></div><div class="image-box"><img src="../source/public/content/'+esc(part.file)+'" alt="'+esc(t.title+" "+label)+'" width="'+part.width+'" height="'+part.height+'"></div><p class="caption">'+esc(label)+' · צילום מקור מלא ללא שינוי</p></section>');
 }));
});
const CSS='@page{size:A4 portrait;margin:12mm 12mm 16mm}*{box-sizing:border-box}body{font-family:Arial,"DejaVu Sans",sans-serif;color:#173441;direction:rtl;font-size:11pt;line-height:1.6;margin:0}.page{break-after:page;page-break-after:always;min-height:259mm;overflow:hidden}.cover{text-align:center;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:24mm 8mm}.seal{width:35mm;height:35mm;object-fit:contain;margin-bottom:18mm}.small-caps{color:#1f6269;font-size:10pt;font-weight:700;letter-spacing:.03em}.cover h1{font-size:33pt;line-height:1.26;margin:7mm 0}.cover h2{font-size:17pt;color:#14666a}.edition-date{margin-top:18mm;font-weight:bold}.greeting{color:#0b726b;font-size:15pt;font-weight:700;margin:10mm 0 16mm}.index{padding-top:8mm}h2{font-size:23pt;line-height:1.3}table{border-collapse:collapse;width:100%;table-layout:fixed;margin:9mm 0 7mm}th,td{border-bottom:1px solid #d4e3dc;padding:3mm 1.5mm;text-align:right;vertical-align:top;font-size:9.4pt;word-break:break-word}th{background:#e5f1ed;font-weight:700}.g7 td:first-child{color:#1e40af;background:#eff6ff}.g8 td:first-child{color:#0f766e;background:#f0fdfa}.notice{border-right:3px solid #b37a45;background:#fff7eb;padding:4mm 5mm;font-size:9.4pt;margin:8mm 0}.index ol{font-size:12pt;line-height:2.0}.index a,.chapter a{color:#08666a}.chapter{padding:16mm 3mm}.tag{background:#e6f3ee;border-radius:5mm;padding:2mm 5mm;display:inline-block}.chapter h2{margin:15mm 0 10mm;font-size:22pt}.chapter h3{margin:16mm 0 7mm;color:#1a6865;font-size:16pt}.deadline{padding:5mm 0;border-bottom:1px solid #cedbd9}.shot-head{border-bottom:1px solid #bed2d0;height:17mm;display:flex;justify-content:space-between;align-items:center;font-size:9pt;font-weight:bold;color:#275a5e;gap:4mm}.shot-head span:first-child{max-width:118mm}.image-box{height:225mm;width:186mm;display:flex;align-items:flex-start;justify-content:center;margin-top:4mm;overflow:hidden}.image-box img{max-width:100%;max-height:225mm;object-fit:contain;display:block;width:auto;height:auto}.caption{font-size:9pt;color:#526b72;text-align:center;margin:3mm 0}';
const html='<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>ModEL | סיכום מספר 10</title><style>'+CSS+'</style></head><body>'+htmlParts.join('\n')+'</body></html>';
fs.mkdirSync("review",{recursive:true});
const file=path.join(root,"review/booklet.html"),pdf=path.join(root,"review/sikum10-model-booklet.pdf");
fs.writeFileSync(file,html,"utf8");
const browser=await chromium.launch({headless:true,args:["--disable-dev-shm-usage"]});
try{
 const page=await browser.newPage({viewport:{width:1200,height:900}});
 await page.goto(pathToFileURL(file).href,{waitUntil:"load",timeout:120000});
 const status=await page.evaluate(async()=>{
  const images=[...document.images];
  await Promise.all(images.map(img=>img.decode()));
  return {all:images.length,loaded:images.filter(i=>i.naturalWidth>0).length};
 });
 if(status.all!==44||status.loaded!==44)throw Error("Image decode incomplete "+JSON.stringify(status));
 await page.pdf({path:pdf,format:"A4",preferCSSPageSize:true,printBackground:true,displayHeaderFooter:true,
  headerTemplate:"<span></span>",
  footerTemplate:'<div style="font-size:9px;color:#64777c;text-align:center;width:100%"><span class="pageNumber"></span></div>',
  margin:{top:"12mm",bottom:"16mm",left:"12mm",right:"12mm"},timeout:180000});
 console.log("PRIVATE_BOOKLET_OK "+JSON.stringify({tasks:6,questions:36,context:6,photos:partCount,pagesExpected:htmlParts.length,images:status,bytes:fs.statSync(pdf).size,manifestSha:hash}));
}finally{await browser.close()}

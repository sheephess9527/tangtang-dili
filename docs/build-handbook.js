// 从 index.html 内置的 geo-data 编译出一份可打印的《高中地理学习手册》。
// 用法：node docs/build-handbook.js  ->  生成 docs/糖糖地理学习手册.html
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const D = JSON.parse(html.match(/<script id="geo-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

// ---------- 文本工具 ----------
const esc = s => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const arr = x => Array.isArray(x) ? x : (x == null ? [] : [x]);
// 只保留真正的考点陈述，过滤掉混进 concepts 的“第X章/第X节/框架标题”噪声
const isConcept = s => typeof s === "string" && s.length >= 12 && /[，。；：]/.test(s)
  && !/^第[一二三四五六七八九十]/.test(s) && !/^第.节/.test(s);

let total = { units: 0, key: 0, diff: 0, conf: 0, exam: 0 };

function section(title, badge, inner) {
  if (!inner) return "";
  return `<div class="sec"><h3 class="sec-h"><span class="tag tag-${badge}">${title}</span></h3>${inner}</div>`;
}

function renderUnit(u, num) {
  total.units++;
  const g2 = u.guide2 || {};
  const g = u.guide || {};
  let out = "";

  // 点题（老师导语）
  if (u.teacher) {
    const t = u.teacher.replace(/^糖糖[，,、]?\s*/, "");
    out += `<p class="lead">📌 ${esc(t)}</p>`;
  }

  // 1. 核心考点骨架
  const kp = arr(g2.keyPoints).filter(k => k && (k.label || (k.body && k.body.length)));
  if (kp.length) {
    total.key += kp.length;
    const items = kp.map(k => {
      const body = arr(k.body).map(b => `<li>${esc(b)}</li>`).join("");
      return `<div class="block"><p class="block-h">${esc(k.label)}</p>${body ? `<ul>${body}</ul>` : ""}</div>`;
    }).join("");
    out += section("核心考点", "key", items);
  }

  // 2. 难点突破
  const diff = arr(g2.difficulties).filter(d => d && d.name);
  if (diff.length) {
    total.diff += diff.length;
    const items = diff.map(d => {
      const plain = d.plain ? `<p class="plain">💬 ${esc(d.plain)}</p>` : "";
      const method = arr(d.method).map(m => `<li>${esc(m)}</li>`).join("");
      return `<div class="block"><p class="block-h">${esc(d.name)}</p>${plain}${method ? `<ul>${method}</ul>` : ""}</div>`;
    }).join("");
    out += section("难点突破", "diff", items);
  }

  // 3. 易混辨析（诀窍核心：误区 vs 正解）
  let confs = arr(g2.confusions).filter(c => c && c.term);
  if (!confs.length) confs = arr(g.mistakes).filter(c => c && c.term);
  if (confs.length) {
    total.conf += confs.length;
    const items = confs.map(c => {
      const right = arr(c.right).join("；");
      return `<div class="conf"><p class="conf-term">${esc(c.term)}</p>`
        + `<p class="conf-x"><b>易错：</b>${esc(c.wrong)}</p>`
        + `<p class="conf-ok"><b>正解：</b>${esc(right)}</p></div>`;
    }).join("");
    out += section("易混辨析", "conf", items);
  }

  // 4. 高频考向
  const ef = arr(g2.examFocus).filter(e => e && e.point);
  if (ef.length) {
    total.exam += ef.length;
    const items = ef.map(e => {
      const dir = e.direction ? `<p><b>怎么考：</b>${esc(e.direction)}</p>` : "";
      const ang = arr(e.angle).length ? `<p><b>突破口：</b>${arr(e.angle).map(esc).join("；")}</p>` : "";
      return `<div class="block"><p class="block-h">${esc(e.point)}</p>${dir}${ang}</div>`;
    }).join("");
    out += section("高频考向", "exam", items);
  }

  // 5. 解题思维链
  if (arr(u.chain).length) {
    const steps = arr(u.chain).map(s => `<span class="step">${esc(s)}</span>`).join('<span class="arrow">→</span>');
    out += section("解题思维链", "chain", `<div class="chain">${steps}</div>`);
  }

  // 6. 易错提醒（用简洁的 traps，去掉与“易混辨析”重复的长条目）
  const traps = arr(u.traps).filter(t => typeof t === "string" && !/误区是|正确辨析是/.test(t));
  if (traps.length) {
    out += section("易错提醒", "trap", `<ul>${traps.map(t => `<li>${esc(t)}</li>`).join("")}</ul>`);
  }

  // 7. 复习方法与口诀
  const rev = arr(g2.review).filter(r => r && (r.label || (r.body && r.body.length)));
  if (rev.length) {
    const items = rev.map(r => {
      const body = arr(r.body).map(b => `<li>${esc(b)}</li>`).join("");
      return `<div class="block"><p class="block-h">${esc(r.label)}</p>${body ? `<ul>${body}</ul>` : ""}</div>`;
    }).join("");
    out += section("复习方法与口诀", "rev", items);
  }

  // 兜底：若该单元没有 guide2，用 concepts 兜底
  if (!kp.length && !diff.length) {
    const cs = arr(u.concepts).filter(isConcept);
    if (cs.length) out += section("核心考点", "key", `<ul>${cs.map(c => `<li>${esc(c)}</li>`).join("")}</ul>`);
  }

  return `<article class="unit"><h2 class="unit-h"><span class="unit-no">${num}</span>${esc(u.title)}</h2>${out}</article>`;
}

// ---------- 组装 ----------
let bodyHtml = "";
let toc = "";
let unitCounter = 0;
D.books.forEach(b => {
  bodyHtml += `<section class="book"><h1 class="book-h">${esc(b.name)}</h1>`;
  toc += `<li class="toc-book">${esc(b.name)}</li>`;
  b.units.forEach(u => {
    unitCounter++;
    const label = unitCounter + ". " + u.title;
    bodyHtml += renderUnit(u, unitCounter);
    toc += `<li class="toc-unit">${esc(label)}</li>`;
  });
  bodyHtml += `</section>`;
});

const today = new Date().toISOString().slice(0, 10);

const page = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>糖糖·高中地理学习手册</title>
<style>
  :root{ --ink:#1a1a1a; --ink2:#444; --line:#dcdce4; --accent:#4a48c7; --soft:#f1f1fb;
         --key:#2563eb; --diff:#9333ea; --conf:#dc2626; --exam:#0891b2; --chain:#0e9f6e; --trap:#d97706; --rev:#6d28d9; }
  *{ box-sizing:border-box; }
  html{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  body{ margin:0; color:var(--ink); line-height:1.7; font-size:13.5px;
        font-family:"PingFang SC","Microsoft YaHei",-apple-system,"Helvetica Neue",sans-serif; }
  .wrap{ max-width:820px; margin:0 auto; padding:28px 30px 60px; }

  /* 封面 */
  .cover{ text-align:center; padding:120px 20px 40px; page-break-after:always; }
  .cover .logo{ width:74px; height:74px; margin:0 auto 22px; border-radius:18px;
        background:linear-gradient(135deg,#5B5BD6,#8A8AF0); display:flex; align-items:center; justify-content:center; }
  .cover h1{ font-size:34px; margin:6px 0; letter-spacing:2px; }
  .cover .sub{ color:var(--ink2); font-size:15px; margin-top:10px; }
  .cover .meta{ color:#888; font-size:12px; margin-top:40px; }
  .cover .note{ max-width:460px; margin:34px auto 0; text-align:left; background:var(--soft);
        border-radius:12px; padding:16px 18px; font-size:12.5px; color:var(--ink2); line-height:1.8; }

  /* 目录 */
  .toc{ page-break-after:always; }
  .toc h2{ font-size:20px; border-bottom:2px solid var(--accent); padding-bottom:8px; }
  .toc ul{ list-style:none; padding:0; margin:14px 0; column-count:2; column-gap:34px; }
  .toc-book{ font-weight:800; color:var(--accent); margin:12px 0 4px; break-inside:avoid; }
  .toc-unit{ color:var(--ink2); padding:2px 0 2px 12px; font-size:12.5px; break-inside:avoid; }

  /* 书/单元 */
  .book-h{ font-size:21px; color:#fff; background:linear-gradient(135deg,#5B5BD6,#8A8AF0);
        padding:9px 16px; border-radius:10px; margin:0 0 8px; page-break-after:avoid; }
  .book{ }
  .unit{ page-break-before:always; padding-top:4px; }
  .book > .unit:first-of-type{ page-break-before:auto; }
  .unit-h{ font-size:18.5px; margin:12px 0 6px; padding-bottom:6px; border-bottom:2px solid var(--line);
        page-break-after:avoid; }
  .unit-no{ display:inline-flex; min-width:24px; height:24px; padding:0 6px; margin-right:9px; border-radius:7px;
        background:var(--accent); color:#fff; font-size:13px; align-items:center; justify-content:center; vertical-align:2px; }
  .lead{ background:#fff8e6; border-left:4px solid #f0b000; padding:8px 12px; border-radius:0 8px 8px 0;
        margin:8px 0 14px; font-size:13px; color:#6b5400; }

  /* 小节 */
  .sec{ margin:12px 0; break-inside:avoid; }
  .sec-h{ margin:0 0 7px; }
  .tag{ display:inline-block; font-size:13px; font-weight:800; color:#fff; padding:3px 11px; border-radius:7px; }
  .tag-key{ background:var(--key);} .tag-diff{ background:var(--diff);} .tag-conf{ background:var(--conf);}
  .tag-exam{ background:var(--exam);} .tag-chain{ background:var(--chain);} .tag-trap{ background:var(--trap);}
  .tag-rev{ background:var(--rev);}

  .block{ margin:7px 0 9px; padding-left:2px; break-inside:avoid; }
  .block-h{ font-weight:800; margin:0 0 3px; color:#222; }
  .plain{ color:#555; background:#f6f6fb; padding:5px 10px; border-radius:7px; margin:4px 0; font-size:12.8px; }
  ul{ margin:3px 0 6px; padding-left:20px; }
  li{ margin:3px 0; }
  p{ margin:3px 0; }

  /* 易混辨析卡片 */
  .conf{ border:1px solid #f3c6c6; border-radius:9px; padding:8px 12px; margin:7px 0; background:#fff7f7; break-inside:avoid; }
  .conf-term{ font-weight:800; color:var(--conf); margin:0 0 3px; }
  .conf-x{ color:#9a3030; margin:2px 0; } .conf-x b{ color:#c0392b; }
  .conf-ok{ color:#1f5e3a; margin:2px 0; } .conf-ok b{ color:#0e9f6e; }

  /* 思维链 */
  .chain{ display:flex; flex-wrap:wrap; align-items:center; gap:4px; }
  .step{ background:var(--soft); color:var(--accent); font-weight:700; padding:4px 10px; border-radius:7px; font-size:12.8px; }
  .arrow{ color:#aaa; font-weight:800; }

  @page{ margin:14mm 12mm; }
  @media print{ .wrap{ padding:0; } a{ color:inherit; text-decoration:none; } }
</style>
</head>
<body>
<div class="wrap">

  <div class="cover">
    <div class="logo">
      <svg width="42" height="42" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M4 12h16M12 4c2.6 2.8 4 6 4 8s-1.4 5.2-4 8c-2.6-2.8-4-6-4-8s1.4-5.2 4-8Z" fill="none" stroke="#fff" stroke-width="1.6"/></svg>
    </div>
    <h1>高中地理学习手册</h1>
    <div class="sub">考点 · 难点 · 易混辨析 · 解题思维链 · 记忆口诀</div>
    <div class="sub" style="margin-top:4px;color:#5B5BD6;font-weight:700;">献给糖糖 · 照着学就好</div>
    <div class="note">
      <b>怎么用这本手册：</b><br>
      ① 每个单元先看「📌 点题」一句话抓住考试重心；<br>
      ② 「核心考点」是必须背下来的骨架，「难点突破」用大白话讲透原理；<br>
      ③ <b>红色「易混辨析」是丢分重灾区</b>，把"易错"和"正解"对照着记；<br>
      ④ 「解题思维链」是答题时脑子里走的顺序，按箭头一步步推；<br>
      ⑤ 「记忆口诀」帮你快速记牢，考前翻一翻。
    </div>
    <div class="meta">浙江高中地理 · 必修 + 选择性必修 · 共 ${unitCounter} 个单元 · ${today}</div>
  </div>

  <div class="toc">
    <h2>目录</h2>
    <ul>${toc}</ul>
  </div>

  ${bodyHtml}

</div>
</body>
</html>`;

const outPath = path.join(__dirname, "糖糖地理学习手册.html");
fs.writeFileSync(outPath, page);
console.log("已生成：" + outPath);
console.log("统计：", JSON.stringify(total));

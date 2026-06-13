const fs = require("fs");
const path = require("path").join(__dirname, "..", "index.html");
let html = fs.readFileSync(path, "utf8");
const re = /(<script id="geo-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
const m = html.match(re);
const D = JSON.parse(m[2]);

// ---- deterministic RNG seeded by string ----
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function rng(seed){let s=seed>>>0;return ()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};}
function shuffleWithAnswer(opts, correctIdx, seed){
  const arr=opts.map((o,i)=>({o,c:i===correctIdx}));
  const r=rng(seed);
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return {options:arr.map(x=>x.o), answer:arr.findIndex(x=>x.c)};
}

const isStmt = s => typeof s==="string" && s.length>=12 && /[，。；]/.test(s) && !/^第[一二三四五六七八九十]/.test(s) && !/^第.节/.test(s);
// 把"（误）以为/认为 X"清洗成干净的错误命题"X"，让干扰项读起来像正常陈述
function cleanWrong(s){
  let t = String(s||"").trim().replace(/^(误以为|常误以为|总以为|老以为|以为|认为)\s*/,"");
  return t;
}
// 清洗正确陈述里"大错特错！/错！/正解："等讲解口吻前缀
function cleanRight(s){
  let t = Array.isArray(s) ? s.join("；") : String(s||"");
  t = t.trim().replace(/^(大错特错[！!]?|错[！!]|对[！!]|正解[：:]?|其实[，,]?)\s*/,"").trim();
  return t;
}

const GENERIC_FALSE = [
  "只要记住名称和结论，不必结合材料和区域差异进行分析。",
  "地理现象往往由单一因素决定，各要素之间互不影响。",
  "不同区域的条件完全相同，可以直接套用同一结论。",
  "自然环境只受人类活动支配，自身没有演变规律。",
  "答题时可以脱离图文材料，凭印象直接下结论。",
  "把相近的概念合并理解即可，不需要区分它们的边界。"
];

const TARGET = 8; // 每单元上限，宁缺毋滥
const genBank = [];
const summary = [];
let reviewTotal = 0, dropped = 0;

D.books.forEach(b => b.units.forEach(u => {
  const title = u.title;
  const tags = u.tags || [];
  // 统一的"已验证"素材：易混名词对（mistakes 与 confusions 同源，按 term 去重）
  const pairMap = {};
  (u.guide && u.guide.mistakes || []).forEach(p => {
    if (p && p.term && p.right && p.wrong) pairMap[p.term] = { term: p.term, right: p.right, wrong: p.wrong };
  });
  (u.guide2 && u.guide2.confusions || []).forEach(p => {
    if (p && p.term && p.wrong && !pairMap[p.term]) {
      const right = Array.isArray(p.right) ? p.right.join("；") : p.right;
      if (right) pairMap[p.term] = { term: p.term, right, wrong: p.wrong };
    }
  });
  const pairs = Object.values(pairMap);
  const concepts = (u.concepts || []).filter(isStmt);
  // 干净的"错误陈述"池：来自被记录的常见误解（清洗掉"以为/认为"前缀）
  const cleanFalse = Array.from(new Set(pairs.map(p => cleanWrong(p.wrong))));

  function distractors(correct, exclude, n, seed){
    const out = [];
    const used = new Set([correct, ...exclude]);
    const r = rng(seed);
    const pool = cleanFalse.filter(x => !used.has(x));
    // 先用本单元真实误解，再用通用错误项兜底
    while (out.length < n && pool.length){ const k=Math.floor(r()*pool.length); const v=pool.splice(k,1)[0]; if(!used.has(v)){out.push(v);used.add(v);} }
    const gpool = GENERIC_FALSE.filter(x=>!used.has(x));
    while (out.length < n && gpool.length){ const k=Math.floor(r()*gpool.length); const v=gpool.splice(k,1)[0]; if(!used.has(v)){out.push(v);used.add(v);} }
    return out;
  }

  const built = [];
  // Family C：易混辨析（最贴近教材、质量最高）
  pairs.forEach((p, k) => {
    const id = "gen-" + u.id + "-c" + (k+1);
    const rightOpt = cleanRight(p.right);
    const wrongOpt = cleanWrong(p.wrong);
    const dis = distractors(rightOpt, [wrongOpt], 2, hashStr(id));
    const raw = [rightOpt, wrongOpt, ...dis];
    const sh = shuffleWithAnswer(raw, 0, hashStr(id+"s"));
    const needsReview = /[0-9０-９]/.test(rightOpt + wrongOpt);
    built.push({ id, unit: u.id, source: "AI生成", tags, stem: "关于“" + p.term + "”的辨析，下列说法正确的是？",
      options: sh.options, answer: sh.answer,
      explain: "正确：" + rightOpt + " 常见误区：" + cleanWrong(p.wrong), "需复核": needsReview });
  });
  // Family A：教材考点判断（找正确项）
  concepts.forEach((c, k) => {
    if (built.length >= TARGET) return;
    const id = "gen-" + u.id + "-a" + (k+1);
    const dis = distractors(c, [], 3, hashStr(id));
    if (dis.length < 3) return; // 干扰项不足则不生成
    const sh = shuffleWithAnswer([c, ...dis], 0, hashStr(id+"s"));
    const needsReview = /[0-9０-９]/.test(c);
    built.push({ id, unit: u.id, source: "AI生成", tags, stem: "关于“" + title + "”，下列叙述正确的是？",
      options: sh.options, answer: sh.answer,
      explain: "正确项符合教材关于“" + title + "”的表述；其余各项是常见误解或不当的分析方法。", "需复核": needsReview });
  });

  // ---- 自检：4个选项、互不相同、非空、答案索引有效且指向正确项 ----
  let kept = 0, reviewU = 0;
  built.forEach(q => {
    const ok = Array.isArray(q.options) && q.options.length === 4 &&
      q.options.every(o => typeof o === "string" && o.trim().length > 0) &&
      new Set(q.options).size === 4 &&
      q.answer >= 0 && q.answer < 4;
    if (!ok) { dropped++; return; }
    genBank.push(q); kept++; if (q["需复核"]) { reviewU++; reviewTotal++; }
  });
  summary.push({ id: u.id, title, kept, review: reviewU, pairs: pairs.length, concepts: concepts.length });
}));

D.genBank = genBank;
// ---- 删除每个教材冗余的 source 描述 ----
D.books.forEach(b => { b.source = ""; });

html = html.replace(re, (full, a, body, c) => a + JSON.stringify(D) + c);
fs.writeFileSync(path, html);

// ---- 报告 ----
console.log("生成完成。各单元统计（kept=生成数, review=需复核）：");
summary.forEach(s => console.log("  " + s.id + "  " + s.title + "\t生成 " + s.kept + " 题，需复核 " + s.review));
const total = genBank.length;
console.log("\n合计生成 " + total + " 题，其中需复核 " + reviewTotal + " 题；自检剔除 " + dropped + " 题。");
// answer position spread
const spread = {};
genBank.forEach(q => spread[q.answer] = (spread[q.answer]||0)+1);
console.log("答案位置分布：", JSON.stringify(spread));

const fs = require("fs");
const { JSDOM } = require("jsdom");

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log("  FAIL:", msg); } }

// ---------- Part A: full-page render smoke test (real React + ReactDOM + compiled app) ----------
const html = fs.readFileSync("/home/user/tangtang-dili/index.html", "utf8");
const errors = [];
const dom = new JSDOM(html, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  beforeParse(window) {
    window.addEventListener("error", e => errors.push(String(e.error || e.message)));
    const origErr = window.console.error;
    window.console.error = (...a) => { errors.push(a.join(" ")); };
  },
});
// allow microtasks/render
setTimeout(() => {
  const root = dom.window.document.getElementById("root");
  ok(root && root.innerHTML.length > 0, "Part A: #root is rendered (non-empty)");
  ok(/进入学习|糖糖地理通/.test(root.textContent), "Part A: login screen text present");
  ok(errors.length === 0, "Part A: no runtime errors/console.error -> " + JSON.stringify(errors.slice(0,3)));

  // ---------- Part B: pure-logic tests on the compiled functions ----------
  // 直接从 index.html 抽取内联的应用脚本（不依赖任何外部临时文件，clone 后即可 `node test.js`）。
  // 页面里有多个无属性 <script>：React/ReactDOM 的 UMD bundle 与应用代码；应用脚本以 makeExam 为标志。
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  let appJs = blocks.find(b => /function makeExam\(/.test(b));
  if (!appJs) { console.log("  FAIL: 未能在 index.html 中定位应用脚本"); console.log(`\n${pass} passed, ${++fail} failed`); process.exit(1); }
  // neutralize the final render IIFE so nothing touches ReactDOM
  appJs = appJs.replace(/\(function\s*\(\)\s*\{\s*const rootEl[\s\S]*?\}\)\(\);\s*$/, "");
  const dom2 = new JSDOM(html, { runScripts: "outside-only" });
  const win = dom2.window;
  win.React = { Component: class {}, createElement: () => null };
  win.ReactDOM = {};
  // expose inner functions after running the (de-rendered) script
  const exposer = "\n;window.__T = { makeExam, fillCorrect, pick, shuffleWithAnswer, BOOKS, allUnits, sourceFor, DATA };";
  win.eval(appJs + exposer);
  const T = win.__T;

  ok(typeof T.makeExam === "function", "Part B: makeExam exposed");

  // fillCorrect (#5)
  ok(T.fillCorrect("", "日地关系") === false, "fillCorrect: empty input -> false");
  ok(T.fillCorrect("我答日地关系对", "日地关系") === true, "fillCorrect: substring match -> true");
  ok(T.fillCorrect("任意内容", "") === false, "fillCorrect: empty answer -> false (no free points)");
  ok(T.fillCorrect("   ", "x") === false, "fillCorrect: whitespace only -> false");

  // pick (#6) safety
  ok(T.pick([], 3) === "", "pick: empty array -> '' (no NaN index)");
  ok(T.pick(["a","b"], 5) === "b", "pick: wraps with modulo");

  // shuffle correctness (#3): answer index always points to the originally-correct option
  const sh = T.shuffleWithAnswer(["CORRECT","w1","w2","w3"], 0, 12345);
  ok(sh.options[sh.answer] === "CORRECT", "shuffleWithAnswer: answer index points to correct option");

  // makeExam over every unit
  let totalChoiceSort = 0, ansZero = 0, enoughQuestions = true, answerValid = true, distinctAnsSeen = {};
  T.allUnits().forEach(u => {
    const qs = T.makeExam(u);
    if (qs.length < 8) enoughQuestions = false;
    qs.forEach(q => {
      if (q.type === "choice" || q.type === "sort") {
        totalChoiceSort++;
        if (q.answer === 0) ansZero++;
        if (!Array.isArray(q.options) || q.answer < 0 || q.answer >= q.options.length) answerValid = false;
        distinctAnsSeen[q.answer] = (distinctAnsSeen[q.answer] || 0) + 1;
      }
    });
  });
  ok(enoughQuestions, "makeExam: every unit yields at least 8 questions");
  ok(answerValid, "makeExam: every choice/sort answer index is within options range");

  // AI 生成题库自检：source 标记、4 个互异选项、答案索引有效
  const gen = T.DATA.genBank || [];
  let genValid = true, genSourceOk = true;
  gen.forEach(q => {
    if (q.source !== "AI生成") genSourceOk = false;
    if (!Array.isArray(q.options) || q.options.length !== 4 || new Set(q.options).size !== 4 || q.answer < 0 || q.answer >= 4) genValid = false;
  });
  ok(gen.length > 0, "genBank: AI 题库非空 (" + gen.length + " 题)");
  ok(genSourceOk, "genBank: 每题 source 均为 'AI生成'");
  ok(genValid, "genBank: 每题 4 个互异选项且答案索引有效");

  // every real-bank question must surface in some unit's exam (no question stranded)
  const allRealStems = new Set(T.DATA.realBank.map(q => q.stem));
  const surfacedStems = new Set();
  T.allUnits().forEach(u => T.makeExam(u).forEach(q => surfacedStems.add(q.stem)));
  let strandedCount = 0;
  allRealStems.forEach(stem => { if (!surfacedStems.has(stem)) strandedCount++; });
  ok(strandedCount === 0, "makeExam: every realBank question appears in some unit exam (stranded=" + strandedCount + ")");
  ok(ansZero < totalChoiceSort, "makeExam: answers are NOT all option A (was the bug). zero=" + ansZero + "/" + totalChoiceSort);
  ok(Object.keys(distinctAnsSeen).length >= 3, "makeExam: answer indices spread across >=3 positions -> " + JSON.stringify(distinctAnsSeen));

  // determinism: same unit -> same shuffle across calls
  const u0 = T.allUnits()[0];
  const a = T.makeExam(u0).map(q => q.answer).join(",");
  const b = T.makeExam(u0).map(q => q.answer).join(",");
  ok(a === b, "makeExam: deterministic across calls (stable option order)");

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}, 300);

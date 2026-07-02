// 用无头 Chromium 把 docs/og-card.html 渲染成 1200×630 的社交分享图 og-cover.png（放到仓库根，供 sync-public 同步到 public/）。
// 需要本机有 Chromium/Chrome：优先用 Playwright 的浏览器（PLAYWRIGHT_BROWSERS_PATH），再退回常见系统路径。
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.join(__dirname, "..");
const card = path.join(__dirname, "og-card.html");
const out = path.join(root, "og-cover.png");

function findChrome() {
  const cands = [];
  const pw = process.env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  try {
    fs.readdirSync(pw).filter(d => /^chromium-/.test(d)).forEach(d => cands.push(path.join(pw, d, "chrome-linux", "chrome")));
  } catch (e) {}
  cands.push("/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser");
  const hit = cands.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });
  if (!hit) throw new Error("未找到 Chromium/Chrome，可先安装或设置 PLAYWRIGHT_BROWSERS_PATH");
  return hit;
}

const chrome = findChrome();
execFileSync(chrome, [
  "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
  "--force-device-scale-factor=1", "--window-size=1200,630",
  "--screenshot=" + out, "file://" + card
], { stdio: "ignore" });

const b = fs.readFileSync(out);
if (!(b[0] === 0x89 && b[1] === 0x50)) throw new Error("生成的不是有效 PNG");
console.log("已生成 " + out + "  " + b.readUInt32BE(16) + "x" + b.readUInt32BE(20) + "  " + b.length + " bytes");

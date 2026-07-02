const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
fs.mkdirSync(publicDir, { recursive: true });

// 需要对外部署的文件：应用本体 + Service Worker（离线支持）。
// sw.js 必须作为独立文件放到 public/ 根，否则 SPA 回退会把 /sw.js 也返回成 index.html。
const files = ["index.html", "sw.js", "og-cover.png"];
files.forEach(function (name) {
  fs.copyFileSync(path.join(root, name), path.join(publicDir, name));
  console.log("Synced " + name + " -> public/" + name);
});

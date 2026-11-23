const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");
fs.mkdirSync(publicDir, { recursive: true });

// 需要对外部署的文件：应用本体、404 页面、Service Worker 与分享图。
const files = ["index.html", "404.html", "sw.js", "og-cover.png"];
files.forEach(function (name) {
  fs.copyFileSync(path.join(root, name), path.join(publicDir, name));
  console.log("Synced " + name + " -> public/" + name);
});

# 糖糖地理通 项目说明

## 部署方式（重要）

本站通过 **Cloudflare Workers**（Git 集成 / Workers Builds）部署，**生产部署分支是
`main`**。每次推送到 `main`，Cloudflare 会自动运行 `npx wrangler deploy` 重新部署。

- 部署配置文件 `wrangler.jsonc` 必须保留在 `main` 根目录，**不要删除**。
  其中 `"assets": { "directory": "./public" }` 指定**静态资源目录是 `public/`**，
  `not_found_handling: single-page-application` 让未知路径回退到 `index.html`。
  这样只把 `public/index.html` 对外提供，避免 `node_modules` 等开发文件被一并部署
  导致 Cloudflare 构建失败。
- ⚠️ **真正对外服务的是 `public/index.html`，不是根目录的 `index.html`。**
  根目录的 `index.html` 是源文件（开发、测试都用它），改完后必须用 `npm run sync-public`
  同步到 `public/`，否则线上不会有任何变化。两者一旦不一致，最常见的"改了没生效"
  就是忘了同步。
- `cloudflare/workers-autoconfig` 分支只是 Cloudflare 机器人自动创建的配置 PR 分支，
  **不是**部署分支，不需要往它推送代码。
- 自定义域名：`www.tangguo.date`。

### 改完代码的标准流程

```bash
npm run sync-public          # 把根目录 index.html 同步到 public/index.html（必须）
node test.js                 # 跑测试，确认没破坏
git add index.html public/index.html
git commit -m "..."
git push -u origin main      # 推到 main 即触发 Cloudflare 自动部署（npx wrangler deploy）
```

> 本地若想手动部署，可直接 `npm run deploy`（= `sync-public` + `wrangler deploy`）。

部署需要几分钟。若线上没变化，依次排查：① 是否忘了 `npm run sync-public`；
② Cloudflare 控制台 build 是否成功；③ 浏览器硬刷新（Cmd/Ctrl+Shift+R）排除缓存。

## 项目结构

- 单文件 React 应用：`index.html`，内联 UMD bundle + `<script id="geo-data">` 数据
- `realBank`：浙江历年真题题库（选择题 choice / 填空题 fill）
- `unitRealMap`：单元 ID → 真题 ID 数组的映射
- `makeExam(unit)`：按单元生成试卷（全部映射真题 + 生成的专项题，无每单元数量上限）
- `public/index.html`：由 `npm run sync-public` 从根目录 `index.html` 同步而来，
  是 Cloudflare 真正部署的文件（勿手改，改根目录后同步）
- `scripts/sync-public.js`：把根目录 `index.html` 复制到 `public/index.html`
- `wrangler.jsonc`：Cloudflare 部署配置（资源目录 `./public`，勿删）

## 测试

```bash
node test.js   # 20 项测试，覆盖渲染冒烟测试 + makeExam / 题库逻辑
```

测试读取根目录 `index.html`（Part A 真实挂载整页，Part B 抽取内联脚本做纯逻辑测试），
与 `public/` 无关，所以请在 `sync-public` 之前先跑测试。

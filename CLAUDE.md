# 糖糖地理通 项目说明

面向**浙江高中地理**的自学练习站（考点精讲 + 易混辨析 + 浙江真题 + 识字卡 + 错题闭环）。
线上：**https://www.tangguo.date**。完整上手文档见 [`README.md`](./README.md)，本文件是给
AI 代理的**操作规约与红线**，动手前请通读。

## 架构速览（最容易踩错的地方）

- **整个应用就是一个文件 `index.html`**：React/ReactDOM 以 UMD bundle **内联**（不走 CDN），
  应用代码也内联在**最后一段无属性 `<script>`** 里，用**手写 `React.createElement`
  （没有 JSX、没有打包步骤）**。改功能 = 直接改这段 JS。
- **Tailwind 是预编译进页面的静态 CSS（v3.4.17），页面无 Tailwind 运行时**。新写的 class
  若不在这份已编译 CSS 里就不生效——请改用内联 `style`、已有 class，或 `:root` 里的
  “设计系统”变量（`--accent:#5B5BD6` 等）。
- **数据全在 `<script id="geo-data" type="application/json">`**，顶层 `{ books, realBank,
  unitRealMap, genBank }`。它是一行超长 JSON，**改它请走脚本**（`scripts/*.js` 都是
  “读出 JSON→改→写回 index.html” 的范式），不要手撕。
- 关键函数：`makeExam(unit)` 组卷、`shuffleWithAnswer` 确定性洗牌、`fillCorrect` 填空判分。
  持久化用 localStorage：`geo-authed`（口令门禁）、`geo-progress-v2`（练习/错题/识字卡进度）。
- 登录口令 `0315` / `0825`，是**客户端软门禁、非安全机制**（源码可见），仅用于本地登录测试。
- `b2u5 环境与发展` 缺 `guide2` 字段，遍历单元生成内容时**必须兜底**，否则漏内容或报错。

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
与 `public/` 无关，所以请在 `sync-public` 之前先跑测试。测试**自包含**——直接从 `index.html`
抽取应用脚本，clone 后即可 `node test.js`，不依赖任何外部临时文件。

## 工作规约（红线）

- **分支**：`main` 是生产/部署分支；功能开发在 `claude/website-audit-7d2qyl`。
  未经用户明确许可，**不要推送到约定之外的分支**；`cloudflare/workers-autoconfig` 也不要碰。
- **每次改动收尾**固定动作：`npm run sync-public` →（涉及逻辑/数据时）`node test.js` →
  `git add index.html public/index.html`（及相关脚本）→ commit → 按需 push。
- **改了根 `index.html` 必须同步 `public/`**，这是“改了没生效”的头号原因。
- **不要提交 `docs/` 下生成的图片/产物**（`icon-*.png`、预览图等可由脚本重建）；脚本本身要留。
- 改 `geo-data`/题库后，务必跑测试（含“每道真题都要在某单元出现、答案索引合法、答案不全是 A”
  等断言），避免回归。
- 涉及对外发布（部署到线上、公开文件）属于不可逆动作，按用户指示执行、不确定就先确认。

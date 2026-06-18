# 糖糖地理通 项目说明

## 部署方式（重要）

本站通过 **Cloudflare Workers**（Git 集成 / Workers Builds）部署，**生产部署分支是
`main`**。每次推送到 `main`，Cloudflare 会自动运行 `npx wrangler deploy` 重新部署。

- 部署配置文件 `wrangler.jsonc` 必须保留在 `main` 根目录，**不要删除**。
  静态资源目录为 `public/`，只上传 `index.html`，避免把 `node_modules` 等开发文件
  一并部署导致 Cloudflare 构建失败。
- `cloudflare/workers-autoconfig` 分支只是 Cloudflare 机器人自动创建的配置 PR 分支，
  **不是**部署分支，不需要往它推送代码。
- 自定义域名：`www.tangguo.date`。

### 改完代码的标准流程

```bash
npm run sync-public          # 把根目录 index.html 同步到 public/
git add index.html public/index.html
git commit -m "..."
git push -u origin main      # 推到 main 即触发 Cloudflare 自动部署
```

部署需要几分钟。若线上没变化，先在 Cloudflare 控制台查看 build 是否成功，
再用浏览器硬刷新（Cmd/Ctrl+Shift+R）排除缓存。

## 项目结构

- 单文件 React 应用：`index.html`，内联 UMD bundle + `<script id="geo-data">` 数据
- `realBank`：浙江历年真题题库（选择题 choice / 填空题 fill）
- `unitRealMap`：单元 ID → 真题 ID 数组的映射
- `makeExam(unit)`：按单元生成试卷（全部映射真题 + 生成的专项题，无每单元数量上限）
- `wrangler.jsonc`：Cloudflare 部署配置（勿删）

## 测试

```bash
node test.js   # 17 项测试，覆盖渲染冒烟测试 + makeExam 逻辑
```

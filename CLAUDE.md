# 糖糖地理通 项目说明

## 部署方式（重要）

本站通过 **Cloudflare Workers** 部署，部署分支是 `cloudflare/workers-autoconfig`，
**不是** `main`。该分支根目录含 `wrangler.jsonc` 部署配置，且不包含 `test.js`、
`package.json` 等开发文件。

### ⚠️ 每次改完代码必须做的事

只推送到 `main` **不会**更新线上网站。任何对 `index.html` 的修改完成后，
必须同步到部署分支才会上线：

```bash
# 在 main 上提交并推送后：
git checkout cloudflare/workers-autoconfig
git checkout main -- index.html      # 只同步 index.html，保留 wrangler.jsonc
git commit -m "同步最新 index.html 到部署分支"
git push -u origin cloudflare/workers-autoconfig
git checkout main
```

Cloudflare 会在推送后几分钟内自动重新部署。

## 项目结构

- 单文件 React 应用：`index.html`，内联 UMD bundle + `<script id="geo-data">` 数据
- `realBank`：浙江历年真题题库（选择题 choice / 填空题 fill）
- `unitRealMap`：单元 ID → 真题 ID 数组的映射
- `makeExam(unit)`：按单元生成试卷（全部映射真题 + 生成的专项题，无每单元数量上限）

## 测试

```bash
node test.js   # 17 项测试，覆盖渲染冒烟测试 + makeExam 逻辑
```
注意：`test.js` 只在 `main` 分支，部署分支不含它。

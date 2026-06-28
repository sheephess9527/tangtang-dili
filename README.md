# 糖糖地理通（tangtang-dili）

面向**浙江高中地理**的自学练习站：按教材单元提供考点精讲、易混辨析、浙江历年真题训练、
识字卡和「错题本 + 错题练习」闭环。线上地址：**https://www.tangguo.date**

> 这份 README 的目标：**任何人（或任何 AI）clone 下来就能立刻接手**。
> 给 AI 代理的硬性约束写在 [`CLAUDE.md`](./CLAUDE.md)，请先读它。

---

## 1. 一分钟上手

```bash
git clone <repo> && cd tangtang-dili
npm install            # 仅装 jsdom（测试用）；线上运行不依赖任何 npm 包
node test.js           # 跑测试，应输出 “20 passed, 0 failed”
# 本地预览：用浏览器直接打开 index.html 即可（纯静态单文件，无需起服务器）
```

登录口令（**客户端软门禁，非真正的安全机制**，源码里就能看到）：`0315` 或 `0825`。

改完代码要上线，见 [§6 部署](#6-部署cloudflare-workers)。**核心铁律：改根目录
`index.html` 后必须 `npm run sync-public`，否则线上不变。**

---

## 2. 这个项目最反直觉的三件事

1. **整个应用是一个文件**：`index.html`。React/ReactDOM 以 UMD bundle **内联**在页面里
   （不走 CDN），应用代码也内联在最后一个 `<script>` 里，用**手写
   `React.createElement`（没有 JSX、没有打包步骤）**。要改功能就直接改这段 JS。
2. **线上服务的是 `public/index.html`，不是根目录的 `index.html`。**
   根目录是源文件，`public/` 是 `npm run sync-public` 同步出来的部署产物。两者一旦不同步，
   就会“改了没生效”。
3. **Tailwind 是预编译进页面的**（v3.4.17 的一份静态 CSS）。**页面里没有 Tailwind 运行时**，
   所以你新写的 class 如果不在这份已编译 CSS 里就不会生效——这种情况请用内联 `style`、
   已有的 class，或下面说的“设计系统”CSS 变量。

---

## 3. 目录结构

```
index.html              # ★ 唯一的应用源文件（内联 React UMD + 应用代码 + 数据）
public/index.html       # 部署产物，由 sync-public 从根目录复制（勿手改）
test.js                 # 测试：Part A 整页渲染冒烟 + Part B 纯逻辑（自包含，无需临时文件）
wrangler.jsonc          # Cloudflare 部署配置（assets 目录 = ./public，勿删）
package.json            # scripts: sync-public / deploy；devDep: jsdom
scripts/
  sync-public.js        # 根 index.html → public/index.html
  generate-practice.js  # 由教材考点/易错点离线生成 genBank（AI 练习题），写回 index.html
docs/
  build-icon.js         # 纯像素+4x 超采样生成 App 图标（apple-touch-icon / manifest / favicon）
CLAUDE.md               # 给 AI 代理的操作规则（部署、分支、测试、注意事项）
```

> 注：打印用的《地理学习手册》生成器（`docs/build-handbook.js`）与其产物只在
> `claude/website-audit-7d2qyl` 分支上，**没有合并到 `main`**（属于私有打印材料，未发布到线上）。

---

## 4. 应用结构（`index.html` 内）

### 4.1 页面里的几段 `<script>`
- `<script id="geo-data" type="application/json">…</script>`：**全部数据**（题库、教材内容）。
- 两段无属性 `<script>`：React、ReactDOM 的 UMD production bundle。
- 最后一段无属性 `<script>`：**应用代码**（以 `function makeExam(` 为标志，测试就靠它定位）。
  结尾是 `(function(){ const rootEl … ReactDOM.createRoot(rootEl).render(…) })()` 的渲染 IIFE。

### 4.2 数据模型（`geo-data` 顶层）
```
{
  books:   [ { id, name, units: [ Unit, … ] }, … ]   // 5 册：必修一二 + 选必一二三
  realBank:  [ Q, … ]   // 219 道浙江真题（choice / fill）
  unitRealMap: { 单元id: [真题id, …] }                 // 单元 → 真题 的映射
  genBank:   [ Q, … ]   // 170 道由 generate-practice.js 生成的考点精练题
}
```
- **Unit** 字段：`id, title, diagram, tags, teacher（导语）, concepts（考点）, traps（易错）,
  chain（解题思维链）, cards（识字卡）, guide（学考考情/框架/mistakes）,
  guide2（keyPoints 重点 / difficulties 难点 / examFocus 考向 / confusions 易混辨析 / review 复习口诀）`。
  - 例外：`b2u5 环境与发展` 没有 `guide2`，渲染/生成时需用 `concepts`+`traps` 兜底。
- **realBank 题**：`{ id, tags, source, stem, options, answer, explain }`（`fill` 题 `answer` 是字符串）。
- **genBank 题**：`{ id, unit, source:"AI生成", tags, stem, options[4], answer, explain, 需复核 }`。

### 4.3 关键函数（应用脚本内）
| 函数 | 作用 |
|---|---|
| `makeExam(unit)` | 组卷：映射到本单元的全部真题 + 本单元 genBank 题（确定性洗牌，稳定顺序） |
| `sourceFor(unit)` / `genFor(unit)` | 取本单元真题 / 生成题 |
| `shuffleWithAnswer(options, answerIdx, seed)` | 确定性洗牌，返回 `{options, answer}`，答案索引跟着正确项走 |
| `hashStr(s)` / `pick(arr, i)` | 字符串哈希（做种子） / 取模安全取元素 |
| `fillCorrect(value, answer)` | 填空判分：子串包含即对，空串/空答案为错 |

### 4.4 组件与导航
顶层 `App` 用 `tab` 切换四个页签：
`learn 教材考点` · `exam 真题实战` · `cards 识字卡` · `wrong 错题本`。
组件：`Login, Sidebar, Header, Learn, Exam, Question, Cards, Wrong, Brand, Icon, Diagram`。

### 4.5 状态与持久化（localStorage）
- `geo-authed`：是否已通过口令门禁。
- `geo-progress-v2`：`{ exam: { 单元id: { answers, done, best, wrong:[题id…] } }, cards: { 单元id:[已记住卡id…] } }`。
  - 做错的题自动进 `wrong`；答对移出。**错题练习模式**只用组件本地 state，不写回 `wrong`、不计进度。

---

## 5. 常见改动怎么做

- **改题/加题（真题）**：编辑 `geo-data` 里的 `realBank` 与 `unitRealMap` → `sync-public` →
  `node test.js`（有“每道真题都要在某单元出现/答案索引合法/答案不全是 A”等断言）。
- **重生成 AI 练习题**：`node scripts/generate-practice.js`（它会读教材考点/易错点重算 `genBank`
  并写回 `index.html`）→ `sync-public` → 测试。
- **改教材讲解内容**：编辑对应 Unit 的 `guide2`（重点/难点/考向/易混辨析/口诀）。
- **改 UI/交互**：直接改最后一段 `<script>` 里的 `React.createElement` 代码（无 JSX/无打包）。
  样式优先用页面 `:root` 里的“设计系统”CSS 变量（`--accent: #5B5BD6` 等）和已有 class。
- **换图标**：改 `docs/build-icon.js` 的设计参数 → `node docs/build-icon.js`（生成 180/192/512 PNG +
  data URL）→ 把 data URL 替换进 `index.html` 的 `apple-touch-icon` / `manifest` / favicon → sync → 测试。
- **任何改动收尾**：`npm run sync-public && node test.js`，确认通过再 commit。

---

## 6. 部署（Cloudflare Workers）

- 通过 **Cloudflare Workers Builds（Git 集成）** 部署，**生产分支是 `main`**；推送到 `main`
  即触发 `wrangler deploy`。
- `wrangler.jsonc` 里 `assets.directory = ./public`，`not_found_handling = single-page-application`，
  即**只对外提供 `public/index.html`**。
- 标准流程：
  ```bash
  npm run sync-public                 # 根 index.html → public/index.html（必须！）
  node test.js                        # 20 项测试
  git add index.html public/index.html
  git commit -m "…"
  git push -u origin main             # 触发自动部署
  ```
- 线上没变化时依次排查：① 忘了 `sync-public`；② Cloudflare build 是否成功；③ 浏览器硬刷新。
- 自定义域名：`www.tangguo.date`。`cloudflare/workers-autoconfig` 是机器人配置分支，**不要**往它推。

---

## 7. 测试

```bash
node test.js   # 20 项；Part A 用 jsdom 真实挂载整页做渲染冒烟，Part B 抽内联脚本做纯逻辑测试
```
测试**自包含**：直接从 `index.html` 抽取应用脚本，clone 后无需任何额外步骤。
测试读的是**根目录** `index.html`，与 `public/` 无关——所以请在 `sync-public` 之前先跑测试。

---

## 8. 分支约定

- `main`：生产部署分支。
- `claude/website-audit-7d2qyl`：当前的功能开发分支（也含未发布到线上的打印手册生成器）。
- 上线某改动 = 让它进 `main`（合并或 cherry-pick）。**未经允许不要推到非约定分支。**

---

## 9. 已知坑（务必记住）

1. 改了根 `index.html` 不 `sync-public` → 线上不变。
2. 新 Tailwind class 不在预编译 CSS 里 → 不生效，改用内联样式/已有 class/设计系统变量。
3. `geo-data` 是一行很长的 JSON，改它建议用脚本（`scripts/*.js` 都是“读出 JSON→改→写回”的范式）。
4. `b2u5` 缺 `guide2`，遍历单元生成内容时要兜底，否则会漏内容或报错。
5. 登录口令是明文软门禁，别当作安全措施；任何敏感能力都不应只靠它。

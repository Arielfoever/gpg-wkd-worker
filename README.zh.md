# 🔐 Cloudflare WKD Server

[English](./README.md) | 中文

基于 Cloudflare Workers & Assets 的 **Web Key Directory (WKD)** 自动化分发方案。只需将 PGP 公钥存入仓库，即可自动部署全球分发的公钥查询服务。  

[什么是 WKD?](https://www.webkeydirectory.com/what-is-wkd) | 自动化 z-base-32 哈希映射 | 零成本维护

---

## ✨ 为什么选择本项目？

- **自动化构建**：无需手动计算复杂的 WKD 哈希。GitHub Actions 会自动解析目录并生成映射。
- **全球加速**：利用 Cloudflare 边缘网络，在全球范围内提供极速的公钥检索响应。
- **多云可迁移**：同一份 `keys/` 数据可部署到 Cloudflare Workers 或腾讯云 EdgeOne Pages，互不影响。
- **强兼容性**：同时支持 **Advanced** 和 **Direct** 两种 WKD 查询模式。
- **GitOps 流程**：像管理代码一样管理你的公钥。新增用户只需 `git push`。

---

## 🚀 快速开始 (Quick Start)

### 1. 创建你的仓库
点击仓库顶部的 **Fork** 按钮，创建一个新的私有或公开仓库。

> **注意**: 通过 Fork 创建的仓库，GitHub 默认会禁用 Actions。请前往仓库的 **Actions** 标签页，点击 **"I understand my workflows, go ahead and enable them"** 按钮。

### 2. 清理并添加你的密钥
为了防止部署示例数据，请先清理目录：

1. **清理目录**：删除 `keys/` 文件夹下所有现有的子文件夹（即删除我的域名和密钥）。
2. **导出密钥**：导出你的二进制公钥（必须包含你要托管的 Email）：
   ```bash
   # 导出公钥，建议剥离他人签名以减小体积 (推荐)
   # 如果你的邮箱是 alice@example.com, 那么你的文件名必须是 alice.gpg，就像这样
   gpg --export --export-options export-clean alice@example.com > alice.gpg

   # 如果你想公开所有他人对你的签名, 则不需要增加 --export-options export-clean。
   gpg --export alice@example.com > alice.gpg
   ```
3. **按结构存放**：将导出的 `.gpg` 文件放入对应域名的文件夹中：
   - 路径格式：`keys/{域名}/{用户名}.gpg`
   - 示例：`keys/example.com/alice.gpg`

### 3. 配置部署密钥
在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中添加以下 **Repository Secrets**：
- `CLOUDFLARE_API_KEY`: 你的 Cloudflare API 令牌（需具备 Workers 部署权限，可以选择“编辑 Worker”模板）。
- `CLOUDFLARE_ACCOUNT_ID`: 你的 Cloudflare 账户 ID。

### 4. 自动化部署
只需执行 Git 推送，GitHub Actions 就会自动计算哈希并部署：
```bash
git add .
git commit -m "feat: setup my wkd keys"
git push origin main
```

### 5. 设置 Worker 路由
待 Github Actions 完成部署后，转到 [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages)，
找到 `gpg-wkd-worker` Worker，在**设置**、**域和路由**中，将你的邮箱域名添加到 Worker 中：
 - 支持 `openpgpkey.<email-domain>` 或 `<email-domain>` 两种形式，可同时使用。

---

## 💻 本地部署 (Manual Deployment)

如果你想在本地进行开发，或者更喜欢手动通过 CLI 部署，请按以下步骤操作。由于 `key-manifest.json` 是动态生成的，你需要手动运行生成脚本。

### 1. 环境准备
确保已安装 Node.js（要求 Node.js v22+），并登录 Wrangler：
```bash
npm install
npx wrangler login
```

### 2. 生成清单文件
在部署之前，**必须**先将密钥正确放在 `keys/` 目录中，并运行脚本生成 `src/key-manifest.json`：
```bash
# 运行生成脚本 (请确保你在项目根目录下)
node generate-manifest.mjs
```
*运行成功后，你应该能在终端看到生成的 Key 数量提示。*

### 3. 部署到 Cloudflare
```bash
npx wrangler deploy
```

### 4. 设置 Worker 路由
待 Github Actions 完成部署后，转到 [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages)，
找到 `gpg-wkd-worker` Worker，在**设置**、**域和路由**中，将你的邮箱域名添加到 Worker 中，支持 `openpgpkey.<email-domain>` 或 `<email-domain>` 两种形式，可同时使用。

---

## ☁️ 部署到腾讯云 EdgeOne（可选）

本项目同时提供 [腾讯云 EdgeOne Pages](https://pages.edgeone.ai/zh/document/product-introduction) 的适配。与 Cloudflare 版本的最大区别是：**EdgeOne 版本在构建期就把公钥落盘到 WKD 规范要求的路径，线上是一个纯静态站点**，不需要边缘函数、KV 存储或运行时查表，所有请求直接由 CDN 缓存响应。

### 1. 架构差异

| | Cloudflare Workers | EdgeOne Pages |
| --- | --- | --- |
| 运行时 | Worker 运行时查 `key-manifest.json` | 无（纯静态托管） |
| 哈希计算 | 构建期生成 manifest，运行时查表 | 构建期直接生成到对应目录 |
| URL 映射 | `src/index.ts` 的 fetch handler | `edgeone.json` 的 `rewrites` |
| 响应头 | Worker 代码设置 | `edgeone.json` 的 `headers` |

请求链路：

```
GET /.well-known/openpgpkey/example.com/hu/<hash>
 ├─ 命中 dist/.well-known/openpgpkey/...（兜底副本，存在时直接返回）
 └─ 否则由 edgeone.json 重写 → /wkd/example.com/hu/<hash>.gpg
```

`headers` 规则会为 `/.well-known/openpgpkey/*` 和 `/wkd/*` 统一设置
`Content-Type: application/octet-stream`、`Access-Control-Allow-Origin: *` 与 `Cache-Control`。

> 由于 WKD 的哈希在构建期已完全确定，静态化的响应速度更快，也不受边缘函数 CPU 时间（200ms）与调用配额的限制。

### 2. 本地构建与预览

```bash
# 生成纯静态站点到 dist/
node tools/build-edgeone.mjs

# 可选：额外生成 Direct 模式路径（见下文说明）
node tools/build-edgeone.mjs --direct-domain=example.com

# 本地预览（首次会提示安装 edgeone CLI）
npx edgeone pages dev
```

构建成功后会打印每个域名应绑定的 `openpgpkey.<域名>` 提示。

### 3. 部署

**方式 A：控制台导入 Git 仓库（推荐）**

在 EdgeOne 控制台新建项目并导入本仓库。仓库根目录的 `edgeone.json` 已经配置好：

- `buildCommand`: `node tools/build-edgeone.mjs`
- `outputDirectory`: `./dist`

因此无需在控制台额外填写构建配置，`git push` 即可自动构建发布。

**方式 B：GitHub Actions**

1. 在 `Settings -> Secrets and variables -> Actions` 中添加 Secret：`EDGEONE_API_TOKEN`（在控制台 [API Token](https://pages.edgeone.ai/zh/document/api-token) 页面获取）。
2. 可选：添加 Repository Variable `EDGEONE_PROJECT_NAME` 指定项目名（默认 `gpg-wkd-worker`）。
3. 推送代码，`.github/workflows/deploy-edgeone.yml` 会自动构建并发布。

> 默认情况下 Cloudflare 与 EdgeOne 两个工作流都会在 push 到 `main` 时执行。若只想保留一个平台，删除不需要的 workflow 文件即可。

### 4. 绑定域名

进入 EdgeOne Pages 项目的 **域名管理**，添加自定义域名：

- **Advanced 模式（推荐）**：`openpgpkey.<邮箱域名>`，例如 `openpgpkey.example.com`。
- 按提示在 DNS 服务商处添加 CNAME 记录，并申请免费证书。

> ⚠️ 若项目的加速区域选择「中国大陆可用区」或「全球可用区（含中国大陆）」，绑定域名必须已完成 ICP 备案；否则请选择不含中国大陆的区域。

### 5. 关于 Direct 模式

Direct 模式的请求路径是 `/.well-known/openpgpkey/hu/<hash>`，**不含域名**，因此静态站点无法按 Host 区分不同域名的公钥。所以：

- 默认只生成 Advanced 模式（`openpgpkey.<域名>` 主机 + 带域名的路径），满足绝大多数场景，GnuPG 也会优先尝试 Advanced 模式。
- 仅当你把邮箱域名本身（如 `example.com`）整体托管在 EdgeOne Pages 时，才用 `--direct-domain=example.com` 额外生成 Direct 路径。

```bash
node tools/build-edgeone.mjs --direct-domain=example.com
# 或在 GitHub Actions 中设置环境变量 WKD_DIRECT_DOMAIN
```

### 6. 排查

- 请求返回 404：确认 `dist/wkd/` 下存在对应文件，并检查 EdgeOne 的 `rewrites` 规则是否已生效。
- 返回内容被浏览器打开成文本：检查 `headers` 规则中的 `Content-Type`；同时本项目会额外生成 `dist/.well-known/openpgpkey/...` 实体文件作为兜底。
- 构建失败且提示找不到密钥：确认 `keys/{域名}/{用户名}.gpg` 结构正确，且至少存在一个 `.gpg` 文件。

---

## ✅ 如何验证？

部署完成后，你可以通过以下两种方式验证服务是否正常：

**方式一：命令行验证 (GnuPG)**

```bash
# 使用 GnuPG 直接定位外部密钥
gpg --locate-external-keys --auto-key-locate wkd your-email@example.com
```
如果成功，你应该能看到公钥被自动导入的提示。

**方式二：在线工具验证**

访问 [Web Key Directory Validator](https://www.webkeydirectory.com/)，输入你的 Email 地址进行检测。

---

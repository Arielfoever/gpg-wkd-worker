# 🔐 Cloudflare WKD Server

English | [中文](./README.zh.md)

An automated **Web Key Directory (WKD)** distribution solution based on Cloudflare Workers & Assets. Simply store your PGP public keys in the repository to automatically deploy a globally distributed public key query service.  

[What is WKD?](https://www.webkeydirectory.com/what-is-wkd) | Automated z-base-32 hash mapping | Zero-maintenance

---

## ✨ Why Choose This Project?

- **Automated Build**: No need to manually calculate complex WKD hashes. GitHub Actions automatically parses the directory and generates the mappings.
- **Global Acceleration**: Leverages the Cloudflare Edge network to provide ultra-fast public key retrieval responses worldwide.
- **Strong Compatibility**: Supports both **Advanced** and **Direct** WKD query modes simultaneously.
- **GitOps Workflow**: Manage your public keys just like code. Adding a new user is as simple as a `git push`.

---

## 🚀 Quick Start

### 1. Create Your Repository
Click the **Fork** button at the top of the repository to create a new private or public repository.

> **Note**: For repositories created via Fork, GitHub disables Actions by default. Please go to the **Actions** tab of your repository and click the **"I understand my workflows, go ahead and enable them"** button.

### 2. Clean and Add Your Keys
To prevent deploying sample data, please clean up the directory first:

1. **Clean Directory**: Delete all existing subfolders under the `keys/` folder (i.e., remove the example domain and keys).
2. **Export Keys**: Export your binary public key (must contain the Email you want to host):
   ```bash
   # Export public key, recommended to strip third-party signatures to reduce size (Recommended)
   # If your email is alice@example.com, your filename must be alice.gpg
   gpg --export --export-options export-clean alice@example.com > alice.gpg

   # If you want to include all third-party signatures, omit --export-options export-clean.
   gpg --export alice@example.com > alice.gpg
   ```
3. **Store by Structure**: Place the exported `.gpg` file into the folder corresponding to the domain:
   - Path format: `keys/{domain}/{username}.gpg`
   - Example: `keys/example.com/alice.gpg`

### 3. Configure Deployment Secrets
Add the following **Repository Secrets** in your GitHub repository under `Settings -> Secrets and variables -> Actions`:
- `CLOUDFLARE_API_KEY`: Your Cloudflare API Token (Must have Workers deployment permissions; the "Edit Cloudflare Workers" template is recommended).
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare Account ID.

### 4. Automated Deployment
Simply push your changes to Git, and GitHub Actions will automatically calculate the hashes and deploy:
```bash
git add .
git commit -m "feat: setup my wkd keys"
git push origin main
```

### 5. Set Worker Routes
After Github Actions completes the deployment, go to the [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
Find the `gpg-wkd-worker` Worker. Under **Settings** -> **Domains & Routes**, add your email domain to the Worker:
 - Supports both `openpgpkey.<email-domain>` and `<email-domain>` formats; both can be used simultaneously.

---

## 💻 Manual Deployment (Local)

If you want to develop locally or prefer manual deployment via CLI, follow these steps. Since `key-manifest.json` is generated dynamically, you need to run the generation script manually.

### 1. Environment Setup
Ensure Node.js is installed (Node.js v22+ required) and login to Wrangler:
```bash
npm install
npx wrangler login
```

### 2. Generate Manifest File
Before deploying, you **must** place the keys correctly in the `keys/` directory and run the script to generate `src/key-manifest.json`:
```bash
# Run the generation script (Ensure you are in the project root directory)
node generate-manifest.mjs
```
*Upon success, you should see a prompt indicating the number of generated keys in the terminal.*

### 3. Deploy to Cloudflare
```bash
npx wrangler deploy
```

### 4. Set Worker Routes
After the deployment is complete, go to the [Cloudflare Dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages).
Find the `gpg-wkd-worker` Worker. Under **Settings** -> **Domains & Routes**, add your email domain to the Worker. Supports both `openpgpkey.<email-domain>` and `<email-domain>` formats; both can be used simultaneously.

---

## ☁️ Deploy to Tencent Cloud EdgeOne (Optional)

This project also targets [Tencent Cloud EdgeOne Pages](https://pages.edgeone.ai/document/product-introduction). Unlike the Cloudflare version, the EdgeOne version **materializes every public key at its WKD path during build time**, so production is a pure static site — no edge functions, no KV, no runtime lookup. All requests are served from CDN cache.

### 1. Architecture Difference

| | Cloudflare Workers | EdgeOne Pages |
| --- | --- | --- |
| Runtime | Worker + `key-manifest.json` lookup | None (static hosting) |
| Hash calculation | Build-time manifest, runtime lookup | Build-time directory layout |
| URL mapping | `src/index.ts` fetch handler | `edgeone.json` `rewrites` |
| Response headers | Worker code | `edgeone.json` `headers` |

```
GET /.well-known/openpgpkey/example.com/hu/<hash>
 ├─ served from dist/.well-known/openpgpkey/... (fallback mirror)
 └─ otherwise rewritten by edgeone.json → /wkd/example.com/hu/<hash>.gpg
```

### 2. Build and Preview Locally

```bash
node tools/build-edgeone.mjs                                  # outputs ./dist
node tools/build-edgeone.mjs --direct-domain=example.com      # also emit Direct mode paths
npx edgeone pages dev                                         # local preview
```

### 3. Deploy

- **Console / Git import (recommended)**: import this repository as an EdgeOne Pages project. `edgeone.json` already defines `buildCommand` and `outputDirectory`, so no extra build configuration is needed.
- **GitHub Actions**: add a repository secret `EDGEONE_API_TOKEN` (see [API Token](https://pages.edgeone.ai/document/api-token)). Optionally set the repository variable `EDGEONE_PROJECT_NAME` (defaults to `gpg-wkd-worker`). `.github/workflows/deploy-edgeone.yml` then deploys `./dist` on every push to `main`.

> Both the Cloudflare and EdgeOne workflows run on push to `main` by default. Delete the one you don't need if you only want a single target.

### 4. Bind a Custom Domain

In the EdgeOne Pages project, open **Domain Management** and add `openpgpkey.<email-domain>` (e.g. `openpgpkey.example.com`), then create the CNAME record at your DNS provider and apply for a free certificate.

> ⚠️ If the project's acceleration region includes mainland China, the domain must have a valid ICP filing. Otherwise pick a region outside mainland China.

### 5. About Direct Mode

Direct mode uses `/.well-known/openpgpkey/hu/<hash>` (no domain in the path), which a static site cannot disambiguate per Host. Therefore only Advanced mode is generated by default; GnuPG tries Advanced mode first anyway. Use `--direct-domain=example.com` only if you host the mailbox domain itself entirely on EdgeOne Pages.

### 6. Troubleshooting

- **404**: verify the file exists under `dist/wkd/` and that the `rewrites` rule is applied.
- **Key rendered as text**: check the `Content-Type` header rule. A `dist/.well-known/openpgpkey/...` mirror is also emitted as a fallback.
- **Build fails with "no eligible keys"**: ensure the `keys/{domain}/{username}.gpg` layout is correct.

---

## ✅ How to Verify?

After deployment, you can verify if the service is working normally in two ways:

**Method 1: Command Line Verification (GnuPG)**

```bash
# Locate external keys using GnuPG directly
gpg --locate-external-keys --auto-key-locate wkd your-email@example.com
```
If successful, you should see a message indicating the public key has been automatically imported.

**Method 2: Online Tool Verification**

Visit the [Web Key Directory Validator](https://www.webkeydirectory.com/) and enter your Email address for testing.

---

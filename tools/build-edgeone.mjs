#!/usr/bin/env node
/**
 * 为腾讯云 EdgeOne Pages 生成纯静态的 WKD 站点。
 *
 * 与 Cloudflare 版本的区别：
 *   Cloudflare 版本在运行时用 key-manifest.json 查表，再从 Assets 读取公钥；
 *   EdgeOne 版本在构建期就把每个公钥落到 WKD 规范要求的路径上，
 *   线上只是一个纯静态站点，不需要边缘函数、KV 或运行时查表。
 *
 * 产物结构（dist/）：
 *   wkd/{domain}/hu/{hash}.gpg     -> /.well-known/openpgpkey/{domain}/hu/{hash}
 *   wkd/{domain}/policy.gpg        -> /.well-known/openpgpkey/{domain}/policy
 *   wkd/hu/{hash}.gpg              -> /.well-known/openpgpkey/hu/{hash}      (Direct 模式，可选)
 *   wkd/policy.gpg                 -> /.well-known/openpgpkey/policy          (Direct 模式，可选)
 *
 * URL 到文件的映射由 edgeone.json 的 rewrites 完成：
 *   "/.well-known/openpgpkey/*" -> "/wkd/:splat.gpg"
 *
 * 用法：
 *   node tools/build-edgeone.mjs
 *   node tools/build-edgeone.mjs --direct-domain=example.com   # 额外生成 Direct 模式路径
 *   node tools/build-edgeone.mjs --no-mirror                   # 不生成 .well-known 兜底副本
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { getWKDHash } from './lib/wkd-hash.mjs';
import { listKeys } from './lib/wkd-keys.mjs';

const projectRoot = join(import.meta.dirname, '..');
const keysDir = join(projectRoot, 'keys');
const outDir = join(projectRoot, 'dist');

const argv = process.argv.slice(2);
const directDomain = (
  process.env.WKD_DIRECT_DOMAIN ??
  argv.find((arg) => arg.startsWith('--direct-domain='))?.slice('--direct-domain='.length) ??
  ''
)
  .trim()
  .toLowerCase();

/**
 * 是否额外生成 `.well-known/` 实体文件作为兜底。
 * rewrites 是主路径；万一平台对 dot 路径的重写行为有差异，实体文件仍可直接命中。
 */
const mirrorDotWellKnown = !argv.includes('--no-mirror');

let fileCount = 0;

/**
 * @param {string} relativePath 相对 dist 的路径，使用 "/" 分隔
 * @param {string | Buffer} content
 */
function writeOut(relativePath, content) {
  const target = join(outDir, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  fileCount++;
}

const keys = listKeys(keysDir);
if (keys.length === 0) {
  console.error('❌ Error: No eligible keys found in the ./keys directory.');
  console.error("Please ensure your keys are in './keys/{domain}/{username}.gpg' format.");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });

/** @type {Set<string>} */
const domains = new Set();
/** @type {string[]} */
const wkdPaths = [];

for (const key of keys) {
  const domain = key.domain.toLowerCase();
  domains.add(domain);

  const hash = await getWKDHash(key.localPart);
  const content = readFileSync(key.filePath);

  writeOut(`wkd/${domain}/hu/${hash}.gpg`, content);
  if (mirrorDotWellKnown) {
    writeOut(`.well-known/openpgpkey/${domain}/hu/${hash}`, content);
  }
  wkdPaths.push(`/.well-known/openpgpkey/${domain}/hu/${hash}`);

  if (directDomain && domain === directDomain) {
    writeOut(`wkd/hu/${hash}.gpg`, content);
    if (mirrorDotWellKnown) {
      writeOut(`.well-known/openpgpkey/hu/${hash}`, content);
    }
    wkdPaths.push(`/.well-known/openpgpkey/hu/${hash}`);
  }
}

// policy 文件：WKD 规范要求存在，内容为空。
for (const domain of domains) {
  writeOut(`wkd/${domain}/policy.gpg`, '');
  if (mirrorDotWellKnown) {
    writeOut(`.well-known/openpgpkey/${domain}/policy`, '');
  }
}
if (directDomain && domains.has(directDomain)) {
  writeOut('wkd/policy.gpg', '');
  if (mirrorDotWellKnown) {
    writeOut('.well-known/openpgpkey/policy', '');
  }
}

const pageStyle = `display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; text-align: center; font-family: sans-serif;`;

writeOut(
  'index.html',
  `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>WKD Server</title>
  </head>
  <body style="${pageStyle}">
    <div style="width: 100%; max-width: 600px;">
      <h1 style="font-size: 1.4em;">🔐 Web Key Directory</h1>
      <p>This is a WKD server. Public keys are available under <code>/.well-known/openpgpkey/</code>.</p>
      <p>已托管域名：</p>
      <ul style="text-align: left; display: inline-block; margin: 0; padding-left: 1.2em;">
        ${[...domains]
          .sort()
          .map((domain) => `<li><code>openpgpkey.${domain}</code></li>`)
          .join('\n        ')}
      </ul>
      <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0;" />
      <p style="color: #666; font-size: 0.9em;">
        Powered by <a href="https://github.com/LamGC/gpg-wkd-worker" style="color: #0066cc; text-decoration: none;">gpg-wkd-worker</a>
      </p>
    </div>
  </body>
</html>
`,
);

writeOut(
  '404.html',
  `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Not Found</title>
  </head>
  <body style="${pageStyle}">
    <div style="width: 100%; max-width: 600px;">
      <p>I'm a WKD server! This is not the key you're looking for.</p>
      <hr style="border: 0; border-top: 1px solid #ccc; margin: 20px 0;" />
      <p style="color: #666; font-size: 0.9em;">
        Powered by <a href="https://github.com/LamGC/gpg-wkd-worker" style="color: #0066cc; text-decoration: none;">gpg-wkd-worker</a>
      </p>
    </div>
  </body>
</html>
`,
);

console.info(`✅ Success: Built EdgeOne static site with ${keys.length} keys (${fileCount} files).`);
console.info(`   Output: ${outDir}`);
for (const domain of [...domains].sort()) {
  console.info(`   → Bind custom domain: openpgpkey.${domain}`);
}
if (directDomain) {
  console.info(`   → Direct mode enabled for: ${directDomain}`);
} else {
  console.info('   → Direct mode disabled (use --direct-domain=<domain> to enable).');
}
console.info(`   → Sample: ${wkdPaths[0]}`);

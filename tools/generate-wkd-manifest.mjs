import { writeFileSync } from 'fs';
import { join } from 'path';
import { getWKDHash } from './lib/wkd-hash.mjs';
import { listKeys } from './lib/wkd-keys.mjs';

const projectRoot = join(import.meta.dirname, '..');
const keysDir = join(projectRoot, 'keys');
const manifestPath = join(projectRoot, 'src', 'key-manifest.json');

const keys = listKeys(keysDir);

/** @type {Record<string, string>} */
const manifest = {};

for (const key of keys) {
  const hash = await getWKDHash(key.localPart);
  // 以 lookup key 中的域名为小写（请求的 hostname 总是小写），资源路径保留原始目录名。
  manifest[`${key.domain.toLowerCase()}/${hash}`] = `${key.domain}/${key.fileName}`;
}

if (keys.length > 0) {
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.info(`✅ Success: Generated Key manifest with ${keys.length} keys.`);
} else {
  console.error('❌ Error: No eligible keys found in the ./keys directory.');
  console.error("Please ensure your keys are in './keys/{domain}/{username}.gpg' format.");
  process.exit(1);
}

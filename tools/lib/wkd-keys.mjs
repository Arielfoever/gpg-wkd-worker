import { readdirSync } from 'fs';
import { join } from 'path';

/**
 * 扫描 keys 目录，返回所有可发布的公钥条目。
 *
 * 目录约定：`keys/{domain}/{local-part}.gpg`
 *
 * @param {string} keysDir keys 目录路径
 * @returns {{ domain: string, localPart: string, fileName: string, filePath: string }[]}
 */
export function listKeys(keysDir) {
  /** @type {{ domain: string, localPart: string, fileName: string, filePath: string }[]} */
  const keys = [];

  let domainEntries;
  try {
    domainEntries = readdirSync(keysDir, { withFileTypes: true });
  } catch {
    return keys;
  }

  for (const domainEntry of domainEntries) {
    if (!domainEntry.isDirectory() || domainEntry.name.startsWith('.')) {
      continue;
    }

    const domain = domainEntry.name;
    const domainDir = join(keysDir, domain);

    for (const file of readdirSync(domainDir, { withFileTypes: true })) {
      if (!file.isFile() || file.name.startsWith('.')) {
        continue;
      }

      // 用最后一个 "." 切分，允许 local-part 内含点（如 first.last.gpg）。
      const dotIndex = file.name.lastIndexOf('.');
      const extName = dotIndex === -1 ? '' : file.name.slice(dotIndex + 1);
      if (extName && extName.toLowerCase() !== 'gpg') {
        console.error(`[WARN] The key must be GPG binary format, Skip... (fileName: ${domain}/${file.name})`);
        continue;
      }

      const localPart = dotIndex === -1 ? file.name : file.name.slice(0, dotIndex);
      if (!localPart) {
        continue;
      }

      keys.push({
        domain,
        localPart,
        fileName: file.name,
        filePath: join(domainDir, file.name),
      });
    }
  }

  return keys;
}

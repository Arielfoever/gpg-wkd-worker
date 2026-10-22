/**
 * WKD (Web Key Directory) 通用工具。
 *
 * 这些逻辑被以下脚本共用：
 *  - tools/generate-wkd-manifest.mjs (Cloudflare Worker 部署)
 *  - tools/build-edgeone.mjs        (EdgeOne Pages 部署)
 */

export const ZBASE32_ALPHABET = 'ybndrfg8ejkmcpqxot1uwisza345h769';

/**
 * 将二进制数据编码为 z-base-32 字符串。
 * @param {Uint8Array | number[]} data 原始二进制数据
 * @returns {string}
 */
export function encodeZBase32(data) {
  let result = '';
  let buffer = 0;
  let bitsLeft = 0;

  for (const byte of data) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;

    while (bitsLeft >= 5) {
      const index = (buffer >>> (bitsLeft - 5)) & 0x1f;
      result += ZBASE32_ALPHABET[index];
      bitsLeft -= 5;
    }
  }

  return result;
}

/**
 * 计算邮箱 local-part 的 WKD Hash。
 *
 * 依据 draft-koch-openpgp-webkey-service，Hash 为
 * SHA-1(lowercase(local-part)) 的 z-base-32 编码。
 *
 * @param {string} localPart 邮箱 @ 之前的本地部分
 * @returns {Promise<string>}
 */
export async function getWKDHash(localPart) {
  const encoder = new TextEncoder();
  const data = encoder.encode(localPart.toLowerCase());
  const hashBuffer = await crypto.subtle.digest('SHA-1', data);
  return encodeZBase32(new Uint8Array(hashBuffer));
}

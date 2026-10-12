import { brotliDecompressSync, gunzipSync } from 'node:zlib';

const GZIP_FIRST = 0x1f;
const GZIP_SECOND = 0x8b;
const FIRST_PRINTABLE = 32;
const TAB = 9;
const LINE_FEED = 10;
const CARRIAGE_RETURN = 13;
const TEXT_WHITESPACE = new Set([TAB, LINE_FEED, CARRIAGE_RETURN]);
const MAX_DECOMPRESSED_BYTES = 20_971_520;

/** Proxies can strip Content-Encoding; detect gzip and headerless Brotli bytes.
 * Already decoded UTF-8 passes through. Decompression has a fixed memory limit.
 */
export function decodeBody(bytes: ArrayBuffer): string {
  const buffer = Buffer.from(bytes);
  if (buffer[0] === GZIP_FIRST && buffer[1] === GZIP_SECOND) {
    return gunzipSync(buffer, { maxOutputLength: MAX_DECOMPRESSED_BYTES }).toString('utf8');
  }
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    const controls = [...text].some((char) => {
      const code = char.charCodeAt(0);
      return code < FIRST_PRINTABLE && !TEXT_WHITESPACE.has(code);
    });
    if (!controls) return text;
  } catch {
    // Binary responses can fail UTF-8; tiny Brotli responses can contain ASCII controls.
  }
  return brotliDecompressSync(buffer, { maxOutputLength: MAX_DECOMPRESSED_BYTES }).toString('utf8');
}

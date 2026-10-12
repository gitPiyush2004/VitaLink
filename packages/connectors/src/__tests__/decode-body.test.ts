import { brotliCompressSync, gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { decodeBody } from '../http/decode-body';

describe('upstream body decoding', () => {
  it('decodes gzip bytes when an upstream proxy stripped Content-Encoding', () => {
    const compressed = gzipSync('{"results":[{"status":"Current"}]}');
    const bytes = Uint8Array.from(compressed).buffer;
    expect(JSON.parse(decodeBody(bytes))).toEqual({ results: [{ status: 'Current' }] });
  });
  it('decodes headerless Brotli rather than caching corrupt UTF-8', () => {
    const compressed = brotliCompressSync(
      Buffer.from(
        '{"display_name":"Austin, Texas, United States","lat":"30.2672","lon":"-97.7431"}',
      ),
    );
    expect(JSON.parse(decodeBody(Uint8Array.from(compressed).buffer))).toMatchObject({
      display_name: 'Austin, Texas, United States',
    });
  });
  it('decodes small Brotli responses whose bytes happen to be valid UTF-8', () => {
    const compressed = brotliCompressSync(Buffer.from('[]'));
    expect(decodeBody(Uint8Array.from(compressed).buffer)).toBe('[]');
  });
  it('leaves already decoded JSON unchanged', () => {
    expect(decodeBody(new TextEncoder().encode('{"value":42}').buffer)).toBe('{"value":42}');
  });
});

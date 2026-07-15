/**
 * Polyfills Uint8Array methods missing in older Chromium/WebView/Safari runtimes.
 *
 * pdfjs-dist >= 5.4 calls Uint8Array.prototype.toHex() when computing PDF
 * fingerprints (MD5 → hex). That API landed in Chromium ~140 / late 2025.
 * Without it, catalog PDF import fails with:
 *   "hashOriginal.toHex is not a function"
 *
 * Matches the pdfjs-dist legacy (core-js) polyfill: two hex digits per byte.
 */

type Uint8ArrayWithToHex = typeof Uint8Array & {
  prototype: Uint8Array & { toHex?: () => string };
};

export function installUint8ArrayCompat(target: typeof globalThis = globalThis): void {
  const ctor = target.Uint8Array as Uint8ArrayWithToHex | undefined;
  if (!ctor || typeof ctor.prototype.toHex === 'function') return;

  Object.defineProperty(ctor.prototype, 'toHex', {
    value(this: Uint8Array): string {
      const len = this.length;
      const hex = new Array<string>(len);
      for (let i = 0; i < len; i++) {
        hex[i] = this[i]!.toString(16).padStart(2, '0');
      }
      return hex.join('');
    },
    writable: true,
    configurable: true,
  });
}

installUint8ArrayCompat();

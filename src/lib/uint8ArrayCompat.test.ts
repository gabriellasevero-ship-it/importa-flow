import { describe, expect, it } from 'vitest';
import { installUint8ArrayCompat } from './uint8ArrayCompat';

describe('installUint8ArrayCompat', () => {
  it('converte bytes para hex em minúsculas com 2 dígitos', () => {
    const proto = Uint8Array.prototype as Uint8Array & { toHex?: () => string };
    const hadNative = typeof proto.toHex === 'function';
    const original = proto.toHex;

    if (hadNative) {
      // Força o caminho do polyfill para validar o comportamento.
      delete (proto as { toHex?: () => string }).toHex;
    }

    try {
      installUint8ArrayCompat();
      const bytes = new Uint8Array([0, 10, 255, 16]);
      expect(typeof bytes.toHex).toBe('function');
      expect(bytes.toHex()).toBe('000aff10');
    } finally {
      if (hadNative && original) {
        Object.defineProperty(proto, 'toHex', {
          value: original,
          writable: true,
          configurable: true,
        });
      }
    }
  });

  it('não sobrescreve toHex nativo quando já existe', () => {
    const proto = Uint8Array.prototype as Uint8Array & { toHex?: () => string };
    const sentinel = function toHex(this: Uint8Array) {
      return 'native';
    };
    const previous = proto.toHex;
    Object.defineProperty(proto, 'toHex', {
      value: sentinel,
      writable: true,
      configurable: true,
    });

    try {
      installUint8ArrayCompat();
      expect(new Uint8Array([1]).toHex()).toBe('native');
    } finally {
      if (previous) {
        Object.defineProperty(proto, 'toHex', {
          value: previous,
          writable: true,
          configurable: true,
        });
      } else {
        delete (proto as { toHex?: () => string }).toHex;
      }
    }
  });
});

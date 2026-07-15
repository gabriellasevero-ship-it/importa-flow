/**
 * PDF.js worker entry with Uint8Array.toHex polyfill.
 * Fingerprint MD5 runs in the worker and calls hashOriginal.toHex().
 */
import { installUint8ArrayCompat } from '@/lib/uint8ArrayCompat';

installUint8ArrayCompat();

import 'pdfjs-dist/build/pdf.worker.mjs';

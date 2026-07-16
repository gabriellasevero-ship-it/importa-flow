import { describe, expect, it } from 'vitest';
import {
  computeOcrCanvasSize,
  extractSearchTermFromOcrText,
  isOcrMemoryError,
  MAX_OCR_DIMENSION,
} from './imageOcr';

describe('computeOcrCanvasSize', () => {
  it('mantém imagens menores que o limite', () => {
    expect(computeOcrCanvasSize(800, 600)).toEqual({
      width: 800,
      height: 600,
      scale: 1,
    });
  });

  it('reduz fotos 4K mantendo proporção', () => {
    const size = computeOcrCanvasSize(4032, 3024);
    expect(size.width).toBe(MAX_OCR_DIMENSION);
    expect(size.height).toBe(Math.round(3024 * (MAX_OCR_DIMENSION / 4032)));
    expect(size.scale).toBeCloseTo(MAX_OCR_DIMENSION / 4032);
  });

  it('reduz pelo maior lado em retrato', () => {
    const size = computeOcrCanvasSize(1080, 2400);
    expect(size.height).toBe(MAX_OCR_DIMENSION);
    expect(size.width).toBe(Math.round(1080 * (MAX_OCR_DIMENSION / 2400)));
  });

  it('trata dimensões inválidas', () => {
    expect(computeOcrCanvasSize(0, 10)).toEqual({ width: 1, height: 1, scale: 1 });
  });
});

describe('extractSearchTermFromOcrText', () => {
  it('limita às primeiras palavras e normaliza espaços', () => {
    expect(extractSearchTermFromOcrText('  Código  ABC123  Produto Especial Extra Mais  ')).toBe(
      'Código ABC123 Produto Especial Extra Mais'
    );
    expect(extractSearchTermFromOcrText('um dois três quatro cinco seis sete oito', 4)).toBe(
      'um dois três quatro'
    );
  });

  it('retorna vazio para texto sem conteúdo', () => {
    expect(extractSearchTermFromOcrText('   ')).toBe('');
  });
});

describe('isOcrMemoryError', () => {
  it('detecta mensagens de memória comuns', () => {
    expect(
      isOcrMemoryError(
        new Error('Devido a insuficiencia de memoria não foi possivel concluir a operação anterior')
      )
    ).toBe(true);
    expect(isOcrMemoryError(new Error('Out of memory'))).toBe(true);
    expect(isOcrMemoryError(new Error('Cannot enlarge memory arrays'))).toBe(true);
    expect(isOcrMemoryError(new Error('Falha de rede'))).toBe(false);
  });
});

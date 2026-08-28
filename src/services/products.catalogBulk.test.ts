import { describe, expect, it, vi, beforeEach } from 'vitest';

const insertMock = vi.fn();
const updateMock = vi.fn();
const eqMock = vi.fn();
const selectMock = vi.fn();
const singleMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  syncAuthBeforeDbRead: async () => undefined,
  supabase: {
    from: () => ({
      insert: insertMock,
      update: updateMock,
      select: selectMock,
      eq: eqMock,
    }),
  },
}));

vi.mock('./mappers', () => ({
  mapProduct: (row: unknown) => row,
}));

describe('createProducts / updateProductFast', () => {
  beforeEach(() => {
    insertMock.mockReset();
    updateMock.mockReset();
    eqMock.mockReset();
    selectMock.mockReset();
    singleMock.mockReset();

    insertMock.mockImplementation((rows: unknown) => {
      void rows;
      return Promise.resolve({ data: null, error: null });
    });

    updateMock.mockImplementation(() => {
      const chain = {
        eq: eqMock,
        select: selectMock,
      };
      return chain;
    });
    eqMock.mockImplementation(() => Promise.resolve({ data: null, error: null }));
    selectMock.mockImplementation(() => ({
      single: singleMock,
    }));
    singleMock.mockResolvedValue({
      data: { id: '1', importadora_id: 'i', code: 'A', name: 'n', price: 1, min_order: 1, category: 'c', active: true, created_at: new Date().toISOString() },
      error: null,
    });
  });

  it('createProducts inserts in chunks without select', async () => {
    const { createProducts } = await import('./products');
    const inputs = Array.from({ length: 120 }, (_, i) => ({
      importadoraId: 'imp-1',
      code: `C-${i}`,
      name: `Produto ${i}`,
      price: 10,
      minOrder: 1,
      category: 'Geral',
    }));

    await createProducts(inputs);

    expect(insertMock).toHaveBeenCalledTimes(3);
    expect(insertMock.mock.calls[0][0]).toHaveLength(50);
    expect(insertMock.mock.calls[1][0]).toHaveLength(50);
    expect(insertMock.mock.calls[2][0]).toHaveLength(20);
    expect(insertMock.mock.calls[0][0][0]).toMatchObject({
      importadora_id: 'imp-1',
      code: 'C-0',
      name: 'Produto 0',
    });
  });

  it('createProducts no-ops on empty list', async () => {
    const { createProducts } = await import('./products');
    await createProducts([]);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('updateProductFast updates without select', async () => {
    const { updateProductFast } = await import('./products');
    await updateProductFast('prod-1', { name: 'Novo', price: 99 });
    expect(updateMock).toHaveBeenCalledWith({ name: 'Novo', price: 99 });
    expect(eqMock).toHaveBeenCalledWith('id', 'prod-1');
    expect(selectMock).not.toHaveBeenCalled();
  });
});

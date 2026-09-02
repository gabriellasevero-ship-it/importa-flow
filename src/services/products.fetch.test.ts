import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; importadora_id: string; code?: string; name?: string };

const fromMock = vi.fn();

vi.mock('@/lib/supabase', () => ({
  isSupabaseConfigured: () => true,
  syncAuthBeforeDbRead: async () => undefined,
  supabase: {
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

vi.mock('./mappers', () => ({
  mapProduct: (row: Row) => ({
    id: row.id,
    importadoraId: row.importadora_id,
    code: row.code ?? '',
    name: row.name ?? '',
  }),
}));

function makeSelectChain(pages: Row[][], options?: { count?: number | null }) {
  let pageIndex = 0;
  const chain: Record<string, unknown> = {};
  const self = () => chain;

  chain.select = vi.fn(() => self());
  chain.eq = vi.fn(() => self());
  chain.order = vi.fn(() => self());
  chain.range = vi.fn(async () => {
    const data = pages[pageIndex] ?? [];
    pageIndex += 1;
    return { data, error: null, count: options?.count ?? null };
  });

  // head:true count path — select returns thenable when no range is called
  Object.assign(chain, {
    then: undefined,
  });

  return chain;
}

function makeCountChain(count: number) {
  const result = Promise.resolve({ data: null, error: null, count });
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.select = vi.fn(() => self());
  chain.eq = vi.fn(() => result);
  // When no filters, the select itself is the thenable end for head queries.
  // Our countProducts always ends on the query object after optional eqs.
  // Make the chain thenable so `await q` works.
  chain.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    result.then(onFulfilled, onRejected);
  return chain;
}

describe('fetchProducts pagination / counts', () => {
  beforeEach(() => {
    fromMock.mockReset();
    vi.resetModules();
  });

  it('fetchProducts pages beyond 1000 rows', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `p-${i}`,
      importadora_id: 'imp-a',
      name: `A${i}`,
      code: `C${i}`,
    }));
    const page2 = Array.from({ length: 250 }, (_, i) => ({
      id: `p-${1000 + i}`,
      importadora_id: 'imp-b',
      name: `B${i}`,
      code: `D${i}`,
    }));

    fromMock.mockReturnValue(makeSelectChain([page1, page2]));

    const { fetchProducts, PRODUCTS_PAGE_SIZE } = await import('./products');
    expect(PRODUCTS_PAGE_SIZE).toBe(1000);

    const products = await fetchProducts();
    expect(products).toHaveLength(1250);
    expect(products[0].importadoraId).toBe('imp-a');
    expect(products[1000].importadoraId).toBe('imp-b');
  });

  it('countProducts returns exact count from head query', async () => {
    fromMock.mockReturnValue(makeCountChain(2345));
    const { countProducts } = await import('./products');
    await expect(countProducts()).resolves.toBe(2345);
  });

  it('fetchProductCountsByImportadora aggregates across pages', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `p-${i}`,
      importadora_id: i < 700 ? 'imp-a' : 'imp-b',
    }));
    const page2 = Array.from({ length: 100 }, (_, i) => ({
      id: `p-${1000 + i}`,
      importadora_id: 'imp-b',
    }));

    fromMock.mockReturnValue(makeSelectChain([page1, page2]));
    const { fetchProductCountsByImportadora } = await import('./products');
    const counts = await fetchProductCountsByImportadora();
    expect(counts).toEqual({ 'imp-a': 700, 'imp-b': 400 });
  });

  it('fetchProductCodesByImportadora pages all codes', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({
      id: `id-${i}`,
      importadora_id: 'imp-1',
      code: `SKU-${i}`,
    }));
    const page2 = [{ id: 'id-1000', importadora_id: 'imp-1', code: 'SKU-1000' }];

    fromMock.mockReturnValue(makeSelectChain([page1, page2]));
    const { fetchProductCodesByImportadora } = await import('./products');
    const map = await fetchProductCodesByImportadora('imp-1');
    expect(map.size).toBe(1001);
    expect(map.get('SKU-1000')).toBe('id-1000');
  });
});

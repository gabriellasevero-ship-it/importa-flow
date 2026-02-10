/**
 * Mapeia linhas do Supabase (snake_case) para tipos do app (camelCase)
 */
import type {
  User,
  Importadora,
  Category,
  Product,
  Cliente,
  Transportadora,
  Order,
  OrderStatus,
  OrderOrigin,
  CartItem,
  Commission,
} from '@/types';

type DbProfile = {
  id: string;
  name: string | null;
  email: string | null;
  role: 'representante' | 'admin';
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

type DbImportadora = {
  id: string;
  name: string;
  cnpj: string;
  logo: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type DbCategory = {
  id: string;
  name: string;
  subcategories: string[] | unknown;
  created_at: string;
};

type DbProduct = {
  id: string;
  importadora_id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  min_order: number;
  category: string;
  subcategory: string | null;
  image: string | null;
  observations: string | null;
  active: boolean;
  material: string | null;
  detalhe1: string | null;
  detalhe2: string | null;
  detalhe3: string | null;
  dimensions: string | null;
  created_at: string;
  updated_at: string;
  importadoras?: { name: string } | null;
};

type DbCliente = {
  id: string;
  representante_id: string;
  name: string;
  business_name: string | null;
  cnpj: string | null;
  state_registration: string | null;
  email: string | null;
  phone: string;
  cep: string | null;
  street: string | null;
  number: string | null;
  complement: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
};

type DbTransportadora = {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string | null;
  neighborhood: string;
  city: string;
  state: string;
  created_at: string;
  updated_at: string;
};

type DbOrder = {
  id: string;
  representante_id: string;
  cliente_id: string | null;
  importadora_id: string;
  status: string;
  total: number;
  observations: string | null;
  nota_fiscal: string | null;
  payment_term: string | null;
  transportadora_id: string | null;
  link_id: string | null;
  origin: string;
  is_read: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  profiles?: { name: string } | null;
  clientes?: { name: string } | null;
  importadoras?: { name: string } | null;
};

type DbOrderItem = {
  id: string;
  order_id: string;
  product_id: string;
  product_code: string;
  product_name: string;
  product_price: number;
  quantity: number;
  observations: string | null;
  created_at: string;
  products?: DbProduct & { importadoras?: { name: string } | null } | null;
};

type DbCommission = {
  id: string;
  representante_id: string;
  importadora_id: string;
  percentage: number;
  is_exclusive: boolean;
  created_at: string;
};

export function mapProfile(row: DbProfile): User {
  return {
    id: row.id,
    name: row.name ?? '',
    email: row.email ?? '',
    role: row.role,
    phone: row.phone ?? undefined,
    avatar: row.avatar_url ?? undefined,
  };
}

export function mapImportadora(row: DbImportadora): Importadora {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj,
    logo: row.logo ?? undefined,
    active: row.active,
    createdAt: new Date(row.created_at),
  };
}

export function mapCategory(row: DbCategory): Category {
  const sub = row.subcategories;
  return {
    id: row.id,
    name: row.name,
    subcategories: Array.isArray(sub) ? (sub as string[]) : [],
  };
}

export function mapProduct(row: DbProduct): Product {
  const importadoraName = row.importadoras?.name ?? '';
  return {
    id: row.id,
    importadoraId: row.importadora_id,
    importadoraName,
    code: row.code,
    name: row.name,
    description: row.description ?? undefined,
    price: Number(row.price),
    minOrder: row.min_order,
    category: row.category,
    subcategory: row.subcategory ?? undefined,
    image: row.image ?? undefined,
    observations: row.observations ?? undefined,
    active: row.active,
    createdAt: new Date(row.created_at),
    material: row.material ?? undefined,
    detalhe1: row.detalhe1 ?? undefined,
    detalhe2: row.detalhe2 ?? undefined,
    detalhe3: row.detalhe3 ?? undefined,
    dimensions: row.dimensions ?? undefined,
  };
}

export function mapProductFromOrderItem(
  item: DbOrderItem,
  productRow?: DbProduct & { importadoras?: { name: string } | null } | null
): Product {
  const p = productRow ?? item.products;
  if (p) {
    return mapProduct({ ...p, importadora_id: p.importadora_id, importadoras: p.importadoras });
  }
  return {
    id: item.product_id,
    importadoraId: '',
    importadoraName: '',
    code: item.product_code,
    name: item.product_name,
    price: Number(item.product_price),
    minOrder: 1,
    category: '',
    active: true,
    createdAt: new Date(item.created_at),
  };
}

export function mapCliente(row: DbCliente): Cliente {
  return {
    id: row.id,
    representanteId: row.representante_id,
    name: row.name,
    businessName: row.business_name ?? undefined,
    cnpj: row.cnpj ?? undefined,
    stateRegistration: row.state_registration ?? undefined,
    email: row.email ?? undefined,
    phone: row.phone,
    cep: row.cep ?? undefined,
    street: row.street ?? undefined,
    number: row.number ?? undefined,
    complement: row.complement ?? undefined,
    neighborhood: row.neighborhood ?? undefined,
    city: row.city ?? undefined,
    state: row.state ?? undefined,
    createdAt: new Date(row.created_at),
  };
}

export function mapTransportadora(row: DbTransportadora): Transportadora {
  return {
    id: row.id,
    name: row.name,
    cnpj: row.cnpj,
    phone: row.phone,
    cep: row.cep,
    street: row.street,
    number: row.number,
    complement: row.complement ?? undefined,
    neighborhood: row.neighborhood,
    city: row.city,
    state: row.state,
    createdAt: new Date(row.created_at),
  };
}

export function mapOrderItem(item: DbOrderItem): CartItem {
  const product = mapProductFromOrderItem(item);
  return {
    productId: item.product_id,
    product,
    quantity: item.quantity,
    observations: item.observations ?? undefined,
  };
}

export function mapOrder(
  row: DbOrder,
  items: CartItem[]
): Order {
  return {
    id: row.id,
    representanteId: row.representante_id,
    representanteName: row.profiles?.name ?? '',
    clienteId: row.cliente_id ?? undefined,
    clienteName: row.clientes?.name ?? undefined,
    importadoraId: row.importadora_id,
    importadoraName: row.importadoras?.name ?? '',
    items,
    status: row.status as OrderStatus,
    total: Number(row.total),
    observations: row.observations ?? undefined,
    notaFiscal: row.nota_fiscal ?? undefined,
    paymentTerm: row.payment_term ?? undefined,
    transportadoraId: row.transportadora_id ?? undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    linkId: row.link_id ?? undefined,
    origin: row.origin as OrderOrigin,
    isRead: row.is_read,
    notes: row.notes ?? undefined,
  };
}

export function mapCommission(row: DbCommission): Commission {
  return {
    id: row.id,
    representanteId: row.representante_id,
    importadoraId: row.importadora_id,
    percentage: Number(row.percentage),
    isExclusive: row.is_exclusive,
  };
}

export function toDbCliente(c: Partial<Cliente> & { representanteId: string; name: string; phone: string }) {
  return {
    representante_id: c.representanteId,
    name: c.name,
    business_name: c.businessName ?? null,
    cnpj: c.cnpj ?? null,
    state_registration: c.stateRegistration ?? null,
    email: c.email ?? null,
    phone: c.phone,
    cep: c.cep ?? null,
    street: c.street ?? null,
    number: c.number ?? null,
    complement: c.complement ?? null,
    neighborhood: c.neighborhood ?? null,
    city: c.city ?? null,
    state: c.state ?? null,
  };
}

export function toDbOrder(o: Partial<Order> & { representanteId: string; importadoraId: string }) {
  return {
    representante_id: o.representanteId,
    cliente_id: o.clienteId ?? null,
    importadora_id: o.importadoraId,
    status: o.status ?? 'rascunho',
    total: o.total ?? 0,
    observations: o.observations ?? null,
    nota_fiscal: o.notaFiscal ?? null,
    payment_term: o.paymentTerm ?? null,
    transportadora_id: o.transportadoraId ?? null,
    link_id: o.linkId ?? null,
    origin: o.origin ?? 'representante',
    is_read: o.isRead ?? false,
    notes: o.notes ?? null,
  };
}

export type OrderStatus = 'rascunho' | 'aberto' | 'faturado' | 'cancelado';

export type OrderOrigin = 'representante' | 'cliente';

export type UserRole = 'representante' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  avatar?: string;
}

export interface Importadora {
  id: string;
  name: string;
  cnpj: string;
  logo?: string;
  active: boolean;
  createdAt: Date;
}

export interface Category {
  id: string;
  name: string;
  subcategories?: string[];
}

export interface Product {
  id: string;
  importadoraId: string;
  importadoraName: string;
  code: string;
  name: string;
  description?: string;
  price: number;
  minOrder: number;
  category: string;
  subcategory?: string;
  image?: string;
  observations?: string;
  active: boolean;
  createdAt: Date;
  material?: string; // Ex: "plástico", "metal", "madeira"
  detalhe1?: string; // Ex: "cores sortidas"
  detalhe2?: string; // Ex: "Com encaixe para as pernas"
  detalhe3?: string; // Ex: "com buzina"
  dimensions?: string; // Ex: "60x65 cm"
}

export interface CartItem {
  productId: string;
  product: Product;
  quantity: number;
  observations?: string;
}

export interface Cliente {
  id: string;
  representanteId: string;
  name: string;
  businessName?: string; // Nome Fantasia / Razão Social
  cnpj?: string;
  stateRegistration?: string; // Inscrição Estadual
  email?: string;
  phone: string;
  cep?: string;
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  createdAt: Date;
}

export interface Order {
  id: string;
  representanteId: string;
  representanteName: string;
  clienteId?: string;
  clienteName?: string;
  importadoraId: string;
  importadoraName: string;
  items: CartItem[];
  status: OrderStatus;
  total: number;
  observations?: string;
  notaFiscal?: string;
  paymentTerm?: string; // Prazo de pagamento
  transportadoraId?: string; // ID da transportadora selecionada
  createdAt: Date;
  updatedAt: Date;
  linkId?: string;
  origin: OrderOrigin; // 'representante' ou 'cliente'
  isRead: boolean; // se o representante já visualizou o pedido
  notes?: string; // observações do pedido
}

export interface Commission {
  id: string;
  representanteId: string;
  importadoraId: string;
  percentage: number;
  isExclusive: boolean;
}

export interface SalesLink {
  id: string;
  representanteId: string;
  clienteId?: string;
  importadoraId: string;
  products: CartItem[];
  expiresAt?: Date;
  createdAt: Date;
  views: number;
}

export interface Transportadora {
  id: string;
  name: string;
  cnpj: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  createdAt: Date;
}
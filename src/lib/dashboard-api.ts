import { apiRequest } from './api';

export interface DashboardChannel {
  marketplace: string;
  nickname: string;
  status: 'active' | 'revoked' | 'error';
}

export interface DashboardSummary {
  canales: DashboardChannel[];
  catalogo: {
    total: number;
    borradores: number;
    publicados: number;
    conError: number;
    pendientes: number;
  };
  ventas: {
    mes: { pedidos: number; importe: number };
    mesAnterior: { pedidos: number; importe: number };
    variacion: number | null;
    porCanal: { marketplace: string; pedidos: number; importe: number }[];
  };
  stockBajo: { id: string; name: string; sku: string; stock: number }[];
  avisos: { sinLeer: number; problemas: number };
}

export interface DashboardAccount {
  id: string;
  nombre: string;
  email: string;
  empresa: string | null;
  estado: string;
  canales: { marketplace: string; status: string }[];
  canalesCaidos: number;
  ventas: { pedidos: number; importe: number };
  publicaciones: { publicados: number; conError: number };
  problemasSinLeer: number;
}

export interface DashboardAccounts {
  cuentas: DashboardAccount[];
  totales: { clientes: number; pedidos: number; importe: number };
}

export type ModeloDeCobro = 'ninguno' | 'fijo' | 'comision' | 'mixto';
export type EstadoDePago = 'al_dia' | 'por_vencer' | 'vence_hoy' | 'vencido';

/** Un importe desglosado: lo pactado, el subtotal sin IGV, el IGV y el total con IGV. */
export interface Importe {
  pactado: number;
  incluyeIgv: boolean;
  subtotal: number;
  igv: number;
  total: number;
}

export interface TotalConIgv {
  subtotal: number;
  igv: number;
  total: number;
}

/** El plan comercial tal como lo ve el cliente y la agencia. */
export interface ResumenDePlan {
  modelo: ModeloDeCobro;
  moneda: string;
  frecuencia: string;
  cuotaFija: number | null;
  cuotaIncluyeIgv: boolean;
  tasa: number | null;
  comisionIncluyeIgv: boolean;
  proximoPago: string | null;
  estadoPago: EstadoDePago | null;
  diasParaPago: number | null;
  /** De cuándo a cuándo se cuentan las ventas de este cobro */
  ciclo: { desde: string; hasta: string; conFechaPactada: boolean };
  ventasMes: number;
  ventasCiclo: number;
  comisionAcumulada: number;
  comisionProyectada: number | null;
  /** Lo que se cobrará en la fecha de cobro, con su IGV */
  cobro: { cuota: Importe | null; comision: Importe | null } & TotalConIgv;
  igvPorcentaje: number;
}

export interface PlanDelCliente extends ResumenDePlan {
  ventasMesAnterior: number;
  ultimoPago: { fecha: string; monto: number; concepto: string } | null;
}

export interface CanalDeVenta {
  marketplace: string;
  unidades: number;
  importe: number;
  /** Qué parte de lo que ingresó el producto viene de este canal (0 a 100) */
  porcentaje: number;
  /** Dirección de la publicación del producto en este canal, si se conoce */
  url?: string | null;
}

export interface Ganadora {
  sku: string;
  nombre: string;
  unidades: number;
  importe: number;
  /** El canal donde más ingresó este producto y todos los canales donde se vendió */
  canal?: CanalDeVenta | null;
  canales?: CanalDeVenta[];
  stock: number | null;
  diasDeStock: number | null;
  imagen: string | null;
  reponer: boolean;
}

export interface DashboardInsights {
  ganadoras: Ganadora[];
  porDespachar: { vencidos: number; hoy: number; total: number };
  ventasDiarias: { dia: string; pedidos: number; importe: number }[];
  pendientesDeRevision: number;
  plan: PlanDelCliente | null;
}

export interface Propuesta {
  recomendacion: 'sin_datos' | 'mantener' | 'pasar_a_fijo' | 'pasar_a_comision' | 'definir_plan';
  titulo: string;
  ventasPromedio: number;
  tendencia: 'sube' | 'baja' | 'estable' | null;
  escenarios: { modelo: 'fijo' | 'comision'; etiqueta: string; costoMensual: number }[];
  texto: string;
}

/** Cada tienda es un cliente de la agencia. */
export interface AgencyClient {
  id: string;
  nombre: string;
  /** Correo de quien creó la tienda (no siempre es el cliente) */
  dueno: string;
  canales: { marketplace: string; status: string }[];
  canalesCaidos: number;
  ventas: {
    mes: number;
    pedidosMes: number;
    mesesAnteriores: { periodo: string; importe: number }[];
  };
  plan: ResumenDePlan;
  ultimoPago: { fecha: string; monto: number } | null;
  propuesta: Propuesta;
  notasDePropuesta: string | null;
}

export interface Agency {
  hoy: string;
  igvPorcentaje: number;
  totales: {
    clientes: number;
    /** Todo lo vendido este mes, de cualquier tienda (solo precio de productos) */
    ventasDelMes: number;
    pedidosDelMes: number;
    /** La parte que corresponde a los clientes de la lista */
    ventasDeClientes: number;
    /** Cuotas fijas de clientes activos llevadas a mes, sin IGV */
    ingresoFijoMensual: number;
    /** Lo que debe ingresar hasta la fecha de cobro de cada cliente: cuota + comisión acumulada */
    porIngresar: TotalConIgv;
    porIngresarCuotas: TotalConIgv;
    porIngresarComisiones: TotalConIgv;
    /** Comisión acumulada en los ciclos abiertos, sin IGV */
    comisionAcumulada: number;
    comisionProyectada: number;
    cobradoEsteMes: number;
    vencidos: { cantidad: number } & TotalConIgv;
    proximos: { cantidad: number } & TotalConIgv;
    sinPlan: number;
    porModelo: { fijo: number; comision: number; mixto: number };
  };
  clientes: AgencyClient[];
}

/** Lo mismo que ve el dueño de la tienda en su dashboard, para revisarlo a detalle. */
export interface ClientDetail {
  tienda: { id: string; nombre: string; dueno: string };
  resumen: DashboardSummary;
  insights: DashboardInsights;
  plan: PlanDelCliente | null;
  pagos: { id: string; fecha: string; monto: number; concepto: string; tipo: string }[];
}

/** Lo que se puede cambiar del plan de una tienda. */
export interface StorePlanDto {
  billingModel?: ModeloDeCobro;
  monthlyFee?: number | null;
  feeFrequency?: 'mensual' | 'trimestral' | 'anual';
  commissionRate?: number | null;
  nextDueDate?: string | null;
  planCurrency?: string;
  feeIncludesIgv?: boolean;
  commissionIncludesIgv?: boolean;
  planStartDate?: string | null;
  proposalNotes?: string | null;
}

export interface StorePaymentDto {
  amount: number;
  type: 'unico' | 'recurrente';
  frequency?: 'mensual' | 'trimestral' | 'anual';
  concept: string;
  paidAt: string;
  method?: string;
  notes?: string;
}

export const dashboardApi = {
  getSummary: () => apiRequest<DashboardSummary>('/dashboard/summary', { method: 'GET' }),
  getInsights: () => apiRequest<DashboardInsights>('/dashboard/insights', { method: 'GET' }),
  getAgency: () => apiRequest<Agency>('/dashboard/agency', { method: 'GET' }),
  /** El dashboard de una tienda (cliente), como lo ve su dueño (solo superadmin). */
  getClientDetail: (storeId: string) =>
    apiRequest<ClientDetail>(`/dashboard/agency/stores/${storeId}`, { method: 'GET' }),
  /** Guarda el plan comercial de una tienda. */
  updateStorePlan: (storeId: string, dto: StorePlanDto) =>
    apiRequest<{ id: string }>(`/dashboard/agency/stores/${storeId}/plan`, { method: 'PATCH', body: JSON.stringify(dto) }),
  /** Registra un pago recibido; si es recurrente, la fecha del próximo cobro avanza sola. */
  registerStorePayment: (storeId: string, dto: StorePaymentDto) =>
    apiRequest<{ id: string; proximoPago: string | null }>(`/dashboard/agency/stores/${storeId}/payments`, { method: 'POST', body: JSON.stringify(dto) }),
  getAccounts: () => apiRequest<DashboardAccounts>('/dashboard/accounts', { method: 'GET' }),
};

/** Importes en soles, sin decimales cuando no hacen falta. */
export function money(amount: number): string {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

export const MARKETPLACE_LABEL: Record<string, string> = {
  mercadolibre: 'Mercado Libre',
  falabella: 'Falabella',
  yavendio: 'Yavendió',
  shopify: 'Shopify',
  woocommerce: 'WooCommerce',
  amazon: 'Amazon',
};

/** Importe en la moneda del plan (soles por defecto). */
export function moneyIn(amount: number, currency = 'PEN'): string {
  return new Intl.NumberFormat('es-PE', { style: 'currency', currency, maximumFractionDigits: amount % 1 === 0 ? 0 : 2 }).format(amount);
}

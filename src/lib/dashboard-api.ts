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

/** El plan comercial tal como lo ve el cliente y la agencia. */
export interface ResumenDePlan {
  modelo: ModeloDeCobro;
  moneda: string;
  cuotaFija: number | null;
  frecuencia: string;
  tasa: number | null;
  proximoPago: string | null;
  estadoPago: EstadoDePago | null;
  diasParaPago: number | null;
  ventasMes: number;
  comisionAcumulada: number;
  comisionProyectada: number | null;
  totalDelMes: number;
}

export interface PlanDelCliente extends ResumenDePlan {
  ventasMesAnterior: number;
  ultimoPago: { fecha: string; monto: number; concepto: string } | null;
  liquidacionMesAnterior: { periodo: string; comision: number; estado: 'pendiente' | 'facturado' | 'cobrado' } | null;
}

export interface Ganadora {
  sku: string;
  nombre: string;
  unidades: number;
  importe: number;
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

export interface AgencyClient {
  id: string;
  nombre: string;
  email: string;
  empresa: string | null;
  estado: string;
  ventas: {
    mes: number;
    pedidosMes: number;
    mesesAnteriores: { periodo: string; importe: number }[];
  };
  plan: ResumenDePlan;
  ultimoPago: { fecha: string; monto: number } | null;
  liquidacionMesAnterior: { periodo: string; comision: number; estado: 'pendiente' | 'facturado' | 'cobrado' } | null;
  propuesta: Propuesta;
  notasDePropuesta: string | null;
}

export interface Agency {
  hoy: string;
  totales: {
    clientes: number;
    ventasDelMes: number;
    pedidosDelMes: number;
    ingresoFijoMensual: number;
    comisionAcumulada: number;
    comisionProyectada: number;
    cobradoEsteMes: number;
    vencidos: { cantidad: number; monto: number };
    proximos: { cantidad: number; monto: number };
    sinPlan: number;
    porModelo: { fijo: number; comision: number; mixto: number };
  };
  clientes: AgencyClient[];
}

export const dashboardApi = {
  getInsights: () => apiRequest<DashboardInsights>('/dashboard/insights', { method: 'GET' }),
  getAgency: () => apiRequest<Agency>('/dashboard/agency', { method: 'GET' }),
  getSummary: () => apiRequest<DashboardSummary>('/dashboard/summary', { method: 'GET' }),
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

/** Estado de una venta, igual para todos los canales (el servidor traduce lo que dice cada uno). */
export type SaleState = "pendiente" | "enviado" | "entregado" | "cancelado" | "devuelto";

export const SALE_STATES: { value: SaleState; singular: string; label: string; clase: string }[] = [
  { value: "pendiente", singular: "Pendiente", label: "Pendientes", clase: "bg-amber-500/10 text-amber-500 border-amber-500/30" },
  { value: "enviado", singular: "Enviado", label: "Enviados", clase: "bg-blue-500/10 text-blue-400 border-blue-500/30" },
  { value: "entregado", singular: "Entregado", label: "Entregados", clase: "bg-green-500/10 text-green-500 border-green-500/30" },
  { value: "cancelado", singular: "Cancelado", label: "Cancelados", clase: "bg-red-500/10 text-red-400 border-red-500/30" },
  { value: "devuelto", singular: "Devuelto", label: "Devueltos", clase: "bg-purple-500/10 text-purple-400 border-purple-500/30" },
];

export const saleStateInfo = (s?: string | null) => SALE_STATES.find((e) => e.value === s);

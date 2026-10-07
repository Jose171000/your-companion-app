/** Nombre legible de cada canal. */
export const CHANNEL_NAMES: Record<string, string> = {
  mercadolibre: "MercadoLibre",
  falabella: "Falabella",
  yavendio: "Yavendió",
  shopify: "Shopify",
  amazon: "Amazon",
};

export const channelName = (id: string) => CHANNEL_NAMES[id] ?? id;

/** Precio con el símbolo de su moneda (mismo formato que el resto de la app). */
export const money = (n: number | string | null | undefined, currency = "PEN") =>
  `${currency === "USD" ? "$" : "S/"} ${Number(n || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

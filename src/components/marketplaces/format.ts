/** Nombre legible de cada canal. */
export const CHANNEL_NAMES: Record<string, string> = {
  mercadolibre: "MercadoLibre",
  falabella: "Falabella",
  yavendio: "Yavendió",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  amazon: "Amazon",
  // Canales que se registran a mano (no conectados)
  ripley: "Ripley",
  juntoz: "Juntoz",
  whatsapp: "WhatsApp",
  "tienda-fisica": "Tienda física",
  "web-propia": "Web propia",
  otro: "Otro",
};

/** Un canal que no conocemos (escrito a mano al registrar una venta) se muestra con mayúscula inicial: «mi-feria» → «Mi feria». */
export const channelName = (id: string) => {
  if (CHANNEL_NAMES[id]) return CHANNEL_NAMES[id];
  const t = String(id ?? "").replace(/-/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Precio con el símbolo de su moneda (mismo formato que el resto de la app). */
export const money = (n: number | string | null | undefined, currency = "PEN") =>
  `${currency === "USD" ? "$" : "S/"} ${Number(n || 0).toLocaleString("es-PE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

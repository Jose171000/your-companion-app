import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";
import { syncApi } from "@/lib/sync-api";
import { useStores } from "@/contexts/StoreContext";

interface Marketplace {
  id: string;
  name: string;
  logo: string;
  imgClass?: string;
}

const marketplaces: Marketplace[] = [
  { id: "mercadolibre", name: "MercadoLibre", logo: "/mercadolibre.png" },
  { id: "amazon", name: "Amazon", logo: "/amazon.png", imgClass: "scale-[1.7]" },
  { id: "shopify", name: "Shopify", logo: "/shopify.png" },
  { id: "woocommerce", name: "WooCommerce", logo: "/woocomerce.png" },
  { id: "falabella", name: "Falabella", logo: "/Falabella.png" },
  { id: "ripley", name: "Ripley", logo: "/Logo_Ripley_com.png" },
  { id: "juntoz", name: "Juntoz", logo: "/juntoz.png", imgClass: "scale-[1.8]" },
  { id: "yape", name: "Yape", logo: "/yape-logo-fondo-transparente.png" },
];

interface MarketplaceSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MarketplaceSelector({ selected, onChange }: MarketplaceSelectorProps) {
  // Solo los canales que la tienda tiene conectados: no se puede publicar donde no hay cuenta.
  const { activeStore } = useStores();
  const storeId = activeStore?.id;
  const { data, isLoading } = useQuery({
    queryKey: ["sync-connections", storeId],
    queryFn: () => syncApi.getConnections(),
    enabled: !!storeId,
    staleTime: 30_000,
  });
  const conectados = new Set((data?.data ?? []).filter((c) => c.status === "active").map((c) => c.marketplace));
  const disponibles = marketplaces.filter((mp) => conectados.has(mp.id));

  // Si cambia la tienda o se desconecta un canal, se quita lo elegido que ya no está disponible;
  // y con un solo canal conectado no hay nada que elegir: queda marcado.
  useEffect(() => {
    if (isLoading || !data) return;
    const validos = selected.filter((id) => conectados.has(id));
    if (validos.length === 0 && disponibles.length === 1) onChange([disponibles[0].id]);
    else if (validos.length !== selected.length) onChange(validos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, isLoading]);

  const toggleMarketplace = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-base md:text-lg text-[#111111] dark:text-[#F8F8F5]">Marketplaces destino</h3>
          <p className="text-xs md:text-sm text-[#666666] dark:text-[#A1A1AA]">
            Estos son los canales que tienes conectados. Elige dónde quieres publicar
          </p>
        </div>
        <span className="text-xs md:text-sm text-[#666666] dark:text-[#A1A1AA] font-medium bg-[#F8F8F5] dark:bg-[#1A1A1A] px-3 py-1 rounded-full border border-[#EAEAEA] dark:border-white/20">
          {selected.length} seleccionados
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : disponibles.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[#EAEAEA] dark:border-white/20 p-6 text-center">
          <p className="text-sm font-medium text-[#111111] dark:text-[#F8F8F5]">Esta tienda todavía no tiene canales conectados</p>
          <p className="text-xs text-[#666666] dark:text-[#A1A1AA] mt-1">
            Conecta Mercado Libre, Falabella, WooCommerce o Shopify desde la sección <span className="font-semibold">Marketplaces</span> del menú para poder publicar.
          </p>
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
        {disponibles.map((mp) => {
          const isSelected = selected.includes(mp.id);
          return (
            <button
              key={mp.id}
              onClick={() => toggleMarketplace(mp.id)}
              className={cn(
                "relative flex flex-col items-center justify-center p-3 md:p-4 rounded-[16px] border transition-all duration-200",
                  isSelected
                  ? "border-[#FCCB34] bg-[#FFF7D6] dark:bg-[#FCCB34]/20 shadow-[0_4px_12px_rgba(252,203,52,0.15)]"
                  : "border-[#EAEAEA] dark:border-white/20 bg-white dark:bg-[#222222] hover:border-[#FCCB34]/40 dark:hover:border-white/40 hover:shadow-[0_8px_20px_rgba(0,0,0,0.06)] hover:-translate-y-0.5"
              )}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 w-5 h-5 rounded-full bg-[#FCCB34] flex items-center justify-center shadow-sm z-10">
                  <Check className="w-3 h-3 text-[#111111] stroke-[3]" />
                </div>
              )}
              <div className="w-full h-12 md:h-16 px-2 py-1 flex items-center justify-center mb-1.5 md:mb-2 bg-transparent dark:bg-[#EAEAEA] rounded-[8px]">
                <img src={mp.logo} alt={mp.name} className={cn("w-full h-full object-contain", mp.imgClass)} />
              </div>
              <span className="text-xs md:text-sm font-semibold text-[#111111] dark:text-[#F8F8F5] text-center leading-tight">{mp.name}</span>
            </button>
          );
        })}
      </div>
      )}
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Marketplace {
  id: string;
  name: string;
  logo: string;
  color: string;
}

const marketplaces: Marketplace[] = [
  { id: "mercadolibre", name: "MercadoLibre", logo: "🛒", color: "from-yellow-500 to-yellow-600" },
  { id: "amazon", name: "Amazon", logo: "📦", color: "from-orange-500 to-orange-600" },
  { id: "shopify", name: "Shopify", logo: "🛍️", color: "from-green-500 to-green-600" },
  { id: "woocommerce", name: "WooCommerce", logo: "🔮", color: "from-purple-500 to-purple-600" },
  { id: "falabella", name: "Falabella", logo: "🏬", color: "from-lime-500 to-lime-600" },
  { id: "ripley", name: "Ripley", logo: "🏪", color: "from-red-500 to-red-600" },
  { id: "juntoz", name: "Juntoz", logo: "🎯", color: "from-blue-500 to-blue-600" },
  { id: "yape", name: "Yape", logo: "💜", color: "from-fuchsia-500 to-fuchsia-600" },
];

interface MarketplaceSelectorProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MarketplaceSelector({ selected, onChange }: MarketplaceSelectorProps) {
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
          <h3 className="font-semibold text-base md:text-lg">Marketplaces destino</h3>
          <p className="text-xs md:text-sm text-muted-foreground">
            Selecciona dónde quieres enviar los productos
          </p>
        </div>
        <span className="text-xs md:text-sm text-muted-foreground">
          {selected.length} seleccionados
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3">
        {marketplaces.map((mp) => {
          const isSelected = selected.includes(mp.id);
          
          return (
            <button
              key={mp.id}
              onClick={() => toggleMarketplace(mp.id)}
              className={cn(
                "relative flex flex-col items-center gap-1.5 md:gap-2 p-3 md:p-4 rounded-xl border-2 transition-all duration-200",
                isSelected
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/50 hover:bg-secondary"
              )}
            >
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 w-4 h-4 md:w-5 md:h-5 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-2.5 h-2.5 md:w-3 md:h-3 text-primary-foreground" />
                </div>
              )}
              <div
                className={cn(
                  "w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center text-xl md:text-2xl bg-gradient-to-br",
                  mp.color
                )}
              >
                {mp.logo}
              </div>
              <span className="text-xs md:text-sm font-medium text-center">{mp.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

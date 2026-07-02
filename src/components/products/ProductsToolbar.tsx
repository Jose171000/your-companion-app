import { useEffect, useState } from "react";
import { Search, Plus, Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MARKETPLACES = [
  { id: "mercadolibre", name: "MercadoLibre" },
  { id: "amazon", name: "Amazon" },
  { id: "shopify", name: "Shopify" },
  { id: "woocommerce", name: "WooCommerce" },
  { id: "falabella", name: "Falabella" },
  { id: "ripley", name: "Ripley" },
  { id: "juntoz", name: "Juntoz" },
  { id: "yape", name: "Yape" },
];

interface ProductsToolbarProps {
  search: string;
  onSearchChange: (v: string) => void;
  marketplace: string;
  onMarketplaceChange: (v: string) => void;
  inStock: boolean;
  onInStockChange: (v: boolean) => void;
  onNewProduct: () => void;
  onExport: (format: "csv" | "xlsx" | "json") => void;
}

export function ProductsToolbar({
  search,
  onSearchChange,
  marketplace,
  onMarketplaceChange,
  inStock,
  onInStockChange,
  onNewProduct,
  onExport,
}: ProductsToolbarProps) {
  const [localSearch, setLocalSearch] = useState(search);

  // Debounce search → notify parent after 400 ms
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) onSearchChange(localSearch);
    }, 400);
    return () => clearTimeout(timer);
  }, [localSearch]); // eslint-disable-line react-hooks/exhaustive-deps

  // If parent resets search (e.g. clear filters), sync local state
  useEffect(() => {
    if (search === "" && localSearch !== "") setLocalSearch("");
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col lg:flex-row gap-3 items-start lg:items-center justify-between">
      {/* ── Filters ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto flex-1 min-w-0">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            id="products-search-input"
            placeholder="Buscar por nombre, SKU..."
            className="pl-10 bg-secondary/50 border-border focus:border-primary h-10"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
          />
        </div>

        {/* Marketplace filter */}
        <Select
          value={marketplace || "__all__"}
          onValueChange={(v) => onMarketplaceChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger
            id="products-marketplace-filter"
            className="w-full sm:w-48 bg-secondary/50 border-border h-10 shrink-0"
          >
            <SelectValue placeholder="Marketplace" />
          </SelectTrigger>
          <SelectContent className="glass">
            <SelectItem value="__all__">Todos los canales</SelectItem>
            {MARKETPLACES.map((mp) => (
              <SelectItem key={mp.id} value={mp.id}>
                {mp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* In-stock toggle */}
        <div className="flex items-center gap-2 h-10 px-1 shrink-0">
          <Switch
            id="products-in-stock-toggle"
            checked={inStock}
            onCheckedChange={onInStockChange}
          />
          <Label htmlFor="products-in-stock-toggle" className="text-sm cursor-pointer whitespace-nowrap">
            Solo en stock
          </Label>
        </div>
      </div>

      {/* ── Export & New product buttons ───────────────────── */}
      <div className="flex w-full lg:w-auto gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="w-full lg:w-auto font-semibold">
              <Download className="w-4 h-4 mr-2" />
              Exportar
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onExport("csv")}>Exportar como CSV</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("xlsx")}>Exportar como Excel</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onExport("json")}>Exportar como JSON</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          id="products-new-btn"
          onClick={onNewProduct}
          className="w-full lg:w-auto gradient-primary glow-primary font-semibold"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Producto
        </Button>
      </div>
    </div>
  );
}

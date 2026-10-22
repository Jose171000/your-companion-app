import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Edit, FileText, ImageOff, PackageCheck, Rocket, Sparkles, Trash2 } from "lucide-react";
import { Product, ProductOverview, productsApi } from "@/lib/products-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProductCard } from "./ProductCard";
import { CategoryCell, ChannelsCell, CompletenessCell, GroupChannelsCell, GroupCompletenessCell } from "./ProductStatusCells";

export interface RowHandlers {
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  onRegenerate: (product: Product) => void;
  onPublish: (product: Product) => void;
  onPrepareFalabella: (product: Product) => void;
  onSheet: (product: Product) => void;
}

interface CommonProps extends RowHandlers {
  overview?: Record<string, ProductOverview>;
  overviewLoading?: boolean;
}

const etiquetaDeVariante = (p: Product) => (p.variantValues ? Object.values(p.variantValues).join(" / ") : p.name);

const precio = (v?: number | string | null) => (v != null ? `$${Number(v).toFixed(2)}` : "—");

function StockBadge({ stock }: { stock?: number | null }) {
  if (stock == null) return <span className="text-muted-foreground text-sm">—</span>;
  return (
    <span className={cn("text-xs font-semibold px-2 py-1 rounded", Number(stock) > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>
      {Number(stock) > 0 ? stock : "Sin stock"}
    </span>
  );
}

function Thumb({ product }: { product: Product }) {
  return (
    <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary/50 border border-border flex items-center justify-center shrink-0">
      {product.images?.[0] ? <img src={product.images[0].url} alt={product.name} className="w-full h-full object-cover" /> : <ImageOff className="w-4 h-4 text-muted-foreground" />}
    </div>
  );
}

function RowActions({ product, onSheet, onPublish, onPrepareFalabella, onRegenerate, onEdit, onDelete }: RowHandlers & { product: Product }) {
  const btn = "h-8 w-8 hover:text-primary hover:bg-primary/10";
  return (
    <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
      <Button variant="ghost" size="icon" className={btn} onClick={() => onSheet(product)} title="Ficha: lo que se envía a cada canal"><FileText className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn} onClick={() => onPublish(product)} title="Publicar en marketplaces"><Rocket className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn} onClick={() => onPrepareFalabella(product)} title="Preparar para Falabella (categoría, medidas y atributos)"><PackageCheck className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-accent hover:bg-accent/10" onClick={() => onRegenerate(product)} title="Regenerar con IA"><Sparkles className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className={btn} onClick={() => onEdit(product)} title="Editar"><Edit className="w-4 h-4" /></Button>
      <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(product)} title="Eliminar"><Trash2 className="w-4 h-4" /></Button>
    </div>
  );
}

/** Fila de un producto simple, o de una variante dentro de su grupo desplegado. */
export function ProductRow({ product, overview, overviewLoading, variant, ...handlers }: CommonProps & { product: Product; variant?: boolean }) {
  const ov = overview?.[product.id];
  return (
    <tr className={cn("hover:bg-secondary/20 transition-colors group", variant && "bg-secondary/10")}>
      <td className={cn("px-4 py-3", variant && "pl-12")}>
        <div className="flex items-center gap-3">
          {variant && <span className="w-px self-stretch bg-border -ml-4 mr-1" aria-hidden />}
          <Thumb product={product} />
          <span className="font-medium text-sm truncate max-w-[200px]">{variant ? etiquetaDeVariante(product) : product.name}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <code className="text-xs font-mono bg-secondary/70 text-muted-foreground px-2 py-1 rounded">{product.sku}</code>
      </td>
      <td className="px-4 py-3">{variant ? <span className="text-xs text-muted-foreground">Misma del grupo</span> : <CategoryCell overview={ov} loading={overviewLoading} />}</td>
      <td className="px-4 py-3"><span className="text-sm font-semibold">{precio(product.price)}</span></td>
      <td className="px-4 py-3"><StockBadge stock={product.stock} /></td>
      <td className="px-4 py-3"><ChannelsCell overview={ov} intended={product.targetMarketplaces ?? []} loading={overviewLoading} /></td>
      <td className="px-4 py-3"><CompletenessCell overview={ov} loading={overviewLoading} /></td>
      <td className="px-4 py-3"><RowActions product={product} {...handlers} /></td>
    </tr>
  );
}

function usarVariantes(groupId: string, abierto: boolean) {
  return useQuery({
    queryKey: ["products", { groupId }],
    queryFn: () => productsApi.findAll({ groupId, limit: 100, sortBy: "createdAt", order: "asc" }),
    enabled: abierto,
    staleTime: 30_000,
  });
}

/** Un producto con variantes: una fila con el resumen y, al desplegar, una fila por variante. */
export function GroupRows({ product, overview, overviewLoading, ...handlers }: CommonProps & { product: Product }) {
  const [abierto, setAbierto] = useState(false);
  const grupo = product.group!;
  const resumen = product.groupSummary!;
  const { data, isLoading } = usarVariantes(grupo.id, abierto);
  const variantes = data?.data?.data ?? [];

  const overviews = resumen.variantIds.map((id) => overview?.[id]).filter(Boolean) as ProductOverview[];
  const rango = resumen.priceMin != null && resumen.priceMax != null && resumen.priceMin !== resumen.priceMax ? `${precio(resumen.priceMin)} – ${precio(resumen.priceMax)}` : precio(resumen.priceMin ?? product.price);
  const ejes = (grupo.axes ?? []).map((e) => e.name).join(" y ");

  return (
    <>
      <tr className="hover:bg-secondary/20 transition-colors group cursor-pointer" onClick={() => setAbierto((a) => !a)}>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={abierto ? "Ocultar variantes" : "Ver variantes"} aria-expanded={abierto}>
              {abierto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <Thumb product={product} />
            <div className="min-w-0">
              <span className="font-medium text-sm truncate max-w-[200px] block">{grupo.name}</span>
              <Badge variant="secondary" className="text-[10px] py-0 px-1.5 mt-0.5">{resumen.variantCount} variantes{ejes ? ` · ${ejes}` : ""}</Badge>
            </div>
          </div>
        </td>
        <td className="px-4 py-3"><code className="text-xs font-mono bg-secondary/70 text-muted-foreground px-2 py-1 rounded">{grupo.parentSku}</code></td>
        <td className="px-4 py-3"><CategoryCell overview={overview?.[product.id]} loading={overviewLoading} /></td>
        <td className="px-4 py-3"><span className="text-sm font-semibold whitespace-nowrap">{rango}</span></td>
        <td className="px-4 py-3"><StockBadge stock={resumen.stockTotal} /></td>
        <td className="px-4 py-3"><GroupChannelsCell overviews={overviews} total={resumen.variantCount} loading={overviewLoading} /></td>
        <td className="px-4 py-3"><GroupCompletenessCell overviews={overviews} total={resumen.variantCount} loading={overviewLoading} /></td>
        <td className="px-4 py-3 text-right text-xs text-muted-foreground">{abierto ? "Ocultar" : "Ver variantes"}</td>
      </tr>
      {abierto && isLoading && (
        <tr><td colSpan={8} className="px-4 py-3 pl-12"><Skeleton className="h-8 w-full" /></td></tr>
      )}
      {abierto && variantes.map((v) => (
        <ProductRow key={v.id} product={v} overview={overview} overviewLoading={overviewLoading} variant {...handlers} />
      ))}
    </>
  );
}

/** Lo mismo en el móvil: tarjeta del grupo y, al tocarla, una tarjeta por variante. */
export function GroupCard({ product, overview, overviewLoading, ...handlers }: CommonProps & { product: Product }) {
  const [abierto, setAbierto] = useState(false);
  const grupo = product.group!;
  const resumen = product.groupSummary!;
  const { data, isLoading } = usarVariantes(grupo.id, abierto);
  const variantes = data?.data?.data ?? [];
  const overviews = resumen.variantIds.map((id) => overview?.[id]).filter(Boolean) as ProductOverview[];

  return (
    <div>
      <button type="button" onClick={() => setAbierto((a) => !a)} className="w-full p-4 flex gap-3 text-left hover:bg-secondary/20" aria-expanded={abierto}>
        <Thumb product={product} />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1">
            {abierto ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
            <p className="font-medium text-sm truncate">{grupo.name}</p>
          </div>
          <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{resumen.variantCount} variantes</Badge>
          <p className="text-sm font-bold text-primary">
            {resumen.priceMin != null && resumen.priceMax != null && resumen.priceMin !== resumen.priceMax ? `${precio(resumen.priceMin)} – ${precio(resumen.priceMax)}` : precio(resumen.priceMin ?? product.price)}
            <span className="ml-2 text-xs font-medium text-muted-foreground">{resumen.stockTotal} uds.</span>
          </p>
          <GroupChannelsCell overviews={overviews} total={resumen.variantCount} loading={overviewLoading} />
          <GroupCompletenessCell overviews={overviews} total={resumen.variantCount} loading={overviewLoading} />
        </div>
      </button>
      {abierto && (
        <div className="border-l-2 border-border ml-6 divide-y divide-border/50">
          {isLoading && <Skeleton className="h-16 w-full m-3" />}
          {variantes.map((v) => (
            <ProductCard key={v.id} product={v} overview={overview?.[v.id]} overviewLoading={overviewLoading} onEdit={handlers.onEdit} onDelete={handlers.onDelete} onRegenerate={handlers.onRegenerate} onPublish={handlers.onPublish} onSheet={handlers.onSheet} />
          ))}
        </div>
      )}
    </div>
  );
}

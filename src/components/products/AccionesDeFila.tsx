import { Edit, MoreHorizontal, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { Product } from "@/lib/products-api";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useStores } from "@/contexts/StoreContext";

/**
 * Una sola acción a la vista: «Gestionar» abre el panel del producto (canales, precios y stock, contenido). Lo menos frecuente
 * (editar, regenerar con IA, eliminar) queda en el menú «⋯».
 */
export function AccionesDeFila({ producto, etiqueta, onSheet, onRegenerate, onEdit, onDelete }: {
  producto: Product; etiqueta?: string
  onSheet: (p: Product) => void; onRegenerate: (p: Product) => void; onEdit: (p: Product) => void; onDelete: (p: Product) => void;
}) {
  const { can } = useStores();
  const hayMenu = can("productos.editar") || can("productos.eliminar");
  return (
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => onSheet(producto)} title="Canales, precios y stock, y lo que se envía a cada canal">
        <SlidersHorizontal className="w-4 h-4" /> Gestionar
      </Button>
      {hayMenu && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Más opciones"><MoreHorizontal className="w-4 h-4" /></Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {can("productos.editar") && <DropdownMenuItem onClick={() => onEdit(producto)}><Edit className="w-4 h-4 mr-2" />{etiqueta ? `Editar ${etiqueta}` : "Editar"}</DropdownMenuItem>}
            {can("productos.editar") && <DropdownMenuItem onClick={() => onRegenerate(producto)}><Sparkles className="w-4 h-4 mr-2" />Regenerar con IA</DropdownMenuItem>}
            {can("productos.eliminar") && can("productos.editar") && <DropdownMenuSeparator />}
            {can("productos.eliminar") && <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => onDelete(producto)}><Trash2 className="w-4 h-4 mr-2" />{etiqueta ? `Eliminar ${etiqueta}` : "Eliminar"}</DropdownMenuItem>}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

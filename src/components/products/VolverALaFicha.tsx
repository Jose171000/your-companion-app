import { ArrowLeft } from "lucide-react";

/** Flecha para regresar a la ficha del producto desde la ventana que se abrió encima (Preparar, Publicar). */
export function VolverALaFicha({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-fit">
      <ArrowLeft className="w-3.5 h-3.5" /> Volver a la ficha
    </button>
  );
}

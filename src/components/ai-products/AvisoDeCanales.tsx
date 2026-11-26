import { AlertTriangle } from "lucide-react";

/** Explica por qué «Generar con IA» está apagado cuando no hay ningún canal elegido. */
export function AvisoDeCanales() {
  return (
    <p role="status" className="flex items-center gap-2 text-xs text-amber-500">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      Primero selecciona en qué canales vas a publicar (arriba).
    </p>
  );
}

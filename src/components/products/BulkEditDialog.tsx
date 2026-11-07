import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, Upload } from "lucide-react";
import { bulkUploadApi, type ResultadoEdicionMasiva } from "@/lib/bulk-upload-api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const ETIQUETA = { nombre: "Nombre", precio: "Precio", stock: "Stock", descripcion: "Descripción" } as const;
const mostrar = (campo: keyof typeof ETIQUETA, v: string | number | null) =>
  v === null || v === "" ? "—" : campo === "precio" ? `S/ ${Number(v).toLocaleString("es-PE", { minimumFractionDigits: 2 })}` : String(v);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Edición masiva en tres pasos: bajar el Excel con los productos actuales, subirlo editado, revisar qué cambiaría y aplicar. */
export function BulkEditDialog({ open, onOpenChange }: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vista, setVista] = useState<ResultadoEdicionMasiva | null>(null);
  const [final, setFinal] = useState<ResultadoEdicionMasiva | null>(null);
  const [cargando, setCargando] = useState<"plantilla" | "revisar" | "aplicar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reiniciar = () => { setArchivo(null); setVista(null); setFinal(null); setError(null); if (inputRef.current) inputRef.current.value = ""; };
  const cerrar = (abierto: boolean) => { if (!abierto) reiniciar(); onOpenChange(abierto); };

  const bajarPlantilla = async () => {
    setCargando("plantilla");
    try { await bulkUploadApi.downloadEditTemplate(); } catch (e: any) { toast.error(e?.message ?? "No se pudo descargar el Excel"); } finally { setCargando(null); }
  };

  const revisar = async (f: File) => {
    setArchivo(f); setVista(null); setFinal(null); setError(null); setCargando("revisar");
    const res = await bulkUploadApi.bulkEdit(f, false);
    setCargando(null);
    if (res.error || !res.data) setError(res.error ?? "No se pudo leer el Excel"); else setVista(res.data);
  };

  const aplicar = async () => {
    if (!archivo) return;
    setCargando("aplicar");
    const res = await bulkUploadApi.bulkEdit(archivo, true);
    setCargando(null);
    if (res.error || !res.data) { toast.error(res.error ?? "No se pudo aplicar la edición"); return; }
    setFinal(res.data);
    setVista(null);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    queryClient.invalidateQueries({ queryKey: ["change-requests"] });
  };

  return (
    <Dialog open={open} onOpenChange={cerrar}>
      <DialogContent className="sm:max-w-[760px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edición masiva de productos</DialogTitle>
          <DialogDescription>Cambia nombre, precio y stock de muchos productos a la vez con un Excel. Antes de aplicar ves qué cambiaría en cada uno.</DialogDescription>
        </DialogHeader>

        {final ? (
          <div className="space-y-3 text-sm">
            <p className="flex items-center gap-2 text-green-500 font-medium"><CheckCircle2 className="w-4 h-4" /> {final.actualizados ?? 0} producto(s) actualizados.</p>
            {(final.enRevision ?? 0) > 0 && (
              <p className="text-yellow-400">{final.enRevision} cambio(s) de precio o stock quedaron en <b>Revisión</b>: apruébalos allí para que lleguen a los canales.</p>
            )}
            {final.errores.length > 0 && (
              <div className="text-red-400 space-y-0.5">
                <p>{final.errores.length} fila(s) no se pudieron aplicar:</p>
                {final.errores.slice(0, 10).map((e, i) => <p key={i} className="text-xs">· {e.sku}: {e.mensaje}</p>)}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium">1. Descarga tus productos</p>
                <p className="text-xs text-muted-foreground">Un Excel con SKU, nombre, precio y stock actuales. Cambia lo que quieras (no el SKU) y guárdalo.</p>
              </div>
              <Button variant="outline" size="sm" onClick={bajarPlantilla} disabled={cargando === "plantilla"} className="shrink-0">
                {cargando === "plantilla" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />} Descargar Excel
              </Button>
            </div>

            <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
              <div className="text-sm">
                <p className="font-medium">2. Sube el Excel editado</p>
                <p className="text-xs text-muted-foreground">{archivo ? archivo.name : "Una celda vacía significa «no tocar». También puedes agregar una columna Descripción."}</p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void revisar(f); }} />
              <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={cargando === "revisar"} className="shrink-0">
                {cargando === "revisar" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />} {archivo ? "Cambiar archivo" : "Subir Excel"}
              </Button>
            </div>

            {error && <p className="text-sm text-red-400 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</p>}

            {vista && (
              <div className="space-y-3">
                <p className="font-medium text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> 3. Revisa lo que cambiaría</p>
                <p className="text-sm">
                  <b>{vista.conCambios}</b> producto(s) con cambios · {vista.sinCambios} sin cambios · {vista.totalFilas} filas leídas.
                </p>
                {vista.noEncontrados.length > 0 && (
                  <p className="text-xs text-yellow-400">{vista.noEncontrados.length} SKU no existen en esta tienda y se ignoran: {vista.noEncontrados.slice(0, 6).join(", ")}{vista.noEncontrados.length > 6 ? "…" : ""}</p>
                )}
                {vista.errores.length > 0 && (
                  <div className="text-xs text-red-400 space-y-0.5">
                    <p>{vista.errores.length} fila(s) con problemas (no se aplicarán):</p>
                    {vista.errores.slice(0, 8).map((e, i) => <p key={i}>· {e.sku}: {e.mensaje}</p>)}
                  </div>
                )}
                {vista.cambios.length > 0 && (
                  <div className="rounded-lg border border-border divide-y divide-border/50 max-h-72 overflow-y-auto">
                    {vista.cambios.map((c) => (
                      <div key={c.sku} className="px-3 py-2 text-xs">
                        <p className="font-medium text-sm truncate" title={c.nombre}>{c.nombre} <code className="text-[10px] text-muted-foreground font-mono">{c.sku}</code></p>
                        {c.cambios.map((x) => (
                          <p key={x.campo} className="text-muted-foreground">
                            {ETIQUETA[x.campo]}: <span className="line-through">{mostrar(x.campo, x.antes)}</span> → <span className="text-foreground font-medium">{mostrar(x.campo, x.despues)}</span>
                          </p>
                        ))}
                      </div>
                    ))}
                    {vista.cambiosOmitidos > 0 && <p className="px-3 py-2 text-xs text-muted-foreground">… y {vista.cambiosOmitidos} más (se aplican igual).</p>}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground">Los cambios de precio y stock siguen las reglas de tu tienda: con el modo revisión encendido quedan pendientes de aprobar antes de llegar a los canales.</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => cerrar(false)}>{final ? "Cerrar" : "Cancelar"}</Button>
          {!final && (
            <Button onClick={aplicar} disabled={!vista || vista.conCambios === 0 || cargando === "aplicar"}>
              {cargando === "aplicar" && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {vista ? `Aplicar ${vista.conCambios} cambio(s)` : "Aplicar cambios"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

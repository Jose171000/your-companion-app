import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, FileSpreadsheet, Loader2, Plus, Trash2 } from "lucide-react";
import { ManualSaleProduct, ManualSalesResult, Sale, syncApi } from "@/lib/sync-api";
import { SkuPicker } from "./SkuPicker";
import { SALE_STATES } from "@/lib/sale-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { aIso } from "@/components/common/DateRangeFilter";

/** Canales que se ofrecen; «otro» deja escribir el nombre que se quiera. */
const CANALES = ["Ripley", "Juntoz", "Amazon", "WhatsApp", "Tienda física", "Web propia"];
const OTRO = "__otro__";

interface Linea { producto: ManualSaleProduct | null; cantidad: string; precio: string; descontar: boolean }
const lineaVacia = (): Linea => ({ producto: null, cantidad: "1", precio: "", descontar: true });
/** Hoy en fecha local (igual que el filtro de fechas): de noche en Lima la fecha universal ya es mañana. */
const hoy = () => aIso(new Date());

/**
 * Registra ventas de canales que la tienda NO tiene conectados (Ripley, Juntoz, WhatsApp, tienda física…), una por una
 * o con un Excel. Cuentan en Ventas, Analíticas y el cobro como cualquier otra venta.
 */
const clave = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function ManualSaleDialog({ open, onOpenChange, editar, onGuardada }: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** Una venta manual para editar (con sus datos de edición); sin ella, se registran ventas nuevas. */
  editar?: Sale | null;
  onGuardada?: () => void;
}) {
  const queryClient = useQueryClient();
  const [canal, setCanal] = useState("Ripley");
  const [canalOtro, setCanalOtro] = useState("");
  const [fecha, setFecha] = useState(hoy());
  const [numero, setNumero] = useState("");
  const [estado, setEstado] = useState("entregado");
  const [cliente, setCliente] = useState("");
  const [telefono, setTelefono] = useState("");
  const [documento, setDocumento] = useState("");
  const [direccion, setDireccion] = useState("");
  const [envio, setEnvio] = useState("");
  const [notas, setNotas] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([lineaVacia()]);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ManualSalesResult | null>(null);
  const archivo = useRef<HTMLInputElement>(null);
  const edicion = editar?.manualEdit ?? null;

  // Al editar, el formulario se llena con los datos de la venta.
  useEffect(() => {
    if (!open || !edicion) return;
    const conocido = CANALES.find((c) => clave(c) === edicion.canal);
    setCanal(conocido ?? OTRO);
    setCanalOtro(conocido ? "" : edicion.canal.replace(/-/g, " "));
    setFecha(edicion.fecha);
    setNumero(edicion.numeroPedido);
    setEstado(edicion.estado);
    setCliente(edicion.cliente);
    setTelefono(edicion.telefono);
    setDocumento(edicion.documento);
    setDireccion(edicion.direccion);
    setEnvio(edicion.envio ? String(edicion.envio) : "");
    setNotas(edicion.notas);
    setLineas(edicion.lineas.map((l) => ({ producto: l.producto, cantidad: String(l.cantidad), precio: String(l.precio), descontar: l.descontar })));
    setResultado(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editar?.id]);

  const cambiar = (i: number, parte: Partial<Linea>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...parte } : l)));
  const canalFinal = canal === OTRO ? canalOtro.trim() : canal;
  // Sin precio escrito se usa el del catálogo (el servidor hace lo mismo).
  const total = lineas.reduce((s, l) => s + (Number(l.cantidad) || 0) * (Number(l.precio) || (l.producto?.price ?? 0)), 0);

  const alTerminar = (r: ManualSalesResult) => {
    setResultado(r);
    if (r.registradas) {
      toast.success(`${r.registradas} ${r.registradas === 1 ? "venta registrada" : "ventas registradas"}`);
      for (const k of ["sync-orders", "sales-report", "dashboard-summary", "products"]) queryClient.invalidateQueries({ queryKey: [k] });
    }
  };

  const registrar = async () => {
    if (!canalFinal) { toast.error("Elige o escribe el canal de la venta."); return; }
    if (lineas.some((l) => !l.producto)) { toast.error("Elige el producto de cada línea (busca por SKU o nombre)."); return; }
    const filas = lineas.map((l, i) => ({
      numero_pedido: numero.trim() || undefined,
      ...(i === 0 ? { fecha, canal: canalFinal, estado, envio, cliente, telefono, documento, direccion, notas } : {}),
      sku: l.producto!.sku,
      cantidad: l.cantidad,
      precio_unitario: l.precio,
      descontar_stock: l.descontar ? "SI" : "NO",
    }));
    if (editar && edicion) {
      setEnviando(true);
      const res = await syncApi.updateManualSale(editar.id, filas as any);
      setEnviando(false);
      if (res.error || !res.data) { toast.error(res.error ?? "No se pudo guardar la venta"); return; }
      toast.success("Venta actualizada");
      for (const k of ["sync-orders", "sync-order", "sales-report", "dashboard-summary", "products"]) queryClient.invalidateQueries({ queryKey: [k] });
      onOpenChange(false);
      onGuardada?.();
      return;
    }
    // Con varias líneas hace falta un número para que sean una sola venta.
    const conNumero = lineas.length > 1 && !numero.trim() ? filas.map((f) => ({ ...f, numero_pedido: `V-${Date.now().toString(36)}` })) : filas;
    setEnviando(true);
    const res = await syncApi.registerManualSale(conNumero as any);
    setEnviando(false);
    if (res.error || !res.data) { toast.error(res.error ?? "No se pudo registrar la venta"); return; }
    alTerminar(res.data);
    if (res.data.registradas && !res.data.rechazadas.length) {
      setLineas([lineaVacia()]); setNumero(""); setCliente(""); setTelefono(""); setDocumento(""); setDireccion(""); setEnvio(""); setNotas("");
    }
  };

  const subirExcel = async (file: File | undefined) => {
    if (!file) return;
    setEnviando(true);
    const res = await syncApi.importManualSales(file);
    setEnviando(false);
    if (archivo.current) archivo.current.value = "";
    if (res.error || !res.data) { toast.error(res.error ?? "No se pudo leer el archivo"); return; }
    alTerminar(res.data);
  };

  const plantilla = async () => {
    try { await syncApi.downloadManualSalesTemplate(); } catch (e: any) { toast.error(e?.message ?? "No se pudo descargar la plantilla"); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setResultado(null); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{edicion ? "Editar venta" : "Registrar ventas"}</DialogTitle>
          <DialogDescription>
            {edicion
              ? "Al guardar, el stock descontado antes se devuelve y se descuenta de nuevo con los datos nuevos."
              : "Para ventas de canales que no tienes conectados (Ripley, Juntoz, WhatsApp, tienda física…). Las de Mercado Libre y Falabella entran solas."}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="una">
          <TabsList className={edicion ? "hidden" : "grid grid-cols-2 w-full"}>
            <TabsTrigger value="una">Una venta</TabsTrigger>
            <TabsTrigger value="excel">Desde Excel</TabsTrigger>
          </TabsList>

          <TabsContent value="una" className="space-y-4 pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Canal</Label>
                <Select value={canal} onValueChange={setCanal}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CANALES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    <SelectItem value={OTRO}>Otro…</SelectItem>
                  </SelectContent>
                </Select>
                {canal === OTRO && <Input placeholder="Nombre del canal" value={canalOtro} onChange={(e) => setCanalOtro(e.target.value)} />}
              </div>
              <div className="space-y-1.5">
                <Label>Fecha de la venta</Label>
                <Input type="date" value={fecha} max={hoy()} onChange={(e) => setFecha(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>N.º de pedido <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="R-1001" />
              </div>
              <div className="space-y-1.5">
                <Label>Estado</Label>
                <Select value={estado} onValueChange={setEstado}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SALE_STATES.map((e) => <SelectItem key={e.value} value={e.value}>{e.singular}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Productos</Label>
              {lineas.map((l, i) => (
                <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                  <SkuPicker
                    value={l.producto}
                    onPick={(p) => cambiar(i, { producto: p, precio: l.precio || (p.price != null ? String(p.price) : "") })}
                    onClear={() => cambiar(i, { producto: null })}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cantidad</Label>
                      <Input type="number" min={1} step={1} value={l.cantidad} onChange={(e) => cambiar(i, { cantidad: e.target.value })} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Precio por unidad</Label>
                      <Input type="number" min={0} step="0.01" placeholder="Precio del catálogo" value={l.precio} onChange={(e) => cambiar(i, { precio: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <Checkbox checked={l.descontar} onCheckedChange={(v) => cambiar(i, { descontar: v === true })} />
                      Descontar del stock
                    </label>
                    {lineas.length > 1 && (
                      <Button type="button" variant="ghost" size="sm" onClick={() => setLineas((ls) => ls.filter((_, j) => j !== i))}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setLineas((ls) => [...ls, lineaVacia()])}>
                <Plus className="w-3.5 h-3.5" /> Agregar producto
              </Button>
              <p className="text-xs text-muted-foreground">Busca por SKU o por nombre y elige el producto. El precio es lo que pagó el cliente por una unidad, sin el envío; vacío usa el del catálogo.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Cliente</Label><Input value={cliente} onChange={(e) => setCliente(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Teléfono</Label><Input value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Documento</Label><Input value={documento} onChange={(e) => setDocumento(e.target.value)} /></div>
              <div className="space-y-1.5">
                <Label>Envío cobrado <span className="text-muted-foreground font-normal">(no cuenta para la comisión)</span></Label>
                <Input type="number" min={0} step="0.01" value={envio} onChange={(e) => setEnvio(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Dirección</Label><Input value={direccion} onChange={(e) => setDireccion(e.target.value)} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Notas</Label><Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-sm text-muted-foreground tabular-nums">Productos: <span className="text-foreground font-semibold">S/ {total.toFixed(2)}</span></p>
              <Button onClick={registrar} disabled={enviando} className="gap-1.5">
                {enviando && <Loader2 className="w-4 h-4 animate-spin" />} {edicion ? "Guardar cambios" : "Registrar venta"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="excel" className="space-y-4 pt-3">
            <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
              <li>Descarga la plantilla y llena una fila por producto, identificado solo por su SKU del catálogo (varias filas con el mismo n.º de pedido son una sola venta). Con el precio vacío se usa el del catálogo.</li>
              <li>Borra las filas de ejemplo y sube el archivo.</li>
            </ol>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="gap-1.5" onClick={plantilla}>
                <Download className="w-4 h-4" /> Descargar plantilla
              </Button>
              <Button type="button" className="gap-1.5" disabled={enviando} onClick={() => archivo.current?.click()}>
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />} Subir Excel
              </Button>
              <input ref={archivo} type="file" accept=".xlsx" className="hidden" onChange={(e) => subirExcel(e.target.files?.[0])} />
            </div>
          </TabsContent>
        </Tabs>

        {resultado && (
          <div className="rounded-xl border border-border p-3 text-sm space-y-1.5">
            <p className="font-medium">{resultado.registradas} {resultado.registradas === 1 ? "venta registrada" : "ventas registradas"}{resultado.rechazadas.length ? ` · ${resultado.rechazadas.length} sin registrar` : ""}</p>
            {resultado.rechazadas.length > 0 && (
              <ul className="text-xs text-amber-500 list-disc pl-4 space-y-0.5 break-words">
                {resultado.rechazadas.slice(0, 30).map((r, i) => <li key={i}>{r}</li>)}
                {resultado.rechazadas.length > 30 && <li>… y {resultado.rechazadas.length - 30} más</li>}
              </ul>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

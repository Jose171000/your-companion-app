import { useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, Loader2, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { activityAdminApi, BloqueDeInforme, FiltroDeActividad, OpcionesDeDescarga, PantallaConMapa } from "@/lib/activity-admin-api";
import { nombreDePantalla } from "@/lib/activity-labels";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const BLOQUES: { clave: BloqueDeInforme; titulo: string; ayuda: string; soloUna?: boolean; soloTodas?: boolean }[] = [
  { clave: "resumen", titulo: "Indicadores", ayuda: "Personas, sesiones, tiempo activo, pantallas, clics y acciones" },
  { clave: "secciones", titulo: "Secciones más usadas", ayuda: "Qué pantallas se abren más" },
  { clave: "funciones", titulo: "Funciones más usadas", ayuda: "Acciones que cambian datos" },
  { clave: "horarios", titulo: "Horarios", ayuda: "Día de la semana por hora" },
  { clave: "clics", titulo: "Mapas de clics", ayuda: "Dónde hacen clic, por pantalla" },
  { clave: "personas", titulo: "Personas", ayuda: "Resumen de cada persona", soloTodas: true },
  { clave: "linea", titulo: "Línea de tiempo", ayuda: "Lo último que hizo la persona elegida", soloUna: true },
];

/**
 * Descargas de Superadmin › Actividad. Por defecto baja TODO (informe completo) con los filtros puestos; «Personalizar…»
 * deja elegir el formato, los bloques y las pantallas de los mapas. Solo superadmin (el servidor también lo exige).
 */
export function DescargasDeActividad({ filtro, pantallas }: { filtro: FiltroDeActividad; pantallas: PantallaConMapa[] }) {
  const [bajando, setBajando] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [formato, setFormato] = useState<OpcionesDeDescarga["formato"]>("pdf");
  const [bloques, setBloques] = useState<BloqueDeInforme[]>([]);
  const [elegidas, setElegidas] = useState<string[]>([]);

  const disponibles = BLOQUES.filter((b) => (b.soloUna ? !!filtro.userId : b.soloTodas ? !filtro.userId : true));

  const bajar = async (o: OpcionesDeDescarga) => {
    setBajando(true);
    try {
      // Lo marcado con otro filtro (p. ej. «Personas» y luego se eligió una persona) ya no aplica.
      const validos = o.bloques.filter((b) => disponibles.some((d) => d.clave === b));
      await activityAdminApi.download(filtro, { ...o, bloques: validos });
      toast.success(o.formato === "pdf" ? "PDF descargado" : "Excel descargado");
      setAbierto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setBajando(false);
    }
  };

  const alternar = <T,>(lista: T[], v: T, poner: (l: T[]) => void) => poner(lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  // Sin marcar nada se baja todo; al marcar algo, solo eso.
  const haceFalta = bloques.length > 0 || elegidas.length > 0;
  const incluyeClics = bloques.length === 0 || bloques.includes("clics");

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={bajando} data-track="actividad-descargar">
            {bajando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
            Descargar<ChevronDown className="w-3.5 h-3.5 ml-1.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuItem data-track="actividad-descargar-pdf" onSelect={() => void bajar({ formato: "pdf", bloques: [], pantallas: [] })}>
            <FileText className="w-4 h-4 mr-2" />PDF visual (todo)
          </DropdownMenuItem>
          <DropdownMenuItem data-track="actividad-descargar-excel" onSelect={() => void bajar({ formato: "xlsx", bloques: [], pantallas: [] })}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />Excel (todo, una hoja por tema)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem data-track="actividad-personalizar" onSelect={() => setAbierto(true)}>
            <SlidersHorizontal className="w-4 h-4 mr-2" />Personalizar…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Descargar información personalizada</DialogTitle>
            <DialogDescription>
              Usa los filtros que tienes puestos ({filtro.from} al {filtro.to}{filtro.userId ? ", una persona" : ""}). Si no marcas nada, se incluye todo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <p className="text-sm font-medium">Formato</p>
              <div className="grid grid-cols-2 gap-2">
                {([["pdf", "PDF visual", FileText], ["xlsx", "Excel", FileSpreadsheet]] as const).map(([clave, titulo, Icono]) => (
                  <button
                    key={clave}
                    type="button"
                    aria-pressed={formato === clave}
                    data-track="actividad-formato"
                    onClick={() => setFormato(clave)}
                    className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors", formato === clave ? "border-primary bg-primary/10" : "border-border text-muted-foreground hover:text-foreground")}
                  >
                    <Icono className="w-4 h-4" />{titulo}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Qué incluir</p>
              {disponibles.map((b) => (
                <label key={b.clave} className="flex items-start gap-3 cursor-pointer" data-track="actividad-bloque">
                  <Checkbox checked={bloques.includes(b.clave)} onCheckedChange={() => alternar(bloques, b.clave, setBloques)} className="mt-0.5" />
                  <span className="text-sm leading-tight">{b.titulo}<span className="block text-xs text-muted-foreground">{b.ayuda}</span></span>
                </label>
              ))}
            </div>

            {incluyeClics && pantallas.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Pantallas de los mapas de clics</p>
                <p className="text-xs text-muted-foreground">Sin marcar ninguna se incluyen todas (en el PDF, las {Math.min(12, pantallas.length)} con más clics).</p>
                <div className="max-h-44 overflow-y-auto space-y-1.5 rounded-lg border border-border p-3">
                  {pantallas.map((p) => (
                    <label key={p.pantalla} className="flex items-center gap-3 cursor-pointer text-sm" data-track="actividad-pantalla">
                      <Checkbox checked={elegidas.includes(p.pantalla)} onCheckedChange={() => alternar(elegidas, p.pantalla, setElegidas)} />
                      <span className="flex-1 truncate">{nombreDePantalla(p.pantalla)}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{p.clics} clics</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {haceFalta && <Button type="button" variant="ghost" onClick={() => { setBloques([]); setElegidas([]); }}>Quitar selección</Button>}
            <Button type="button" disabled={bajando} onClick={() => void bajar({ formato, bloques, pantallas: incluyeClics ? elegidas : [] })}>
              {bajando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Download className="w-4 h-4 mr-2" />}
              Descargar {formato === "pdf" ? "PDF" : "Excel"}{haceFalta ? "" : " (todo)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

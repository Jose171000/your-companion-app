import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Loader2, ShieldCheck } from "lucide-react";
import { CatalogoDeRoles, RolPersonalizado, storesApi } from "@/lib/stores-api";
import { desmarcar, marcar, Permiso, PermisoDelCatalogo, rolDeFabricaIgualA } from "@/lib/store-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  storeId: string;
  catalogo: CatalogoDeRoles;
  /** El rol que se edita; null para crear uno nuevo. */
  rol: RolPersonalizado | null;
  onBack: () => void;
  onSaved: () => void;
}

const EN_BLANCO = "blanco";
const GRUPOS = ["Ver", "Productos", "Canales", "Ventas"];

const titulos = (claves: Iterable<Permiso>, catalogo: readonly PermisoDelCatalogo[]) =>
  [...claves].map((c) => catalogo.find((p) => p.clave === c)?.titulo ?? c);

/**
 * Crear o editar un rol personalizado. Al empezar desde un rol de fábrica se marcan todos sus permisos; si se quita o agrega
 * alguno, el rol deja de ser de fábrica y pasa a «Personalizado» (hay que ponerle nombre). Si el conjunto vuelve a coincidir
 * con uno de fábrica, vuelve a serlo y no se puede guardar como personalizado: se usa ese rol directamente.
 */
export function RoleEditor({ storeId, catalogo, rol, onBack, onSaved }: Props) {
  const [permisos, setPermisos] = useState<Set<Permiso>>(() => new Set(rol?.permissions ?? []));
  const [nombre, setNombre] = useState(rol?.name ?? "");
  const [base, setBase] = useState<string>(EN_BLANCO);

  const deFabrica = useMemo(() => rolDeFabricaIgualA(permisos, catalogo.fabrica), [permisos, catalogo.fabrica]);
  const delicadosMarcados = catalogo.permisos.filter((p) => p.delicado && permisos.has(p.clave));
  const nombreValido = nombre.trim().length >= 2;
  const puedeGuardar = !deFabrica && permisos.size > 0 && nombreValido;

  const guardar = useMutation({
    mutationFn: () => {
      const lista = catalogo.permisos.map((p) => p.clave).filter((c) => permisos.has(c));
      return rol ? storesApi.updateRole(storeId, rol.id, { name: nombre.trim(), permissions: lista }) : storesApi.createRole(storeId, nombre.trim(), lista);
    },
    onSuccess: (res) => {
      if (res.error || !res.data) { toast.error(res.error ?? "No se pudo guardar el rol"); return; }
      toast.success(rol ? "Rol actualizado" : "Rol creado");
      if (res.data.addedAutomatically?.length) toast.info(`Se agregaron solos porque los necesita: ${titulos(res.data.addedAutomatically, catalogo.permisos).join(", ")}`);
      onSaved();
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  const empezarDesde = (valor: string) => {
    setBase(valor);
    const fabrica = catalogo.fabrica.find((f) => f.clave === valor);
    setPermisos(new Set(fabrica?.permisos ?? []));
  };

  const alternar = (permiso: PermisoDelCatalogo, marcado: boolean) => {
    if (marcado) {
      const nuevo = marcar(permisos, permiso.clave, catalogo.permisos);
      const agregados = [...nuevo].filter((p) => !permisos.has(p) && p !== permiso.clave);
      setPermisos(nuevo);
      if (agregados.length) toast.info(`También se marcó lo que necesita: ${titulos(agregados, catalogo.permisos).join(", ")}`);
    } else {
      const { resultado, tambienQuitados } = desmarcar(permisos, permiso.clave, catalogo.permisos);
      setPermisos(resultado);
      if (tambienQuitados.length) toast.info(`También se quitó lo que no puede estar sin él: ${titulos(tambienQuitados, catalogo.permisos).join(", ")}`);
    }
  };

  const grupos = GRUPOS.map((g) => ({ nombre: g, permisos: catalogo.permisos.filter((p) => p.grupo === g) })).filter((g) => g.permisos.length);

  return (
    <div className="space-y-5">
      <button type="button" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground" onClick={onBack}>
        <ArrowLeft className="w-3.5 h-3.5" /> Volver a los roles
      </button>

      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{rol ? `Editar «${rol.name}»` : "Crear un rol personalizado"}</h3>
        {deFabrica
          ? <Badge variant="secondary" className="gap-1"><ShieldCheck className="w-3 h-3" />Rol de fábrica: {deFabrica.nombre}</Badge>
          : <Badge className="bg-[#FCCB34]/20 text-[#FCCB34] hover:bg-[#FCCB34]/20">Personalizado</Badge>}
      </div>

      {!rol && (
        <div className="space-y-2">
          <Label>Empezar desde</Label>
          <Select value={base} onValueChange={empezarDesde}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={EN_BLANCO}>En blanco</SelectItem>
              {catalogo.fabrica.filter((f) => f.clave !== "owner").map((f) => <SelectItem key={f.clave} value={f.clave}>{f.nombre} (marca sus permisos)</SelectItem>)}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Se marcan todos los permisos de ese rol. Si quitas o agregas alguno, deja de ser de fábrica y pasa a ser tuyo.</p>
        </div>
      )}

      {deFabrica ? (
        <p className="rounded-xl bg-secondary/40 p-3 text-xs text-muted-foreground">
          Estos son exactamente los permisos del rol <strong>{deFabrica.nombre}</strong>, así que no hace falta un rol nuevo: úsalo al invitar o al cambiar el rol de alguien.
          Quita o agrega algún permiso para crear uno personalizado.
        </p>
      ) : (
        <div className="space-y-2">
          <Label htmlFor="rol-nombre">Nombre del rol</Label>
          <Input id="rol-nombre" value={nombre} maxLength={40} placeholder="Por ejemplo: Vendedor" onChange={(e) => setNombre(e.target.value)} />
        </div>
      )}

      <div className="space-y-4">
        {grupos.map((g) => (
          <div key={g.nombre} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{g.nombre}</p>
            {g.permisos.map((p) => (
              <label key={p.clave} className="flex items-start gap-3 rounded-lg p-2 hover:bg-secondary/30 cursor-pointer" data-track="rol-permiso">
                <Checkbox checked={permisos.has(p.clave)} onCheckedChange={(v) => alternar(p, v === true)} className="mt-0.5" />
                <span className="text-sm leading-tight">
                  {p.titulo}
                  {p.delicado && <Badge variant="outline" className="ml-2 text-[10px] border-amber-500/50 text-amber-500">Delicado</Badge>}
                  <span className="block text-xs text-muted-foreground">{p.ayuda}</span>
                </span>
              </label>
            ))}
          </div>
        ))}
      </div>

      {delicadosMarcados.length > 0 && (
        <div className="flex gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p>Quien tenga este rol podrá: <strong>{delicadosMarcados.map((p) => p.titulo.toLowerCase()).join(", ")}</strong>. Dalo solo a personas de confianza.</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Gestionar el equipo (invitar, cambiar roles, enlace público) y ver el plan y los cobros son siempre del dueño: no se pueden dar a un rol.
      </p>

      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{permisos.size} de {catalogo.permisos.length} permisos</span>
        <Button className="gradient-primary gap-1.5" disabled={!puedeGuardar || guardar.isPending} onClick={() => guardar.mutate()}>
          {guardar.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          {rol ? "Guardar cambios" : "Crear rol"}
        </Button>
      </div>
    </div>
  );
}

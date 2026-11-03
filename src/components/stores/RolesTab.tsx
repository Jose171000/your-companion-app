import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { RolPersonalizado, storesApi } from "@/lib/stores-api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RoleEditor } from "./RoleEditor";

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** La pestaña «Roles» de la gestión de la tienda: los de fábrica (fijos) y los personalizados de esta tienda. Solo el dueño. */
export function RolesTab({ storeId }: { storeId: string }) {
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<RolPersonalizado | "nuevo" | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  const rolesQuery = useQuery({
    queryKey: ["store-roles", storeId],
    queryFn: () => storesApi.roles(storeId),
    enabled: !!storeId,
  });

  const refrescar = () => {
    queryClient.invalidateQueries({ queryKey: ["store-roles", storeId] });
    queryClient.invalidateQueries({ queryKey: ["store-members", storeId] });
    queryClient.invalidateQueries({ queryKey: ["store-invitations", storeId] });
  };

  const borrar = useMutation({
    mutationFn: (roleId: string) => storesApi.deleteRole(storeId, roleId),
    onSuccess: (res) => {
      setBorrando(null);
      if (res.error) { toast.error(res.error); return; }
      toast.success("Rol borrado");
      refrescar();
    },
  });

  if (rolesQuery.isLoading) return <Skeleton className="h-40 w-full" />;
  const datos = rolesQuery.data?.data;
  if (!datos) return <p className="text-sm text-destructive py-6 text-center">{rolesQuery.data?.error ?? "No se pudieron cargar los roles"}</p>;

  if (editando) {
    return (
      <RoleEditor
        storeId={storeId}
        catalogo={datos}
        rol={editando === "nuevo" ? null : editando}
        onBack={() => setEditando(null)}
        onSaved={() => { setEditando(null); refrescar(); }}
      />
    );
  }

  const titulo = (clave: string) => datos.permisos.find((p) => p.clave === clave)?.titulo ?? clave;

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <p className="text-sm font-semibold">Roles de fábrica</p>
        <p className="text-xs text-muted-foreground">Son los mismos en todas las tiendas y no se pueden modificar. Para algo distinto, crea un rol personalizado.</p>
        {datos.fabrica.map((f) => (
          <details key={f.clave} className="rounded-xl border border-border p-3">
            <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm">
              <span className="font-medium">{f.nombre}</span>
              <span className="text-xs text-muted-foreground">{f.clave === "owner" ? "Todo" : `${f.permisos.length} permisos`}</span>
            </summary>
            <ul className="mt-2 grid gap-x-4 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
              {f.permisos.map((p) => <li key={p}>• {titulo(p)}</li>)}
            </ul>
          </details>
        ))}
      </section>

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">Roles personalizados</p>
          <Button size="sm" className="gap-1.5" disabled={datos.personalizados.length >= datos.maximoDeRoles} onClick={() => setEditando("nuevo")} data-track="crear-rol">
            <Plus className="w-3.5 h-3.5" /> Crear rol
          </Button>
        </div>

        {datos.personalizados.length === 0 && (
          <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            Todavía no hay roles personalizados. Crea uno, por ejemplo «Vendedor», dándole solo los permisos que necesita.
          </p>
        )}

        {datos.personalizados.map((r) => (
          <div key={r.id} className="rounded-xl border border-border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {plural(r.permissions.length, "permiso", "permisos")} · {plural(r.people, "persona", "personas")}
                  {r.invitations > 0 && ` · ${plural(r.invitations, "invitación pendiente", "invitaciones pendientes")}`}
                </p>
              </div>
              {borrando === r.id ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs">¿Borrar?</span>
                  <Button size="sm" variant="destructive" disabled={borrar.isPending} onClick={() => borrar.mutate(r.id)}>Sí, borrar</Button>
                  <Button size="sm" variant="outline" onClick={() => setBorrando(null)}>No</Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Editar ${r.name}`} onClick={() => setEditando(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="outline" size="icon" className="h-8 w-8" aria-label={`Borrar ${r.name}`} onClick={() => setBorrando(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {r.permissions.slice(0, 6).map((p) => <Badge key={p} variant="secondary" className="text-[10px] font-normal">{titulo(p)}</Badge>)}
              {r.permissions.length > 6 && <Badge variant="outline" className="text-[10px] font-normal">+{r.permissions.length - 6} más</Badge>}
            </div>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">Hasta {datos.maximoDeRoles} roles por tienda. Un rol que alguien tiene no se puede borrar: primero cámbiale el rol.</p>
      </section>
    </div>
  );
}

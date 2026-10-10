import { useState } from "react";
import { Check, ChevronDown, Plus, Settings2, Store as StoreIcon } from "lucide-react";
import { ROLE_LABELS, StoreSummary } from "@/lib/stores-api";
import { useStores } from "@/contexts/StoreContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateStoreDialog } from "./CreateStoreDialog";
import { ManageStoreDialog } from "./ManageStoreDialog";

/**
 * Nombre de la tienda activa en la cabecera. Al hacer clic se despliegan todas
 * las tiendas a las que el usuario tiene acceso.
 */
export function StoreSwitcher() {
  const { stores, activeStore, setActiveStore, isLoading, canCreateStores } = useStores();
  const [createOpen, setCreateOpen] = useState(false);
  const [manage, setManage] = useState<StoreSummary | null>(null);

  if (isLoading && !activeStore) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 max-w-[11rem] sm:max-w-[16rem]">
            <StoreIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">{activeStore?.name ?? "Sin tienda"}</span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0 opacity-70" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Tus tiendas</DropdownMenuLabel>

          {stores.map((s) => (
            <DropdownMenuItem key={s.id} className="gap-2 justify-between" onSelect={() => setActiveStore(s.id)}>
              <span className="flex items-center gap-2 min-w-0">
                <Check className={`w-3.5 h-3.5 shrink-0 ${s.id === activeStore?.id ? "opacity-100" : "opacity-0"}`} />
                <span className="truncate">{s.name}</span>
              </span>
              <span className="text-[10px] text-muted-foreground shrink-0">{ROLE_LABELS[s.role]}</span>
            </DropdownMenuItem>
          ))}

          <DropdownMenuSeparator />
          {activeStore && (
            <DropdownMenuItem className="gap-2" onSelect={() => setManage(activeStore)}>
              <Settings2 className="w-4 h-4" /> Equipo y enlace de «{activeStore.name}»
            </DropdownMenuItem>
          )}
          {canCreateStores ? (
            <DropdownMenuItem className="gap-2" onSelect={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4" /> Crear tienda
            </DropdownMenuItem>
          ) : (
            <p className="px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
              Tu cuenta se creó por invitación: puedes entrar a las tiendas que te compartan, pero no crear tiendas propias.
            </p>
          )}

        </DropdownMenuContent>
      </DropdownMenu>

      <CreateStoreDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ManageStoreDialog store={manage} onClose={() => setManage(null)} />
    </>
  );
}

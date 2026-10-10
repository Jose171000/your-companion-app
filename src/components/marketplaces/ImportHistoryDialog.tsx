import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { History, Loader2 } from "lucide-react";
import { MarketplaceConnection, syncApi } from "@/lib/sync-api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { channelName } from "./format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Cuentas de venta (Falabella y Mercado Libre) de la tienda activa */
  accounts: MarketplaceConnection[];
}

const PERIODOS = [
  { dias: 30, label: "Últimos 30 días" },
  { dias: 90, label: "Últimos 90 días" },
  { dias: 180, label: "Últimos 6 meses" },
  { dias: 365, label: "Último año" },
];

const accountName = (c: MarketplaceConnection) => c.label || c.externalNickname || c.externalUserId;

/**
 * Trae el registro de ventas anteriores de las cuentas conectadas. Solo deja la
 * constancia: no descuenta stock ni envía avisos, porque esas ventas ya ocurrieron.
 */
export function ImportHistoryDialog({ open, onOpenChange, accounts }: Props) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState("90");
  const [accountId, setAccountId] = useState("all");

  useEffect(() => {
    if (open) {
      setDays("90");
      setAccountId("all");
    }
  }, [open]);

  const mutation = useMutation({
    mutationFn: () => syncApi.importOrderHistory(Number(days), accountId === "all" ? undefined : accountId),
    onSuccess: (res) => {
      if (res.error || !res.data) {
        toast.error(res.error ?? "No se pudo importar el historial");
        return;
      }
      const { totalRegistradas, cuentas } = res.data;
      const fallidas = cuentas.filter((c) => c.error).length;
      const cortadas = cuentas.some((c) => c.incompleto);
      toast.success(`${totalRegistradas} ventas registradas${cortadas ? " (había más: reduce el periodo y repite)" : ""}`);
      if (fallidas) toast.error(`${fallidas} cuenta(s) no se pudieron leer: ${cuentas.find((c) => c.error)?.error}`);
      queryClient.invalidateQueries({ queryKey: ["sync-orders"] });
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      onOpenChange(false);
    },
    onError: () => toast.error("Error al conectar con el servidor"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="w-4 h-4" /> Importar historial de ventas
          </DialogTitle>
          <DialogDescription>
            Trae el registro de las ventas anteriores de tus cuentas. Solo queda la constancia: no se descuenta
            stock ni se envían avisos. Las últimas 48 horas entran con la sincronización normal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Periodo</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PERIODOS.map((p) => <SelectItem key={p.dias} value={String(p.dias)}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {accounts.length > 1 && (
            <div className="space-y-2">
              <Label>Cuenta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las cuentas</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{channelName(a.marketplace)} · {accountName(a)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Se pueden repetir las veces que haga falta: una venta ya registrada no se duplica.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button className="gradient-primary" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? (<><Loader2 className="w-4 h-4 animate-spin mr-2" /> Importando…</>) : "Importar historial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { AsignacionDeRol, RolesDeLaTienda } from "@/lib/stores-api";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";

/** El valor del selector: «f:editor», «f:viewer» o «c:<id del rol personalizado>». */
export type ValorDeRol = `f:${"editor" | "viewer"}` | `c:${string}`;

export const valorDeAsignacion = (a: AsignacionDeRol): ValorDeRol => ("customRoleId" in a ? `c:${a.customRoleId}` : `f:${a.role}`);

export function asignacionDeValor(v: string): AsignacionDeRol {
  return v.startsWith("c:") ? { customRoleId: v.slice(2) } : { role: v === "f:editor" ? "editor" : "viewer" };
}

/** El valor que corresponde a una persona (o invitación) según su rol actual. */
export const valorDeRol = (x: { role: string; customRoleId?: string | null }): ValorDeRol =>
  x.customRoleId ? `c:${x.customRoleId}` : x.role === "editor" ? "f:editor" : "f:viewer";

const FABRICA: { valor: ValorDeRol; nombre: string }[] = [
  { valor: "f:viewer", nombre: "Lector" },
  { valor: "f:editor", nombre: "Editor" },
];

interface Props {
  value: ValorDeRol;
  onChange: (valor: ValorDeRol) => void;
  /** Los roles de la tienda (con los personalizados); mientras carga solo se ofrecen los de fábrica. */
  roles?: RolesDeLaTienda;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
}

/** Elegir entre los roles de fábrica y los personalizados de la tienda. */
export function RolePicker({ value, onChange, roles, triggerClassName, disabled }: Props) {
  const personalizados = roles?.personalizados ?? [];
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ValorDeRol)} disabled={disabled}>
      <SelectTrigger className={triggerClassName} aria-label="Rol"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Roles de fábrica</SelectLabel>
          {FABRICA.map((f) => <SelectItem key={f.valor} value={f.valor}>{f.nombre}</SelectItem>)}
        </SelectGroup>
        {personalizados.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              <SelectLabel>Personalizados</SelectLabel>
              {personalizados.map((r) => <SelectItem key={r.id} value={`c:${r.id}`}>{r.name}</SelectItem>)}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

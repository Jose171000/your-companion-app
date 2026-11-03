import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PRIVACY_PARAGRAPHS, PRIVACY_TITLE } from "@/lib/privacy-notice";

/** El texto del aviso de privacidad (el mismo en el registro y en la ventana para quien ya tiene cuenta). */
export function PrivacyNoticeText({ className }: { className?: string }) {
  return (
    <div className={className ?? "space-y-3 text-sm leading-relaxed text-muted-foreground"}>
      {PRIVACY_PARAGRAPHS.map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

/** Ventana con el aviso completo, para leerlo desde el formulario de registro. */
export function PrivacyNoticeReader({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{PRIVACY_TITLE}</DialogTitle>
          <DialogDescription className="sr-only">Cómo registramos tu actividad en Synkro y qué hacemos con ella.</DialogDescription>
        </DialogHeader>
        <PrivacyNoticeText />
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>Entendido</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Casilla obligatoria de los formularios de registro (tienda independiente e invitado). Si no está marcada, el formulario
 * no se envía. El servidor guarda la versión del aviso y la fecha en que se aceptó.
 */
export function PrivacyCheckbox({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  const [leyendo, setLeyendo] = useState(false);
  return (
    <div className="flex items-start gap-2.5">
      <Checkbox
        id="acceptPrivacy"
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        disabled={disabled}
        className="mt-0.5"
        aria-required="true"
      />
      <label htmlFor="acceptPrivacy" className="text-xs leading-relaxed text-[#444444] dark:text-[#A1A1AA] cursor-pointer">
        He leído y acepto el{" "}
        <button type="button" className="underline font-medium text-[#111111] dark:text-[#FCCB34]" onClick={(e) => { e.preventDefault(); setLeyendo(true); }}>
          aviso de privacidad
        </button>
        : registrarán cómo uso la plataforma (secciones, botones y acciones), nunca lo que escribo ni los datos de mis clientes.
      </label>
      <PrivacyNoticeReader open={leyendo} onOpenChange={setLeyendo} />
    </div>
  );
}

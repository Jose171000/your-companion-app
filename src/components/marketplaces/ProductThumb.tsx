import { useState } from "react";
import { ImageOff, Package } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  src?: string | null;
  alt: string;
  className?: string;
}

/** Miniatura de un producto o variante; si no hay imagen o falla, un icono neutro. */
export function ProductThumb({ src, alt, className }: Props) {
  const [failed, setFailed] = useState(false);
  const box = "w-12 h-12 rounded-xl shrink-0 overflow-hidden border border-border bg-secondary/30";

  if (!src || failed) {
    return (
      <div className={cn(box, "flex items-center justify-center text-muted-foreground", className)} aria-label={alt}>
        {src ? <ImageOff className="w-4 h-4" /> : <Package className="w-4 h-4" />}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn(box, "object-cover", className)}
    />
  );
}

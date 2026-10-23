import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductsPaginationProps {
  page: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Cuántos productos por página y las opciones a elegir */
  pageSize?: number;
  pageSizes?: number[];
  onPageSizeChange?: (n: number) => void;
}

export function ProductsPagination({
  page,
  totalPages,
  total,
  onPageChange,
  pageSize,
  pageSizes,
  onPageSizeChange,
}: ProductsPaginationProps) {
  // Con pocos productos no hay nada que paginar; con más, siempre se puede cambiar cuántos se ven por página.
  if (totalPages <= 1 && !(pageSizes && total > Math.min(...pageSizes))) return null;

  /** Compute which page numbers to show (up to 5) */
  const getPageNumbers = (): number[] => {
    const count = Math.min(5, totalPages);
    let start: number;

    if (totalPages <= 5) {
      start = 1;
    } else if (page <= 3) {
      start = 1;
    } else if (page >= totalPages - 2) {
      start = totalPages - 4;
    } else {
      start = page - 2;
    }

    return Array.from({ length: count }, (_, i) => start + i);
  };

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      {/* Info */}
      <p className="text-sm text-muted-foreground">
        Página{" "}
        <span className="font-semibold text-foreground">{page}</span>
        {" "}de{" "}
        <span className="font-semibold text-foreground">{totalPages}</span>
        {" "}·{" "}
        <span className="font-semibold text-foreground">{total}</span>{" "}
        productos en total
      </p>

      {pageSizes && onPageSizeChange && (
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Por página
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
          >
            {pageSizes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}

      {/* Controls */}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="gap-1 h-8"
        >
          <ChevronLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>

        {/* Page numbers */}
        <div className="hidden sm:flex gap-1 mx-1">
          {getPageNumbers().map((num) => (
            <Button
              key={num}
              variant={num === page ? "default" : "ghost"}
              size="sm"
              onClick={() => onPageChange(num)}
              className={cn(
                "w-8 h-8 p-0 text-sm",
                num === page && "gradient-primary glow-primary"
              )}
            >
              {num}
            </Button>
          ))}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="gap-1 h-8"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

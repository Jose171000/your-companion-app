import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Download, 
  Send, 
  FileJson, 
  FileSpreadsheet, 
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ExportOption {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  type: "download" | "send";
  format?: string;
}

const exportOptions: ExportOption[] = [
  {
    id: "send-marketplace",
    title: "Enviar a Marketplaces",
    description: "Publica directamente en los canales seleccionados",
    icon: Send,
    type: "send",
  },
  {
    id: "download-csv",
    title: "Descargar CSV",
    description: "Formato compatible con la mayoría de plataformas",
    icon: FileSpreadsheet,
    type: "download",
    format: "csv",
  },
  {
    id: "download-json",
    title: "Descargar JSON",
    description: "Formato estructurado para integraciones técnicas",
    icon: FileJson,
    type: "download",
    format: "json",
  },
  {
    id: "download-excel",
    title: "Descargar Excel",
    description: "Archivo .xlsx editable con todas las columnas",
    icon: FileSpreadsheet,
    type: "download",
    format: "xlsx",
  },
];

interface ExportActionsProps {
  visible: boolean;
  selectedMarketplaces: string[];
}

export function ExportActions({ visible, selectedMarketplaces }: ExportActionsProps) {
  if (!visible) return null;

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h3 className="font-semibold text-base md:text-lg">Exportar o publicar</h3>
        <p className="text-xs md:text-sm text-muted-foreground">
          Elige cómo quieres usar los datos generados
        </p>
      </div>

      <div className="grid gap-3 md:gap-4">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          const isSend = option.type === "send";
          
          return (
            <Card
              key={option.id}
              className={cn(
                "p-4 md:p-5 cursor-pointer transition-all hover:border-primary/50 group",
                isSend && "border-primary/30 bg-primary/5"
              )}
            >
              <div className="flex flex-col sm:flex-row items-start gap-3 md:gap-4">
                <div
                  className={cn(
                    "w-10 h-10 md:w-12 md:h-12 rounded-lg md:rounded-xl flex items-center justify-center shrink-0",
                    isSend
                      ? "gradient-primary glow-primary"
                      : "bg-secondary"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 md:w-6 md:h-6",
                      isSend ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm md:text-base">{option.title}</h4>
                  <p className="text-xs md:text-sm text-muted-foreground mt-0.5 md:mt-1">
                    {option.description}
                  </p>
                  
                  {isSend && selectedMarketplaces.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2 md:mt-3">
                      {selectedMarketplaces.map((mp) => (
                        <span
                          key={mp}
                          className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 md:py-1 rounded-full bg-primary/20 text-primary capitalize"
                        >
                          {mp}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  variant={isSend ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "gap-1.5 md:gap-2 shrink-0 text-xs md:text-sm h-8 md:h-9 w-full sm:w-auto mt-2 sm:mt-0",
                    isSend && "gradient-primary text-primary-foreground"
                  )}
                >
                  {isSend ? (
                    <>
                      Publicar
                      <ArrowRight className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
                      {option.format?.toUpperCase()}
                    </>
                  )}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Success state placeholder */}
      <Card className="p-4 md:p-6 bg-green-500/10 border-green-500/30">
        <div className="flex items-center gap-3 md:gap-4">
          <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5 md:w-6 md:h-6 text-green-400" />
          </div>
          <div>
            <h4 className="font-semibold text-sm md:text-base text-green-400">¡Listo para publicar!</h4>
            <p className="text-xs md:text-sm text-muted-foreground">
              Todos los campos requeridos están completos. Puedes publicar o descargar.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

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
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-lg">Exportar o publicar</h3>
        <p className="text-sm text-muted-foreground">
          Elige cómo quieres usar los datos generados
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {exportOptions.map((option) => {
          const Icon = option.icon;
          const isSend = option.type === "send";
          
          return (
            <Card
              key={option.id}
              className={cn(
                "p-5 cursor-pointer transition-all hover:border-primary/50 group",
                isSend && "sm:col-span-2 border-primary/30 bg-primary/5"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                    isSend
                      ? "gradient-primary glow-primary"
                      : "bg-secondary"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-6 h-6",
                      isSend ? "text-primary-foreground" : "text-muted-foreground"
                    )}
                  />
                </div>
                
                <div className="flex-1">
                  <h4 className="font-semibold">{option.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    {option.description}
                  </p>
                  
                  {isSend && selectedMarketplaces.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {selectedMarketplaces.map((mp) => (
                        <span
                          key={mp}
                          className="text-xs px-2 py-1 rounded-full bg-primary/20 text-primary capitalize"
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
                    "gap-2 shrink-0",
                    isSend && "gradient-primary text-primary-foreground"
                  )}
                >
                  {isSend ? (
                    <>
                      Publicar
                      <ArrowRight className="w-4 h-4" />
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
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
      <Card className="p-6 bg-green-500/10 border-green-500/30">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-green-400" />
          </div>
          <div>
            <h4 className="font-semibold text-green-400">¡Listo para publicar!</h4>
            <p className="text-sm text-muted-foreground">
              Todos los campos requeridos están completos. Puedes publicar o descargar.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

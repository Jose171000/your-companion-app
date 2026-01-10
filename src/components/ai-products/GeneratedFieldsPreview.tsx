import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Check, 
  Pencil, 
  RotateCcw, 
  Copy,
  AlertCircle,
  CheckCircle2
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Field {
  id: string;
  label: string;
  value: string;
  required: boolean;
  type: "text" | "textarea" | "number";
  aiGenerated: boolean;
  confidence: "high" | "medium" | "low";
}

// Campos de ejemplo para Electrónica > Celulares
const sampleFields: Field[] = [
  { id: "title", label: "Título optimizado", value: "iPhone 15 Pro Max 256GB - Titanio Natural | 5G | A17 Pro | Nuevo Sellado", required: true, type: "text", aiGenerated: true, confidence: "high" },
  { id: "description", label: "Descripción para marketplace", value: "📱 iPhone 15 Pro Max 256GB Titanio Natural\n\n✅ NUEVO Y SELLADO - Garantía Apple 1 año\n✅ Procesador A17 Pro - El más potente\n✅ Cámara 48MP con zoom óptico 5x\n✅ Pantalla Super Retina XDR 6.7\"\n✅ USB-C con transferencia rápida\n✅ Titanio de grado aeroespacial\n\n🚀 ENVÍO GRATIS a todo el país\n💳 Todas las tarjetas - Hasta 12 cuotas\n🏆 +500 ventas | 100% calificaciones positivas", required: true, type: "textarea", aiGenerated: true, confidence: "high" },
  { id: "brand", label: "Marca", value: "Apple", required: true, type: "text", aiGenerated: true, confidence: "high" },
  { id: "model", label: "Modelo", value: "iPhone 15 Pro Max", required: true, type: "text", aiGenerated: true, confidence: "high" },
  { id: "storage", label: "Almacenamiento", value: "256GB", required: true, type: "text", aiGenerated: true, confidence: "high" },
  { id: "color", label: "Color", value: "Titanio Natural", required: true, type: "text", aiGenerated: true, confidence: "high" },
  { id: "condition", label: "Condición", value: "Nuevo", required: true, type: "text", aiGenerated: true, confidence: "high" },
  { id: "sku", label: "SKU", value: "APPLE-IP15PM-256-TN", required: false, type: "text", aiGenerated: true, confidence: "medium" },
  { id: "ean", label: "Código EAN/UPC", value: "", required: false, type: "text", aiGenerated: false, confidence: "low" },
  { id: "weight", label: "Peso (kg)", value: "0.221", required: false, type: "number", aiGenerated: true, confidence: "high" },
  { id: "dimensions", label: "Dimensiones (cm)", value: "15.99 x 7.67 x 0.83", required: false, type: "text", aiGenerated: true, confidence: "high" },
  { id: "warranty", label: "Garantía", value: "12 meses - Garantía oficial Apple", required: false, type: "text", aiGenerated: true, confidence: "high" },
  { id: "keywords", label: "Palabras clave SEO", value: "iphone 15 pro max, apple, celular, smartphone, titanio, 256gb, nuevo, original", required: false, type: "text", aiGenerated: true, confidence: "high" },
];

interface GeneratedFieldsPreviewProps {
  visible: boolean;
}

export function GeneratedFieldsPreview({ visible }: GeneratedFieldsPreviewProps) {
  const [fields, setFields] = useState<Field[]>(sampleFields);
  const [editingField, setEditingField] = useState<string | null>(null);

  if (!visible) return null;

  const confidenceColors = {
    high: "text-green-400 bg-green-500/10",
    medium: "text-yellow-400 bg-yellow-500/10",
    low: "text-red-400 bg-red-500/10",
  };

  const requiredCount = fields.filter((f) => f.required).length;
  const filledRequired = fields.filter((f) => f.required && f.value).length;

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">Campos generados por IA</h3>
          <p className="text-sm text-muted-foreground">
            Revisa y edita antes de enviar
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            {filledRequired}/{requiredCount} requeridos
          </Badge>
          <Button variant="outline" size="sm" className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Regenerar todo
          </Button>
        </div>
      </div>

      {/* Fields Grid */}
      <div className="grid gap-4">
        {fields.map((field) => (
          <Card
            key={field.id}
            className={cn(
              "p-4 transition-all",
              editingField === field.id && "ring-2 ring-primary"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label className="font-medium text-sm">{field.label}</label>
                  {field.required && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      Requerido
                    </Badge>
                  )}
                  {field.aiGenerated && (
                    <Badge
                      className={cn(
                        "text-[10px] px-1.5 py-0",
                        confidenceColors[field.confidence]
                      )}
                    >
                      IA {field.confidence === "high" ? "✓" : field.confidence === "medium" ? "~" : "?"}
                    </Badge>
                  )}
                </div>

                {editingField === field.id ? (
                  field.type === "textarea" ? (
                    <Textarea
                      value={field.value}
                      onChange={(e) =>
                        setFields(
                          fields.map((f) =>
                            f.id === field.id ? { ...f, value: e.target.value } : f
                          )
                        )
                      }
                      className="min-h-24 bg-secondary/50"
                      autoFocus
                    />
                  ) : (
                    <Input
                      value={field.value}
                      onChange={(e) =>
                        setFields(
                          fields.map((f) =>
                            f.id === field.id ? { ...f, value: e.target.value } : f
                          )
                        )
                      }
                      className="bg-secondary/50"
                      autoFocus
                    />
                  )
                ) : (
                  <p
                    className={cn(
                      "text-sm whitespace-pre-wrap",
                      !field.value && "text-muted-foreground italic"
                    )}
                  >
                    {field.value || "Sin completar"}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-1">
                {editingField === field.id ? (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setEditingField(null)}
                    className="h-8 w-8 text-green-400"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                ) : (
                  <>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingField(field.id)}
                      className="h-8 w-8"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => navigator.clipboard.writeText(field.value)}
                      className="h-8 w-8"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Missing Fields Warning */}
      {filledRequired < requiredCount && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-5 h-5 text-destructive" />
          <p className="text-sm">
            Hay {requiredCount - filledRequired} campos requeridos sin completar.
            Completa la información manualmente o regenera con más contexto.
          </p>
        </div>
      )}
    </div>
  );
}

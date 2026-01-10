import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Category {
  id: string;
  name: string;
  subcategories: { id: string; name: string }[];
}

const categories: Category[] = [
  {
    id: "electronics",
    name: "Electrónica",
    subcategories: [
      { id: "phones", name: "Celulares y Smartphones" },
      { id: "laptops", name: "Laptops y Computadoras" },
      { id: "tablets", name: "Tablets" },
      { id: "accessories", name: "Accesorios" },
      { id: "audio", name: "Audio y Video" },
    ],
  },
  {
    id: "fashion",
    name: "Moda",
    subcategories: [
      { id: "men", name: "Ropa Hombre" },
      { id: "women", name: "Ropa Mujer" },
      { id: "kids", name: "Ropa Niños" },
      { id: "shoes", name: "Calzado" },
      { id: "accessories-fashion", name: "Accesorios de Moda" },
    ],
  },
  {
    id: "home",
    name: "Hogar y Jardín",
    subcategories: [
      { id: "furniture", name: "Muebles" },
      { id: "decoration", name: "Decoración" },
      { id: "kitchen", name: "Cocina" },
      { id: "garden", name: "Jardín" },
    ],
  },
  {
    id: "beauty",
    name: "Belleza y Cuidado Personal",
    subcategories: [
      { id: "skincare", name: "Cuidado de la Piel" },
      { id: "makeup", name: "Maquillaje" },
      { id: "haircare", name: "Cuidado del Cabello" },
      { id: "fragrances", name: "Fragancias" },
    ],
  },
  {
    id: "sports",
    name: "Deportes y Fitness",
    subcategories: [
      { id: "equipment", name: "Equipamiento" },
      { id: "clothing", name: "Ropa Deportiva" },
      { id: "supplements", name: "Suplementos" },
    ],
  },
];

interface CategorySelectorProps {
  value: string;
  onChange: (value: string) => void;
}

export function CategorySelector({ value, onChange }: CategorySelectorProps) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-lg">Categoría del producto</h3>
        <p className="text-sm text-muted-foreground">
          Cada categoría tiene campos específicos que la IA completará
        </p>
      </div>
      
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-12 bg-secondary/50 border-border hover:border-primary/50 transition-colors">
          <SelectValue placeholder="Selecciona una categoría" />
        </SelectTrigger>
        <SelectContent className="glass max-h-80">
          {categories.map((cat) => (
            <SelectGroup key={cat.id}>
              <SelectLabel className="text-primary font-semibold">
                {cat.name}
              </SelectLabel>
              {cat.subcategories.map((sub) => (
                <SelectItem
                  key={sub.id}
                  value={`${cat.id}/${sub.id}`}
                  className="cursor-pointer hover:bg-primary/10"
                >
                  {sub.name}
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

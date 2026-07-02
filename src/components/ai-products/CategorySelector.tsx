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
        <h3 className="font-semibold text-lg text-[#111111] dark:text-[#F8F8F5]">Categoría del producto</h3>
        <p className="text-sm text-[#666666] dark:text-[#A1A1AA]">
          Cada categoría tiene campos específicos que la IA completará
        </p>
      </div>
      
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-12 bg-white dark:bg-[#1A1A1A] border-[#EAEAEA] dark:border-white/20 hover:border-[#FCCB34]/60 focus:border-[#FCCB34] focus:ring-[#FCCB34] transition-colors shadow-sm dark:text-[#F8F8F5]">
          <SelectValue placeholder="Selecciona una categoría" />
        </SelectTrigger>
        <SelectContent className="bg-white dark:bg-[#1A1A1A] border-[#EAEAEA] dark:border-white/20 shadow-lg max-h-80">
          {categories.map((cat) => (
            <SelectGroup key={cat.id}>
              <SelectLabel className="text-[#111111] dark:text-[#F8F8F5] font-bold">
                {cat.name}
              </SelectLabel>
              {cat.subcategories.map((sub) => (
                <SelectItem
                  key={sub.id}
                  value={`${cat.id}/${sub.id}`}
                  className="cursor-pointer hover:bg-[#FFF7D6] dark:hover:bg-[#FCCB34]/20 focus:bg-[#FFF7D6] dark:focus:bg-[#FCCB34]/20 dark:text-[#F8F8F5]"
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

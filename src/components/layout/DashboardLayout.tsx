import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Resumen general de tu negocio" },
  products: { title: "Productos", subtitle: "Gestiona tu catálogo de productos" },
  "ai-products": { title: "IA para Productos", subtitle: "Optimiza tus productos con inteligencia artificial" },
  marketplaces: { title: "Marketplaces", subtitle: "Conecta y sincroniza tus canales de venta" },
  analytics: { title: "Analíticas", subtitle: "Métricas y reportes de rendimiento" },
  settings: { title: "Configuración", subtitle: "Ajustes de tu cuenta y preferencias" },
};

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [activeItem, setActiveItem] = useState("ai-products");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const pageInfo = pageTitles[activeItem] || { title: "Dashboard", subtitle: "" };

  return (
    <div className="min-h-screen bg-background dark">
      <Sidebar activeItem={activeItem} onItemChange={setActiveItem} />
      
      <main
        className={cn(
          "transition-all duration-300",
          sidebarCollapsed ? "ml-20" : "ml-64"
        )}
      >
        <Header title={pageInfo.title} subtitle={pageInfo.subtitle} />
        
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

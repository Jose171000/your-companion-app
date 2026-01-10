import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();

  const pageInfo = pageTitles[activeItem] || { title: "Dashboard", subtitle: "" };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar 
        activeItem={activeItem} 
        onItemChange={(id) => {
          setActiveItem(id);
          setMobileMenuOpen(false);
        }}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      
      <main
        className={cn(
          "transition-all duration-300",
          isMobile ? "ml-0" : (sidebarCollapsed ? "ml-20" : "ml-64")
        )}
      >
        <Header 
          title={pageInfo.title} 
          subtitle={pageInfo.subtitle}
          onMenuClick={() => setMobileMenuOpen(true)}
          showMenuButton={isMobile}
        />
        
        <div className="p-4 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Package,
  Sparkles,
  Settings,
  Store,
  BarChart3,
  ShieldCheck,
  Wallet,
  ChevronLeft,
  ChevronRight,
  X, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

interface NavItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  id: string;
  badge?: string;
  adminOnly?: boolean;
}

/** Estas dos nunca se restringen: sin ellas la app sería inusable. */
const ALWAYS_ALLOWED = ["dashboard", "settings"];

/**
 * ¿El usuario puede ver esta sección? El administrador siempre puede,
 * y una lista vacía significa acceso completo.
 */
export function isSectionAllowed(
  sectionId: string,
  allowedSections?: string[] | null,
  isAdmin?: boolean,
): boolean {
  if (isAdmin) return true;
  if (ALWAYS_ALLOWED.includes(sectionId)) return true;
  if (!allowedSections || allowedSections.length === 0) return true;
  return allowedSections.includes(sectionId);
}

const navItems: NavItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", id: "dashboard" },
  { icon: Package, label: "Productos", id: "products" },
  { icon: Sparkles, label: "IA Productos", id: "ai-products", badge: "Nuevo" },
  { icon: Store, label: "Marketplaces", id: "marketplaces" },
  { icon: BarChart3, label: "Analíticas", id: "analytics" },
  { icon: Users, label: "CRM", id: "crm" },
  { icon: ShieldCheck, label: "Superadmin", id: "admin", adminOnly: true },
  { icon: Settings, label: "Configuración", id: "settings" },
];

interface SidebarProps {
  activeItem: string;
  onItemChange: (id: string) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  isAdmin?: boolean;
  /** El contador entra a la misma sección, pero recortada */
  isAccountant?: boolean;
  /** Secciones permitidas; vacío o nulo = acceso completo */
  allowedSections?: string[] | null;
  /** Además de las secciones del usuario, lo que permite su rol en la tienda activa (ver docs/roles-de-tienda.md) */
  storeAllows?: (sectionId: string) => boolean;
}

export function Sidebar({
  activeItem,
  onItemChange,
  mobileOpen,
  onMobileClose,
  isAdmin,
  isAccountant,
  allowedSections,
  storeAllows,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  const items = navItems
    .filter((item) => {
      if (item.adminOnly && !isAdmin) return false;
      return isSectionAllowed(item.id, allowedSections, isAdmin) && (storeAllows?.(item.id) ?? true);
    })
    // Para el contador la sección se llama por lo que realmente hace
    .map((item) =>
      item.id === "admin" && isAccountant
        ? { ...item, icon: Wallet, label: "Finanzas" }
        : item
    );

  // Mobile overlay sidebar
  if (isMobile) {
    return (
      <>
        {/* Backdrop */}
        {mobileOpen && (
          <div 
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40"
            onClick={onMobileClose}
          />
        )}
        
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed left-0 top-0 h-screen bg-white dark:bg-[#111111] border-r border-border dark:border-white/20 z-50 flex flex-col w-72 transition-transform duration-300",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {/* Logo with close button */}
          <div className="flex items-center justify-between p-6 border-b border-border dark:border-white/20 h-24">
              <img src="/logo_synkro.png" alt="Synkro AI Logo" className="h-12 w-auto object-contain" />
            <Button variant="ghost" size="icon" onClick={onMobileClose}>
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = activeItem === item.id;

              return (
                <button
                  key={item.id}
                  onClick={() => onItemChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                    isActive
                      ? "bg-[#FFF1B8] dark:bg-[#FCCB34]/20 text-[#111111] dark:text-[#FCCB34] font-semibold"
                      : "text-[#666666] dark:text-[#A1A1AA] hover:bg-[#F8F8F5] dark:hover:bg-[#1A1A1A] hover:text-[#111111] dark:hover:text-[#F8F8F5]"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-5 h-5 transition-transform duration-200",
                      isActive && "scale-110"
                    )}
                  />
                  <span className="font-medium text-sm">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {item.badge}
                    </span>
                  )}
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-[#FCCB34]" />
                  )}
                </button>
              );
            })}
          </nav>
        </aside>
      </>
    );
  }

  // Desktop sidebar
  return (
    <aside
      className={cn(
        "fixed left-0 top-0 h-screen bg-white dark:bg-[#111111] border-r border-border dark:border-white/20 z-50 flex flex-col transition-all duration-300",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 p-6 border-b border-border dark:border-white/20 h-24">
        {!collapsed ? (
            <img src="/logo_synkro.png" alt="Synkro AI Logo" className="h-12 md:h-14 w-auto object-contain" />
        ) : (
          <div className="flex items-center justify-center w-full">
            <img src="/logo_synkro.png" alt="Synkro AI Icon" className="h-8 w-8 object-cover object-left" />
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto scrollbar-thin">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onItemChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative",
                isActive
                  ? "bg-[#FFF1B8] dark:bg-[#FCCB34]/20 text-[#111111] dark:text-[#FCCB34] font-semibold"
                  : "text-[#666666] dark:text-[#A1A1AA] hover:bg-[#F8F8F5] dark:hover:bg-[#1A1A1A] hover:text-[#111111] dark:hover:text-[#F8F8F5]"
              )}
            >
              <Icon
                className={cn(
                  "w-5 h-5 transition-transform duration-200",
                  isActive && "scale-110"
                )}
              />
              {!collapsed && (
                <>
                  <span className="font-medium text-sm">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-[#FCCB34]" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Collapse Button */}
      <div className="p-4 border-t border-border dark:border-white/20">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="w-full justify-center"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}

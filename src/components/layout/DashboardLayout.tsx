import { useCallback, useEffect, useState } from "react";
import { Sidebar, isSectionAllowed } from "./Sidebar";
import { DashboardModule } from "@/components/dashboard/DashboardModule";
import { CrmModule } from "@/components/crm/CrmModule";
import { Header } from "./Header";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { AIProductsModule } from "@/components/ai-products/AIProductsModule";
import { ProductsModule } from "@/components/products/ProductsModule";
import { MarketplacesModule } from "@/components/marketplaces/MarketplacesModule";
import { AnalyticsModule } from "@/components/analytics/AnalyticsModule";
import { AdminModule } from "@/components/admin/AdminModule";
import { FormDraftProvider, useFormDraft } from "@/contexts/FormDraftContext";
import { useAuth } from "@/contexts/AuthContext";
import { NavigationGuardDialog } from "./NavigationGuardDialog";
import { ActivityTracker } from "@/components/activity/ActivityTracker";
import { useStores } from "@/contexts/StoreContext";
import { Construction, Lock } from "lucide-react";
import { toast } from "sonner";
import { alPedirDestino, descartarDestino } from "@/lib/aviso-destino";

// ─── Page metadata ────────────────────────────────────────────────────────────

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard:     { title: "Dashboard",         subtitle: "Resumen general de tu negocio" },
  products:      { title: "Productos",         subtitle: "Gestiona tu catálogo de productos" },
  "ai-products": { title: "IA para Productos", subtitle: "Optimiza tus productos con inteligencia artificial" },
  marketplaces:  { title: "Marketplaces",      subtitle: "Conecta y sincroniza tus canales de venta" },
  crm:           { title: "CRM",                subtitle: "Tus prospectos y en qué etapa está cada uno" },
  analytics:     { title: "Analíticas",        subtitle: "Tus ventas y el rendimiento de tus canales" },
  admin:         { title: "Superadmin",        subtitle: "Clientes, pagos y control financiero" },
  // El contador ve la misma sección con otro encabezado
  settings:      { title: "Configuración",     subtitle: "Ajustes de tu cuenta y preferencias" },
};

const IMPLEMENTED = ["dashboard", "ai-products", "products", "marketplaces", "analytics", "crm", "admin"];

// ─── Coming soon placeholder ──────────────────────────────────────────────────

function ComingSoonSection({ section }: { section: string }) {
  const info = pageTitles[section] ?? { title: section, subtitle: "" };
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mb-6 border border-border">
        <Construction className="w-10 h-10 text-muted-foreground opacity-60" />
      </div>
      <h2 className="text-2xl font-bold mb-2">{info.title}</h2>
      <p className="text-muted-foreground max-w-xs">
        Esta sección está en construcción. ¡Pronto estará disponible!
      </p>
    </div>
  );
}

// ─── Inner layout (needs access to FormDraftContext) ──────────────────────────

// If the OAuth callback redirected here (?meli=...), land on Marketplaces
// so the module can show the connection result.
const INITIAL_SECTION = new URLSearchParams(window.location.search).has("meli")
  ? "marketplaces"
  : "ai-products";

function DashboardContent() {
  const [activeItem, setActiveItem]         = useState(INITIAL_SECTION);
  const [sidebarCollapsed]                  = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [guardOpen, setGuardOpen]           = useState(false);
  const [pendingSection, setPendingSection] = useState<string | null>(null);
  // Sections are lazy-mounted: added to this Set the first time they're visited
  const [mounted, setMounted]               = useState<Set<string>>(new Set([INITIAL_SECTION]));

  const isMobile       = useIsMobile();
  const { checkDirty } = useFormDraft();
  const { user }       = useAuth();
  const isAdmin        = user?.role === "admin";
  const isAccountant   = user?.role === "contador";
  // El contador entra a la misma sección, que ya se recorta por su rol
  const canSeeAdmin    = isAdmin || isAccountant;
  const allowed        = user?.allowedSections;
  const { stores, activeStore, can, setActiveStore } = useStores();
  /**
   * Lo que permite el rol de la persona en la tienda activa: «ver» también es un permiso, así que un rol sin «ver analíticas» no
   * ve esa sección, y quien no puede crear productos no ve «IA Productos». Mientras no hay tienda cargada no se oculta nada.
   */
  const storeAllows = (id: string) => {
    if (!activeStore) return true;
    switch (id) {
      case "products":    return can("productos.ver");
      case "ai-products": return can("productos.editar");
      case "analytics":   return can("analiticas.ver");
      case "marketplaces": return can("canales.ver") || can("ventas.ver");
      default:            return true;
    }
  };
  const canSee         = (id: string) => isSectionAllowed(id, allowed, isAdmin || isAccountant) && storeAllows(id);

  // Si la sección inicial no está permitida, aterriza en el dashboard
  useEffect(() => {
    if (user && !canSee(activeItem)) setActiveItem("dashboard");
  }, [user, activeItem, activeStore]);

  const pageInfo = pageTitles[activeItem] ?? { title: "Dashboard", subtitle: "" };

  // ── Navigate to a section (always lazy-mounts it) ─────────────────────────
  const navigateTo = useCallback((id: string) => {
    setMounted((prev) => new Set([...prev, id]));
    setActiveItem(id);
    setMobileMenuOpen(false);
  }, []);

  // ── Sidebar click: check for unsaved changes first ────────────────────────
  const handleSectionChange = useCallback(
    (id: string) => {
      if (id === activeItem) {
        setMobileMenuOpen(false);
        return;
      }
      if (checkDirty(activeItem)) {
        setPendingSection(id);
        setGuardOpen(true);
        return;
      }
      navigateTo(id);
    },
    [activeItem, checkDirty, navigateTo]
  );

  const handleGuardLeave = () => {
    setGuardOpen(false);
    if (pendingSection) navigateTo(pendingSection);
    setPendingSection(null);
  };

  const handleGuardStay = () => {
    setGuardOpen(false);
    setPendingSection(null);
    descartarDestino();
  };

  // Clic en un aviso de la campana: cambia a la tienda del aviso y abre su sección (cada pantalla recoge su producto o su venta).
  useEffect(() => {
    return alPedirDestino(({ storeId, seccion }) => {
      if (storeId && storeId !== activeStore?.id) {
        if (!stores.some((s) => s.id === storeId)) {
          toast.error("Ese aviso es de una tienda a la que ya no tienes acceso.");
          descartarDestino();
          return;
        }
        setActiveStore(storeId);
      }
      if (seccion) handleSectionChange(seccion);
    });
  }, [stores, activeStore?.id, setActiveStore, handleSectionChange]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeItem={activeItem}
        onItemChange={handleSectionChange}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        isAdmin={canSeeAdmin}
        isAccountant={isAccountant}
        allowedSections={allowed}
        storeAllows={storeAllows}
      />

      <main
        className={cn(
          "transition-all duration-300",
          isMobile ? "ml-0" : sidebarCollapsed ? "ml-20" : "ml-64"
        )}
      >
        <Header
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onMenuClick={() => setMobileMenuOpen(true)}
          showMenuButton={isMobile}
        />

        {/* data-track-root: zona sobre la que se miden las posiciones del mapa de clics */}
        <div className="p-4 md:p-8" data-track-root>
          {/*
           * LAZY MOUNT STRATEGY
           * Sections are mounted on first visit, then toggled with
           * display:none — React state is preserved across navigation.
           */}
          {/* El dashboard es la portada: lo ve cualquier rol. */}
          <div style={{ display: activeItem === "dashboard" ? "block" : "none" }}>
            {mounted.has("dashboard") && <DashboardModule />}
          </div>

          {canSee("ai-products") && (
            <div style={{ display: activeItem === "ai-products" ? "block" : "none" }}>
              {mounted.has("ai-products") && <AIProductsModule />}
            </div>
          )}

          {canSee("products") && (
            <div style={{ display: activeItem === "products" ? "block" : "none" }}>
              {mounted.has("products") && <ProductsModule />}
            </div>
          )}

          {canSee("marketplaces") && (
            <div style={{ display: activeItem === "marketplaces" ? "block" : "none" }}>
              {mounted.has("marketplaces") && <MarketplacesModule />}
            </div>
          )}

          {canSee("crm") && (
            <div style={{ display: activeItem === "crm" ? "block" : "none" }}>
              {mounted.has("crm") && <CrmModule />}
            </div>
          )}

          {canSee("analytics") && (
            <div style={{ display: activeItem === "analytics" ? "block" : "none" }}>
              {mounted.has("analytics") && <AnalyticsModule />}
            </div>
          )}

          {canSeeAdmin && (
            <div style={{ display: activeItem === "admin" ? "block" : "none" }}>
              {mounted.has("admin") && <AdminModule />}
            </div>
          )}

          {/* Sección restringida para esta cuenta */}
          {!canSee(activeItem) && (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 rounded-2xl glass flex items-center justify-center mb-6 border border-border">
                <Lock className="w-10 h-10 text-muted-foreground opacity-60" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Sección no disponible</h2>
              <p className="text-muted-foreground max-w-sm">
                Tu cuenta no tiene acceso a esta sección. Si necesitas entrar, escríbele a tu
                administrador.
              </p>
            </div>
          )}

          {/* Placeholder for sections not yet implemented */}
          {canSee(activeItem) &&
            (!IMPLEMENTED.includes(activeItem) || (activeItem === "admin" && !canSeeAdmin)) && (
              <ComingSoonSection section={activeItem} />
            )}
        </div>
      </main>

      {/* Registro de actividad (solo con el aviso de privacidad aceptado) */}
      <ActivityTracker section={activeItem} />

      <NavigationGuardDialog
        open={guardOpen}
        sectionName={pageTitles[activeItem]?.title ?? activeItem}
        onLeave={handleGuardLeave}
        onStay={handleGuardStay}
      />
    </div>
  );
}

// ─── Public export ────────────────────────────────────────────────────────────

export function DashboardLayout() {
  return (
    <FormDraftProvider>
      <DashboardContent />
    </FormDraftProvider>
  );
}

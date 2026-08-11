import { useCallback, useState } from "react";
import { Sidebar } from "./Sidebar";
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
import { Construction } from "lucide-react";

// ─── Page metadata ────────────────────────────────────────────────────────────

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard:     { title: "Dashboard",         subtitle: "Resumen general de tu negocio" },
  products:      { title: "Productos",         subtitle: "Gestiona tu catálogo de productos" },
  "ai-products": { title: "IA para Productos", subtitle: "Optimiza tus productos con inteligencia artificial" },
  marketplaces:  { title: "Marketplaces",      subtitle: "Conecta y sincroniza tus canales de venta" },
  analytics:     { title: "Analíticas",        subtitle: "Tus ventas y el rendimiento de tus canales" },
  admin:         { title: "Superadmin",        subtitle: "Clientes, pagos y control financiero" },
  settings:      { title: "Configuración",     subtitle: "Ajustes de tu cuenta y preferencias" },
};

const IMPLEMENTED = ["ai-products", "products", "marketplaces", "analytics", "admin"];

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
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        activeItem={activeItem}
        onItemChange={handleSectionChange}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        isAdmin={isAdmin}
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

        <div className="p-4 md:p-8">
          {/*
           * LAZY MOUNT STRATEGY
           * Sections are mounted on first visit, then toggled with
           * display:none — React state is preserved across navigation.
           */}
          <div style={{ display: activeItem === "ai-products" ? "block" : "none" }}>
            {mounted.has("ai-products") && <AIProductsModule />}
          </div>

          <div style={{ display: activeItem === "products" ? "block" : "none" }}>
            {mounted.has("products") && <ProductsModule />}
          </div>

          <div style={{ display: activeItem === "marketplaces" ? "block" : "none" }}>
            {mounted.has("marketplaces") && <MarketplacesModule />}
          </div>

          <div style={{ display: activeItem === "analytics" ? "block" : "none" }}>
            {mounted.has("analytics") && <AnalyticsModule />}
          </div>

          {isAdmin && (
            <div style={{ display: activeItem === "admin" ? "block" : "none" }}>
              {mounted.has("admin") && <AdminModule />}
            </div>
          )}

          {/* Placeholder for sections not yet implemented */}
          {(!IMPLEMENTED.includes(activeItem) || (activeItem === "admin" && !isAdmin)) && (
            <ComingSoonSection section={activeItem} />
          )}
        </div>
      </main>

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

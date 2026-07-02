import { useState } from "react";
import {
  Bell,
  CheckCheck,
  LogOut,
  Menu,
  Package,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ProfileDialog } from "./ProfileDialog";

// ─── Notification types ───────────────────────────────────────────────────────

interface AppNotification {
  id: string;
  type: "ai" | "product" | "system";
  title: string;
  body: string;
  time: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: "1",
    type: "ai",
    title: "IA generó contenido",
    body: "Se optimizaron los campos de 'Zapatillas Running Pro' para MercadoLibre y Amazon.",
    time: "hace 5 min",
    read: false,
  },
  {
    id: "2",
    type: "product",
    title: "Carga masiva completada",
    body: "12 productos fueron procesados exitosamente desde tu último archivo Excel.",
    time: "hace 32 min",
    read: false,
  },
  {
    id: "3",
    type: "system",
    title: "Bienvenido a Synkro AI",
    body: "Tu cuenta está lista. Empieza generando contenido con IA para tus productos.",
    time: "hace 1 h",
    read: true,
  },
];

const notifIcon: Record<AppNotification["type"], React.ReactNode> = {
  ai:      <Sparkles className="w-4 h-4 text-accent" />,
  product: <Package className="w-4 h-4 text-primary" />,
  system:  <Bell className="w-4 h-4 text-muted-foreground" />,
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function Header({ title, subtitle, onMenuClick, showMenuButton }: HeaderProps) {
  const { user, logout } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const unread = notifications.filter((n) => !n.read).length;

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const dismissNotif = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const handleLogout = async () => {
    await logout();
    toast.success("Sesión cerrada correctamente");
  };

  // Build display name + initials from real user data
  const displayName = user
    ? `${user.name ?? ""} ${user.lastName ?? ""}`.trim() || "Usuario"
    : "Usuario";
  const initials = user
    ? `${user.name?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase() || "U"
    : "?";

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-[#111111] border-b border-[#EDEDED] dark:border-white/20 px-4 md:px-8 py-4 shadow-sm transition-colors duration-200">
      <div className="flex items-center justify-between gap-4">
        {/* ── Left: Menu + Title ─────────────────────────────────────────── */}
        <div className="flex items-center gap-3 min-w-0">
          {showMenuButton && (
            <Button variant="ghost" size="icon" onClick={onMenuClick} className="shrink-0">
              <Menu className="w-5 h-5" />
            </Button>
          )}
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-bold tracking-tight truncate text-[#111111] dark:text-[#F8F8F5]">{title}</h1>
            {subtitle && (
              <p className="text-xs md:text-sm text-[#666666] dark:text-[#A1A1AA] mt-0.5 truncate hidden sm:block">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* ── Right: Actions ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-1 md:gap-2 shrink-0">
          {/* Theme toggle */}
          <ThemeToggle />

          {/* ── Notifications ──────────────────────────────────────────── */}
          <Popover open={notifOpen} onOpenChange={setNotifOpen}>
            <PopoverTrigger asChild>
              <Button
                id="header-notifications-btn"
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 md:h-10 md:w-10 rounded-full bg-[#F8F8F5] dark:bg-[#1A1A1A] hover:bg-[#EAEAEA] dark:hover:bg-[#2A2A2A] text-[#111111] dark:text-[#F8F8F5] transition-colors"
              >
                <Bell className="w-4 h-4 md:w-5 md:h-5" />
                {unread > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
                    {unread}
                  </span>
                )}
              </Button>
            </PopoverTrigger>

            <PopoverContent
              align="end"
              className="glass w-80 p-0 shadow-2xl border-border"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <p className="font-semibold text-sm">Notificaciones</p>
                {unread > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-muted-foreground hover:text-foreground gap-1.5"
                    onClick={markAllRead}
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Marcar todo como leído
                  </Button>
                )}
              </div>

              {/* List */}
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                  <Bell className="w-8 h-8 text-muted-foreground opacity-30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Sin notificaciones</p>
                </div>
              ) : (
                <ScrollArea className="max-h-80">
                  <div className="divide-y divide-border/50">
                    {notifications.map((notif) => (
                      <div
                        key={notif.id}
                        className={cn(
                          "flex gap-3 px-4 py-3 hover:bg-secondary/30 transition-colors group",
                          !notif.read && "bg-primary/5"
                        )}
                      >
                        {/* Icon */}
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
                            notif.type === "ai"      && "bg-accent/10",
                            notif.type === "product" && "bg-primary/10",
                            notif.type === "system"  && "bg-secondary"
                          )}
                        >
                          {notifIcon[notif.type]}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm leading-snug", !notif.read && "font-semibold")}>
                              {notif.title}
                            </p>
                            <button
                              onClick={() => dismissNotif(notif.id)}
                              className="opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-foreground transition-all"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {notif.body}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                            {notif.time}
                          </p>
                        </div>

                        {/* Unread dot */}
                        {!notif.read && (
                          <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </PopoverContent>
          </Popover>

          {/* ── User menu ──────────────────────────────────────────────── */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                id="header-user-menu-btn"
                variant="ghost"
                className="relative h-9 w-9 md:h-10 md:w-10 rounded-full p-0"
              >
                <Avatar className="h-9 w-9 md:h-10 md:w-10 border-2 border-primary/20">
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-56 glass" align="end" forceMount>
              {/* User info */}
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold truncate">{displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email ?? "—"}
                  </p>
                  {user?.role && (
                    <span className="text-[10px] uppercase tracking-wide font-medium text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded w-fit">
                      {user.role}
                    </span>
                  )}
                </div>
              </DropdownMenuLabel>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onClick={() => setProfileOpen(true)}
              >
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Perfil</span>
              </DropdownMenuItem>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                id="header-logout-btn"
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ProfileDialog open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  );
}

import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl, isManus } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import {
  LayoutDashboard,
  LogOut,
  PanelLeft,
  Users,
  Columns3,
  FileText,
  Video,
  Calendar,
  DollarSign,
  Settings,
  BarChart3,
  Building2,
  UserCog,
  ShieldCheck,
  Shield,
} from "lucide-react";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from "./DashboardLayoutSkeleton";
import { Button } from "./ui/button";


type MenuItem = {
  icon: any;
  label: string;
  path: string;
  adminOnly?: boolean;
  section?: string;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", section: "main" },
  { icon: Users, label: "Leads", path: "/leads", section: "main" },
  { icon: Columns3, label: "Pipeline", path: "/pipeline", section: "main" },
  { icon: Video, label: "Webinars", path: "/webinars", section: "main" },
  { icon: FileText, label: "Landing Pages", path: "/landing-pages", section: "main" },
  { icon: Calendar, label: "Scheduling", path: "/scheduling", section: "main" },
  { icon: DollarSign, label: "Deals", path: "/deals", section: "main" },
  { icon: BarChart3, label: "Revenue", path: "/revenue", section: "main" },
  { icon: UserCog, label: "User Management", path: "/users", adminOnly: true, section: "admin" },
  { icon: Settings, label: "Settings", path: "/settings", adminOnly: true, section: "admin" },
];

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 260;
const MIN_WIDTH = 200;
const MAX_WIDTH = 400;

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-brand-green-dark via-brand-green to-brand-green-light">
        <div className="flex flex-col items-center gap-8 p-10 max-w-md w-full bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl">
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-10 w-10 text-brand-green" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-brand-green-dark" style={{ fontFamily: 'Raleway, sans-serif' }}>
                  Clarke & Associates
                </h1>
                <p className="text-xs font-medium text-brand-gold tracking-widest uppercase">CRM Platform</p>
              </div>
            </div>
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-800">Sign in to continue</h2>
            <p className="text-sm text-gray-500 mt-1">
              Access to this platform requires authentication.
            </p>
          </div>
          <Button
            onClick={() => {
              if (isManus()) {
                window.location.href = getLoginUrl();
              } else {
                window.location.href = "/login";
              }
            }}
            size="lg"
            className="w-full bg-brand-green hover:bg-brand-green-dark text-white shadow-lg hover:shadow-xl transition-all text-base font-semibold"
          >
            Sign in
          </Button>
          <div className="w-16 h-1 rounded-full bg-brand-gold" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
}: DashboardLayoutContentProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const isAdmin = user?.role === "admin";

  // Filter menu items based on role
  const visibleItems = menuItems.filter((item) => !item.adminOnly || isAdmin);
  const mainItems = visibleItems.filter((item) => item.section === "main" || !item.section);
  const adminItems = visibleItems.filter((item) => item.section === "admin");

  const activeMenuItem = visibleItems.find((item) => item.path === location);

  useEffect(() => {
    if (isCollapsed) setIsResizing(false);
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar collapsible="icon" className="border-r-0" disableTransition={isResizing}>
          <SidebarHeader className="h-16 justify-center border-b border-sidebar-border/50">
            <div className="flex items-center gap-3 px-2 transition-all w-full">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-sidebar-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-sidebar-foreground/70" />
              </button>
              {!isCollapsed ? (
                <div className="flex items-center gap-2 min-w-0">
                  <Building2 className="h-5 w-5 text-brand-gold shrink-0" />
                  <div className="min-w-0">
                    <span className="font-bold text-sm tracking-tight truncate text-sidebar-foreground block" style={{ fontFamily: 'Raleway, sans-serif' }}>
                      Clarke & Associates
                    </span>
                    <span className="text-[10px] text-brand-gold font-medium tracking-widest uppercase block">
                      CRM
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0 pt-2">
            {/* Main Navigation */}
            <SidebarMenu className="px-2 py-1 space-y-0.5">
              {mainItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={isActive}
                      onClick={() => setLocation(item.path)}
                      tooltip={item.label}
                      className={`h-10 transition-all font-medium text-[13px] ${
                        isActive
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                      }`}
                    >
                      <item.icon className={`h-4 w-4 ${isActive ? "text-brand-gold" : ""}`} />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>

            {/* Admin Section */}
            {adminItems.length > 0 && (
              <>
                <div className="px-4 pt-4 pb-1">
                  {!isCollapsed && (
                    <p className="text-[10px] font-semibold text-sidebar-foreground/40 uppercase tracking-widest">
                      Administration
                    </p>
                  )}
                </div>
                <SidebarMenu className="px-2 py-1 space-y-0.5">
                  {adminItems.map((item) => {
                    const isActive = location === item.path;
                    return (
                      <SidebarMenuItem key={item.path}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className={`h-10 transition-all font-medium text-[13px] ${
                            isActive
                              ? "bg-sidebar-accent text-sidebar-accent-foreground"
                              : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
                          }`}
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-brand-gold" : ""}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3 border-t border-sidebar-border/50">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-sidebar-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border border-brand-gold/30 shrink-0">
                    <AvatarFallback className="text-xs font-semibold bg-brand-green text-white">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate leading-none text-sidebar-foreground">
                        {user?.name || "-"}
                      </p>
                      {isAdmin ? (
                        <Badge className="h-4 px-1.5 text-[9px] bg-brand-gold/15 text-brand-gold-dark border-brand-gold/30 hover:bg-brand-gold/20">
                          Admin
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="h-4 px-1.5 text-[9px]">
                          User
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-sidebar-foreground/50 truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    {isAdmin ? (
                      <Badge className="h-5 px-2 text-[10px] bg-brand-gold/15 text-brand-gold-dark border-brand-gold/30">
                        <ShieldCheck className="h-3 w-3 mr-1" />
                        Admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                        <Shield className="h-3 w-3 mr-1" />
                        User
                      </Badge>
                    )}
                  </div>
                </div>
                <DropdownMenuSeparator />
                {isAdmin && (
                  <>
                    <DropdownMenuItem
                      onClick={() => setLocation("/users")}
                      className="cursor-pointer"
                    >
                      <UserCog className="mr-2 h-4 w-4" />
                      <span>Manage Users</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLocation("/settings")}
                      className="cursor-pointer"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        <div
          className={`absolute top-0 right-0 w-1 h-full cursor-col-resize hover:bg-brand-gold/30 transition-colors ${isCollapsed ? "hidden" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 50 }}
        />
      </div>

      <SidebarInset>
        {isMobile && (
          <div className="flex border-b h-14 items-center justify-between bg-background/95 px-2 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <span className="tracking-tight text-foreground font-semibold">
                    {activeMenuItem?.label ?? "Menu"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

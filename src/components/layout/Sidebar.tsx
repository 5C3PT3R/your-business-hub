import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Users,
  UserCircle,
  Briefcase,
  CheckSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Zap,
  Menu,
  Building2,
  ShoppingCart,
  Shield,
  LucideIcon,
  ArrowLeftRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { IndustryType } from '@/config/industryTemplates';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

// Industry-specific navigation
const getNavigation = (industryType: IndustryType | undefined, labels: Record<string, string> | undefined): NavItem[] => {
  const baseNav: NavItem[] = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  ];

  const endNav: NavItem[] = [
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  // Industry-specific middle items
  const industryNav: Record<IndustryType, NavItem[]> = {
    sales: [
      { name: labels?.leads || 'Leads', href: '/leads', icon: Users },
      { name: labels?.contacts || 'Contacts', href: '/contacts', icon: UserCircle },
      { name: labels?.deals || 'Deals', href: '/deals', icon: Briefcase },
      { name: labels?.tasks || 'Tasks', href: '/tasks', icon: CheckSquare },
    ],
    real_estate: [
      { name: labels?.leads || 'Inquiries', href: '/leads', icon: Users },
      { name: labels?.contacts || 'Clients', href: '/contacts', icon: UserCircle },
      { name: labels?.deals || 'Bookings', href: '/deals', icon: Building2 },
      { name: labels?.tasks || 'Site Visits', href: '/tasks', icon: CheckSquare },
    ],
    ecommerce: [
      { name: labels?.leads || 'Tickets', href: '/leads', icon: Users },
      { name: labels?.contacts || 'Customers', href: '/contacts', icon: UserCircle },
      { name: labels?.deals || 'Orders', href: '/deals', icon: ShoppingCart },
      { name: labels?.tasks || 'Returns', href: '/tasks', icon: CheckSquare },
    ],
    insurance: [
      { name: labels?.leads || 'Quotes', href: '/leads', icon: Users },
      { name: labels?.contacts || 'Policyholders', href: '/contacts', icon: UserCircle },
      { name: labels?.deals || 'Claims', href: '/deals', icon: Shield },
      { name: labels?.tasks || 'Renewals', href: '/tasks', icon: CheckSquare },
    ],
  };

  const middleNav = industryType ? industryNav[industryType] : industryNav.sales;

  return [...baseNav, ...middleNav, ...endNav];
};

// Industry accent colors for the logo
const industryColors: Record<IndustryType, string> = {
  sales: 'gradient-primary',
  real_estate: 'bg-gradient-to-br from-emerald-500 to-teal-600',
  ecommerce: 'bg-gradient-to-br from-orange-500 to-amber-500',
  insurance: 'bg-gradient-to-br from-rose-500 to-pink-600',
};

function SidebarContent({ collapsed, setCollapsed, showCollapseButton = true, onNavigate }: { 
  collapsed: boolean; 
  setCollapsed?: (collapsed: boolean) => void;
  showCollapseButton?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const { workspace, template, workspaces, switchWorkspace } = useWorkspace();

  const fullName = user?.user_metadata?.full_name || 'User';
  const email = user?.email || '';
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const industryType = workspace?.industry_type;
  const uiLabels = (workspace?.config as { ui_labels?: Record<string, string> })?.ui_labels;
  const navigation = getNavigation(industryType, uiLabels);
  const logoGradient = industryType ? industryColors[industryType] : 'gradient-primary';

  return (
    <div className="flex h-full flex-col">
      {/* Logo & Workspace */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
        <Link to="/" className="flex items-center gap-3" onClick={onNavigate}>
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shadow-glow', logoGradient)}>
            <Zap className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
                Upflo
              </span>
              {template && (
                <span className="text-[10px] text-sidebar-foreground/60 -mt-1">
                  {template.name}
                </span>
              )}
            </div>
          )}
        </Link>
        {showCollapseButton && setCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {/* Workspace Switcher */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            {workspaces.length > 1 ? (
              <select
                value={workspace?.id || ''}
                onChange={(e) => switchWorkspace(e.target.value)}
                className="flex-1 text-xs bg-sidebar-accent text-sidebar-foreground rounded-md px-2 py-1.5 border-0 focus:ring-1 focus:ring-sidebar-ring"
              >
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="flex-1 text-xs text-sidebar-foreground/70 truncate">
                {workspace?.name}
              </span>
            )}
            <Link
              to="/select-crm"
              onClick={onNavigate}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
              title="Switch CRM or create new workspace"
            >
              <ArrowLeftRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground shadow-sm'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-accent text-sidebar-foreground">
            <span className="text-sm font-medium">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {email}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden fixed top-3 left-3 z-50 h-10 w-10 bg-background/80 backdrop-blur-sm shadow-md"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0 bg-sidebar">
        <SidebarContent 
          collapsed={false} 
          showCollapseButton={false}
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}

export function Sidebar() {
  const { collapsed, setCollapsed } = useSidebarCollapse();
  const isMobile = useIsMobile();

  // On mobile, show the hamburger menu version
  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-sidebar transition-all duration-300 ease-in-out hidden md:block',
        collapsed ? 'w-20' : 'w-64'
      )}
    >
      <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} />
    </aside>
  );
}

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
  Menu,
  Building2,
  ShoppingCart,
  Shield,
  LucideIcon,
  Plus,
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

const getNavigation = (industryType: IndustryType | undefined, labels: Record<string, string> | undefined): NavItem[] => {
  const baseNav: NavItem[] = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  ];

  const endNav: NavItem[] = [
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

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
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const industryType = workspace?.industry_type;
  const uiLabels = (workspace?.config as { ui_labels?: Record<string, string> })?.ui_labels;
  const navigation = getNavigation(industryType, uiLabels);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <Link to="/" className="flex items-center gap-2" onClick={onNavigate}>
          <div className="h-7 w-7 rounded-lg bg-foreground flex items-center justify-center">
            <span className="text-background font-bold text-xs">U</span>
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm">{workspace?.name || 'Upflo'}</span>
          )}
        </Link>
        {showCollapseButton && setCollapsed && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="h-7 w-7"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </Button>
        )}
      </div>


      {/* Workspace Switcher */}
      {!collapsed && workspaces.length > 1 && (
        <div className="px-3 py-2 border-b border-border">
          <select
            value={workspace?.id || ''}
            onChange={(e) => switchWorkspace(e.target.value)}
            className="w-full text-xs bg-muted/50 rounded-md px-2 py-1.5 border-0"
          >
            {workspaces.map((ws) => (
              <option key={ws.id} value={ws.id}>{ws.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-muted font-medium'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* New Workspace */}
      {!collapsed && (
        <div className="px-3 py-2 border-t border-border">
          <Link to="/select-crm" onClick={onNavigate}>
            <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground">
              <Plus className="h-4 w-4" />
              New Workspace
            </Button>
          </Link>
        </div>
      )}

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xs font-medium">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fullName}</p>
              <p className="text-xs text-muted-foreground truncate">{template?.name}</p>
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
          className="md:hidden fixed top-3 left-3 z-50 h-9 w-9 bg-background border shadow-sm"
        >
          <Menu className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-64 p-0">
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

  if (isMobile) {
    return <MobileSidebar />;
  }

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen border-r border-border transition-all duration-200 hidden md:block',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <SidebarContent collapsed={collapsed} setCollapsed={setCollapsed} />
    </aside>
  );
}
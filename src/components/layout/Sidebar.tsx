/**
 * V1 MODE: Single Sales CRM, conversation-first.
 * Other CRM types intentionally disabled until V2.
 * Navigation simplified to: Pipeline → Deal → Conversation
 */

import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import {
  Users,
  UserCircle,
  Briefcase,
  CheckSquare,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  Zap,
  Crown,
  LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';
import { CreditsBadge } from '@/components/layout/CreditsBadge';

interface NavItem {
  name: string;
  href: string;
  icon: LucideIcon;
}

// V1: Fixed navigation for Sales CRM only
const navigation: NavItem[] = [
  { name: 'Approvals', href: '/approvals', icon: Crown },
  { name: 'Next Actions', href: '/next-actions', icon: Zap },
  { name: 'Pipeline', href: '/deals', icon: Briefcase },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Contacts', href: '/contacts', icon: UserCircle },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function SidebarContent({ collapsed, setCollapsed, showCollapseButton = true, onNavigate }: { 
  collapsed: boolean; 
  setCollapsed?: (collapsed: boolean) => void;
  showCollapseButton?: boolean;
  onNavigate?: () => void;
}) {
  const location = useLocation();
  const { user } = useAuth();
  const { workspace } = useWorkspace();

  const fullName = user?.user_metadata?.full_name || 'User';
  const initials = fullName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-border">
        <Link to="/deals" className="flex items-center gap-2" onClick={onNavigate}>
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

      {/* V1: Workspace switcher disabled - single workspace mode */}

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
            (item.href === '/deals' && location.pathname.startsWith('/deal/'));
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

      {/* V1: New Workspace button disabled - single workspace mode */}

      {/* User */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <span className="text-xs font-medium">{initials}</span>
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fullName}</p>
              <p className="text-xs text-muted-foreground truncate">Sales CRM</p>
              {/* Credits Badge */}
              <div className="mt-2">
                <CreditsBadge variant="compact" />
              </div>
            </div>
          )}
        </div>
        {/* Show CreditsBadge in collapsed mode (icon only) */}
        {collapsed && (
          <div className="mt-2 flex justify-center">
            <CreditsBadge variant="compact" showTooltip={true} />
          </div>
        )}
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
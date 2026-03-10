import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  ChevronRight,
  ChevronDown,
  Home,
  Bot,
  Workflow,
  BarChart3,
  Lightbulb,
  Plug,
  Settings,
  List,
  TrendingUp,
  Plus,
  BookOpen,
  DollarSign,
  Users2,
  FileText,
  User,
  Bell,
  CreditCard,
  Lock,
  Key,
  LogOut,
  Swords,
  ScanSearch,
  Castle,
  LayoutDashboard,
  Shield,
  Activity,
  Users,
  Target,
  Mail,
  Briefcase,
  Star,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  path: string;
  badge?: {
    count: number;
    variant: 'urgent' | 'info' | 'warning' | 'success';
    label?: string;
  };
  subItems?: MenuItem[];
  isDivider?: boolean;
}

interface MenuItemProps {
  item: MenuItem;
  isCollapsed: boolean;
  isExpanded: boolean;
  isActive: boolean;
  onToggle: () => void;
  onNavigate: (path: string) => void;
}

export function BreezeSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const userName = user?.user_metadata?.full_name || 'User';
  const userEmail = user?.email || '';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const menuStructure: MenuItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      path: '/dashboard',
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: Activity,
      path: '/activity',
    },
    {
      id: 'insights',
      label: 'Insights',
      icon: Lightbulb,
      path: '/insights',
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: Users,
      path: '/contacts',
    },
  ];

  const automationItems: MenuItem[] = [
    {
      id: 'ai-agents',
      label: 'AI Agents',
      icon: Bot,
      path: '/agents',
      badge: undefined, // TODO: Add AI agents count when available
      subItems: [
        {
          id: 'all-agents',
          label: 'All Agents',
          icon: List,
          path: '/agents',
          badge: undefined, // TODO: Add AI agents count when available
        },
        {
          id: 'create-agent',
          label: 'Create Agent',
          icon: Plus,
          path: '/agents/new',
        },
        {
          id: 'agent-templates',
          label: 'Templates',
          icon: FileText,
          path: '/agents/templates',
        },
        {
          id: 'knowledge-base',
          label: 'Knowledge Base',
          icon: BookOpen,
          path: '/ai-agents/knowledge',
        },
      ],
    },
    {
      id: 'bishop',
      label: 'Bishop (Sales)',
      icon: Swords,
      path: '/bishop',
      badge: { count: 0, variant: 'success', label: '●' }, // Green dot = Live
      subItems: [
        {
          id: 'bishop-settings',
          label: 'Control Panel',
          icon: Settings,
          path: '/bishop',
        },
        {
          id: 'bishop-prospect',
          label: 'Prospecting',
          icon: Target,
          path: '/bishop/prospect',
        },
        {
          id: 'bishop-drafts',
          label: 'Drafts Queue',
          icon: Mail,
          path: '/bishop/drafts',
        },
        {
          id: 'bishop-leads',
          label: 'Leads Pipeline',
          icon: Users,
          path: '/bishop/leads',
        },
      ],
    },
    {
      id: 'pawn',
      label: 'Pawn (Data)',
      icon: ScanSearch,
      path: '/pawn',
      badge: { count: 0, variant: 'info', label: 'Offline' },
      subItems: [],
    },
    {
      id: 'rook',
      label: 'Rook (Hiring)',
      icon: Castle,
      path: '/rook',
      badge: { count: 0, variant: 'success', label: '●' }, // Green dot = Live
      subItems: [
        {
          id: 'rook-dashboard',
          label: 'Screening Hub',
          icon: LayoutDashboard,
          path: '/rook',
        },
        {
          id: 'rook-jobs',
          label: 'Open Positions',
          icon: Briefcase,
          path: '/rook?tab=jobs',
        },
        {
          id: 'rook-shortlist',
          label: 'Shortlist',
          icon: Star,
          path: '/rook?tab=shortlist',
        },
      ],
    },
    {
      id: 'knight',
      label: 'Knight (Support)',
      icon: Shield,
      path: '/knight',
      badge: { count: 0, variant: 'success', label: '●' },
      subItems: [
        {
          id: 'knight-dashboard',
          label: 'Dashboard',
          icon: Sparkles,
          path: '/knight',
        },
        {
          id: 'knight-settings',
          label: 'Settings',
          icon: Settings,
          path: '/knight/settings',
        },
      ],
    },
    {
      id: 'workflows',
      label: 'Workflows',
      icon: Workflow,
      path: '/workflows',
      badge: undefined, // TODO: Add workflows count when available
      subItems: [
        {
          id: 'all-workflows',
          label: 'All Workflows',
          icon: List,
          path: '/workflows',
          badge: undefined, // TODO: Add workflows count when available
        },
        {
          id: 'create-workflow',
          label: 'Create Workflow',
          icon: Plus,
          path: '/workflows/new',
        },
        {
          id: 'workflow-templates',
          label: 'Templates',
          icon: FileText,
          path: '/workflows/templates',
        },
        {
          id: 'workflow-performance',
          label: 'Performance',
          icon: BarChart3,
          path: '/workflows/analytics',
        },
      ],
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      path: '/analytics',
      subItems: [
        {
          id: 'revenue',
          label: 'Revenue Dashboard',
          icon: DollarSign,
          path: '/analytics/revenue',
        },
        {
          id: 'attribution',
          label: 'Attribution',
          icon: Target,
          path: '/analytics/attribution',
        },
        {
          id: 'ai-insights',
          label: 'AI Insights',
          icon: Bot,
          path: '/analytics/insights',
        },
        {
          id: 'forecast-analytics',
          label: 'Forecast',
          icon: TrendingUp,
          path: '/analytics/forecast',
        },
        {
          id: 'team-performance',
          label: 'Team Performance',
          icon: Users2,
          path: '/analytics/team',
        },
        {
          id: 'custom-reports',
          label: 'Custom Reports',
          icon: FileText,
          path: '/analytics/reports',
        },
      ],
    },
  ];

  const systemItems: MenuItem[] = [
    {
      id: 'integrations',
      label: 'Integrations',
      icon: Plug,
      path: '/integrations',
      badge: undefined, // TODO: Add integrations needing attention count when available
      subItems: [
        {
          id: 'meta-integration',
          label: 'Meta (FB/IG/WA)',
          icon: Users2,
          path: '/integrations/meta',
          badge: undefined,
        },
        {
          id: 'connected',
          label: 'Connected',
          icon: CheckCircle2,
          path: '/integrations?filter=connected',
          badge: undefined,
        },
        {
          id: 'available',
          label: 'Available',
          icon: Plus,
          path: '/integrations?filter=available',
          badge: undefined,
        },
        {
          id: 'api-access',
          label: 'API Access',
          icon: Key,
          path: '/integrations/api',
        },
      ],
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      path: '/settings',
      subItems: [
        {
          id: 'profile',
          label: 'Profile',
          icon: User,
          path: '/settings/profile',
        },
        {
          id: 'team',
          label: 'Team & Users',
          icon: Users2,
          path: '/settings/team',
        },
        {
          id: 'notifications',
          label: 'Notifications',
          icon: Bell,
          path: '/settings/notifications',
        },
        {
          id: 'billing',
          label: 'Billing & Plans',
          icon: CreditCard,
          path: '/settings/billing',
        },
        {
          id: 'security',
          label: 'Security',
          icon: Lock,
          path: '/settings/security',
        },
        {
          id: 'api-keys',
          label: 'API Keys',
          icon: Key,
          path: '/settings/api',
        },
      ],
    },
  ];

  const toggleExpand = (itemId: string) => {
    setExpandedItems(prev =>
      prev.includes(itemId) ? prev.filter(id => id !== itemId) : [...prev, itemId]
    );
  };

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const isItemActive = (item: MenuItem): boolean => {
    return location.pathname === item.path || location.pathname.startsWith(item.path + '/');
  };

  return (
    <aside
      className={cn(
        'flex flex-col flex-shrink-0 h-screen border-r transition-all duration-300',
        'bg-[#FDFBF7] border-[#E7E5E4]',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-[#E7E5E4]">
        {!isCollapsed && (
          <div className="flex items-center gap-2.5">
            <img src="/regent-logo.png" alt="Regent" className="w-8 h-8 rounded-lg object-cover" />
            <div>
              <span className="font-bold text-[#1C1917] tracking-tight text-base" style={{ fontFamily: 'Instrument Serif, serif' }}>REGENT</span>
              <p className="text-[9px] text-[#CC5500] font-medium tracking-widest uppercase">Sales Engine</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <img src="/regent-logo.png" alt="Regent" className="w-8 h-8 rounded-lg object-cover mx-auto" />
        )}
        {!isCollapsed && (
          <button onClick={() => setIsCollapsed(true)} className="p-1 rounded hover:bg-[#E7E5E4] transition-colors">
            <ChevronRight className="w-4 h-4 text-[#78716C]" />
          </button>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="space-y-0.5 px-2">
          {menuStructure.map(item => (
            <MenuItem
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
              isExpanded={expandedItems.includes(item.id)}
              isActive={isItemActive(item)}
              onToggle={() => toggleExpand(item.id)}
              onNavigate={handleNavigate}
            />
          ))}

          {/* Divider + Active Units label */}
          <div className="pt-3 pb-1">
            <div className="border-t border-[#E7E5E4]" />
            {!isCollapsed && (
              <p className="text-[10px] font-semibold text-[#A8A29E] uppercase tracking-widest px-2 pt-2">Active Units</p>
            )}
          </div>

          {automationItems.map(item => (
            <MenuItem
              key={item.id}
              item={item}
              isCollapsed={isCollapsed}
              isExpanded={expandedItems.includes(item.id)}
              isActive={isItemActive(item)}
              onToggle={() => toggleExpand(item.id)}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      </nav>

      {/* User Profile — compact */}
      <div className="border-t border-[#E7E5E4] px-3 py-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#CC5500] flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
            {userInitials}
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[#1C1917] truncate">{userName}</p>
              <p className="text-[10px] text-[#A8A29E] truncate">{userEmail}</p>
            </div>
          )}
          {!isCollapsed && (
            <div className="flex gap-1">
              <button onClick={() => navigate('/settings')} className="p-1.5 rounded hover:bg-[#E7E5E4] transition-colors" title="Settings">
                <Settings className="h-3.5 w-3.5 text-[#78716C]" />
              </button>
              <button onClick={() => navigate('/auth')} className="p-1.5 rounded hover:bg-red-50 transition-colors" title="Sign out">
                <LogOut className="h-3.5 w-3.5 text-[#78716C] hover:text-red-500" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="p-2 border-t border-[#E7E5E4]">
          <button onClick={() => setIsCollapsed(false)} className="w-full p-2 rounded hover:bg-[#E7E5E4] transition-colors">
            <ChevronRight className="h-4 w-4 text-[#78716C] mx-auto" />
          </button>
        </div>
      )}
    </aside>
  );
}

function MenuItem({
  item,
  isCollapsed,
  isExpanded,
  isActive,
  onToggle,
  onNavigate,
}: MenuItemProps) {
  const hasSubItems = item.subItems && item.subItems.length > 0;
  const Icon = item.icon;

  if (item.isDivider) {
    return !isCollapsed ? <div className="my-2 border-t border-[#E7E5E4]" /> : null;
  }

  return (
    <div>
      <button
        onClick={hasSubItems ? onToggle : () => onNavigate(item.path)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200',
          isActive
            ? 'bg-[#CC5500]/10 text-[#CC5500] border border-[#CC5500]/20'
            : 'text-[#78716C] hover:text-[#1C1917] hover:bg-[#E7E5E4] border border-transparent',
          isCollapsed && 'justify-center'
        )}
      >
        {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}

        {!isCollapsed && (
          <>
            <span className="flex-1 text-left text-sm font-medium">{item.label}</span>

            {item.badge && (
              <Badge
                variant={
                  item.badge.variant === 'urgent'
                    ? 'destructive'
                    : item.badge.variant === 'warning'
                    ? 'default'
                    : 'secondary'
                }
                className={cn(
                  'text-xs font-semibold',
                  item.badge.variant === 'info' && 'bg-[#78716C]/10 text-[#78716C]',
                  item.badge.variant === 'success' && 'bg-green-100 text-green-700',
                  item.badge.variant === 'urgent' && 'animate-pulse'
                )}
              >
                {item.badge.label || item.badge.count}
              </Badge>
            )}

            {hasSubItems && (
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform duration-200',
                  isExpanded ? 'rotate-0' : '-rotate-90'
                )}
              />
            )}
          </>
        )}
      </button>

      {/* Sub-items */}
      {hasSubItems && isExpanded && !isCollapsed && (
        <div className="ml-6 mt-1 space-y-1">
          {item.subItems?.map(subItem => {
            if (subItem.isDivider) {
              return <div key={subItem.id} className="my-2 border-t border-border" />;
            }

            const SubIcon = subItem.icon;
            return (
              <button
                key={subItem.id}
                onClick={() => onNavigate(subItem.path)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[#A8A29E] hover:text-[#1C1917] hover:bg-[#E7E5E4] rounded-lg transition-colors"
              >
                {SubIcon && <SubIcon className="w-4 h-4" />}
                <span className="flex-1 text-left">{subItem.label}</span>
                {subItem.badge && (
                  <span className="text-xs text-muted-foreground font-mono">({subItem.badge.count})</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

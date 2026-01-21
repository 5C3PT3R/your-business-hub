import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ChevronRight,
  ChevronDown,
  Home,
  Zap,
  MessageSquare,
  Users,
  Briefcase,
  Bot,
  Workflow,
  BarChart3,
  Plug,
  Settings,
  Search,
  Flame,
  Calendar,
  CalendarDays,
  Target,
  Mail,
  Circle,
  Star,
  Linkedin,
  Phone,
  List,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  BookOpen,
  DollarSign,
  TrendingDown,
  Users2,
  FileText,
  User,
  Bell,
  CreditCard,
  Lock,
  Key,
  Focus,
  PhoneCall,
  LogOut,
  UserPlus,
  Crown,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActionStats } from '@/hooks/useNextActions';
import { useInboxStats } from '@/hooks/useInboxStats';
import { useContactsStats } from '@/hooks/useContactsStats';
import { useDealsStats } from '@/hooks/useDealsStats';
import { useLeads } from '@/hooks/useLeads';

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
  const { data: stats } = useActionStats();
  const { stats: inboxStats } = useInboxStats();
  const { stats: contactsStats } = useContactsStats();
  const { stats: dealsStats } = useDealsStats();
  const { leads } = useLeads();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(['next-actions']);

  const userName = user?.user_metadata?.full_name || 'User';
  const userEmail = user?.email || '';
  const userInitials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const menuStructure: MenuItem[] = [
    {
      id: 'command-center',
      label: 'Command Center',
      icon: Crown,
      path: '/command-center',
    },
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
      path: '/dashboard',
    },
    {
      id: 'next-actions',
      label: 'Next Actions',
      icon: Zap,
      path: '/next-actions',
      badge: stats?.urgent ? { count: stats.urgent, variant: 'urgent' } : undefined,
      subItems: [
        {
          id: 'urgent',
          label: 'Urgent',
          icon: Flame,
          path: '/next-actions?filter=urgent',
          badge: stats?.urgent ? { count: stats.urgent, variant: 'urgent' } : undefined,
        },
        {
          id: 'today',
          label: 'Today',
          icon: Calendar,
          path: '/next-actions?filter=today',
          badge: { count: stats?.pending || 0, variant: 'info' },
        },
        {
          id: 'week',
          label: 'This Week',
          icon: CalendarDays,
          path: '/next-actions?filter=all',
          badge: { count: stats?.pending || 0, variant: 'info' },
        },
        {
          id: 'ai-suggested',
          label: 'AI Suggested',
          icon: Bot,
          path: '/next-actions?filter=all',
          badge: { count: 6, variant: 'info' },
        },
        {
          id: 'quick-wins',
          label: 'Quick Wins',
          icon: Target,
          path: '/next-actions?filter=high-value',
          badge: { count: 5, variant: 'success' },
        },
      ],
    },
    {
      id: 'inbox',
      label: 'Inbox',
      icon: MessageSquare,
      path: '/inbox',
      badge: inboxStats.unread > 0 ? { count: inboxStats.unread, variant: 'info' } : undefined,
      subItems: [
        {
          id: 'all',
          label: 'All Messages',
          icon: Mail,
          path: '/inbox?filter=all',
          badge: inboxStats.total > 0 ? { count: inboxStats.total, variant: 'info' } : undefined,
        },
        {
          id: 'urgent-inbox',
          label: 'Urgent',
          icon: Circle,
          path: '/inbox?filter=urgent',
          badge: inboxStats.urgent > 0 ? { count: inboxStats.urgent, variant: 'urgent' } : undefined,
        },
        {
          id: 'starred',
          label: 'Starred',
          icon: Star,
          path: '/inbox?filter=starred',
          badge: inboxStats.starred > 0 ? { count: inboxStats.starred, variant: 'info' } : undefined,
        },
        {
          id: 'ai-inbox',
          label: 'AI Assigned',
          icon: Bot,
          path: '/inbox?filter=ai',
          badge: inboxStats.ai > 0 ? { count: inboxStats.ai, variant: 'info' } : undefined,
        },
        { id: 'divider-1', label: '', icon: null, path: '', isDivider: true },
        {
          id: 'email',
          label: 'Email',
          icon: Mail,
          path: '/inbox?channel=email',
          badge: inboxStats.byChannel.email > 0 ? { count: inboxStats.byChannel.email, variant: 'info' } : undefined,
        },
        {
          id: 'linkedin',
          label: 'LinkedIn',
          icon: Linkedin,
          path: '/inbox?channel=linkedin',
          badge: inboxStats.byChannel.linkedin > 0 ? { count: inboxStats.byChannel.linkedin, variant: 'info' } : undefined,
        },
        {
          id: 'calls',
          label: 'Calls',
          icon: Phone,
          path: '/inbox?channel=calls',
          badge: inboxStats.byChannel.calls > 0 ? { count: inboxStats.byChannel.calls, variant: 'info' } : undefined,
        },
      ],
    },
    {
      id: 'contacts',
      label: 'Contacts',
      icon: Users,
      path: '/contacts',
    },
    {
      id: 'leads',
      label: 'Leads',
      icon: UserPlus,
      path: '/leads',
      badge: leads.length > 0 ? { count: leads.length, variant: 'info' } : undefined,
    },
    {
      id: 'deals',
      label: 'Deals',
      icon: Briefcase,
      path: '/deals',
      badge: dealsStats.totalValue > 0
        ? {
            count: 0,
            variant: 'info',
            label: dealsStats.totalValue >= 1000000
              ? `$${(dealsStats.totalValue / 1000000).toFixed(1)}M`
              : dealsStats.totalValue >= 1000
              ? `$${(dealsStats.totalValue / 1000).toFixed(0)}K`
              : `$${dealsStats.totalValue}`
          }
        : undefined,
      subItems: [
        {
          id: 'pipeline',
          label: 'Pipeline',
          icon: BarChart3,
          path: '/deals',
        },
        {
          id: 'list-view',
          label: 'List View',
          icon: List,
          path: '/deals?view=list',
        },
        {
          id: 'forecast',
          label: 'Forecast',
          icon: TrendingUp,
          path: '/forecast',
        },
        { id: 'divider-2', label: '', icon: null, path: '', isDivider: true },
        {
          id: 'hot-deals',
          label: 'Hot Deals',
          icon: Flame,
          path: '/deals?filter=hot',
          badge: dealsStats.hotDeals > 0 ? { count: dealsStats.hotDeals, variant: 'urgent' } : undefined,
        },
        {
          id: 'at-risk',
          label: 'At Risk',
          icon: AlertTriangle,
          path: '/deals?filter=at-risk',
          badge: dealsStats.atRisk > 0 ? { count: dealsStats.atRisk, variant: 'warning' } : undefined,
        },
        {
          id: 'stalled',
          label: 'Stalled',
          icon: Clock,
          path: '/deals?filter=stalled',
          badge: dealsStats.stalled > 0 ? { count: dealsStats.stalled, variant: 'warning' } : undefined,
        },
        {
          id: 'closed-won',
          label: 'Closed Won',
          icon: CheckCircle2,
          path: '/deals?filter=won',
          badge: dealsStats.closedWon > 0 ? { count: dealsStats.closedWon, variant: 'success' } : undefined,
        },
      ],
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
          id: 'connected',
          label: 'Connected',
          icon: CheckCircle2,
          path: '/integrations?filter=connected',
          badge: undefined, // TODO: Add connected integrations count when available
        },
        {
          id: 'available',
          label: 'Available',
          icon: Plus,
          path: '/integrations?filter=available',
          badge: undefined, // Shows all available integrations
        },
        {
          id: 'needs-attention',
          label: 'Needs Attention',
          icon: AlertTriangle,
          path: '/integrations?filter=attention',
          badge: undefined, // TODO: Add integrations needing attention count when available
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
        'flex flex-col transition-all duration-300 relative overflow-hidden flex-shrink-0',
        // Light mode: clean white with subtle shadows
        'bg-white border-r border-gray-200/80',
        // Dark mode: Premium glassmorphism - React Bits + Yutori blend
        'dark:bg-gradient-to-b dark:from-[#0c0c0f]/95 dark:via-[#0a0a0d]/90 dark:to-[#080810]/95',
        'dark:backdrop-blur-3xl dark:backdrop-saturate-200',
        'dark:border-white/[0.08]',
        // Light mode shadow
        'shadow-lg shadow-gray-200/50',
        // Dark mode: Ambient glow effects
        'dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03),0_0_80px_rgba(139,92,246,0.05)]',
        isCollapsed ? 'w-20' : 'w-72'
      )}
    >
      {/* Animated gradient orbs - React Bits style (dark mode only) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden dark:block">
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-1/3 -right-12 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl animate-bounce-subtle" />
        <div className="absolute bottom-20 -left-8 w-24 h-24 bg-pink-500/8 rounded-full blur-2xl animate-float" />
      </div>

      {/* Light mode: subtle gradient accent */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-50/50 via-transparent to-purple-50/30 pointer-events-none dark:hidden" />

      {/* Gradient overlay for depth (dark mode) */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/[0.02] via-transparent to-purple-500/[0.02] pointer-events-none hidden dark:block" />

      {/* Noise texture for premium feel (dark mode only) */}
      <div className="absolute inset-0 opacity-0 dark:opacity-[0.015] pointer-events-none" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

      {/* Logo */}
      <div className="relative z-10 h-16 flex items-center justify-between px-4 border-b border-gray-100 dark:border-white/[0.05]">
        {!isCollapsed && (
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <span className="text-xl">🌬️</span>
              </div>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 blur-lg opacity-40 dark:opacity-40 hidden dark:block" />
            </div>
            <div>
              <span className="font-bold text-gray-900 dark:text-white tracking-tight text-lg">Breeze</span>
              <p className="text-[10px] text-gray-500 dark:text-white/40 font-medium tracking-wide">SALES CRM</p>
            </div>
          </div>
        )}
        {isCollapsed && (
          <div className="relative mx-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <span className="text-xl">🌬️</span>
            </div>
          </div>
        )}

        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-muted rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Menu Items */}
      <nav className="relative z-10 flex-1 overflow-y-auto py-4">
        <div className="space-y-1 px-2">
          {/* Primary Navigation */}
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

          {/* Divider */}
          <div className="my-3 border-t border-border" />

          {/* Automation & Intelligence */}
          {!isCollapsed && (
            <div className="px-2 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Automation
            </div>
          )}

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

      {/* User Profile */}
      {!isCollapsed && (
        <div className="relative z-10 p-4 border-t border-gray-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-purple-500/20">
                {userInitials}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white dark:border-[#0a0a0d]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{userName}</p>
              <p className="text-xs text-gray-500 dark:text-white/40 font-mono truncate">{userEmail}</p>
            </div>
          </div>

          <div className="space-y-2.5 text-xs mb-4">
            <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05]">
              <span className="text-gray-500 dark:text-white/50">Today</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {stats?.completed || 0}/{(stats?.pending || 0) + (stats?.completed || 0)} done
              </span>
            </div>
            <div className="flex justify-between items-center px-3 py-2 rounded-lg bg-gray-50 dark:bg-white/[0.03] border border-gray-100 dark:border-white/[0.05]">
              <span className="text-gray-500 dark:text-white/50">Pipeline</span>
              <span className="font-bold text-gray-900 dark:text-white font-mono">
                {dealsStats.totalValue >= 1000000
                  ? `$${(dealsStats.totalValue / 1000000).toFixed(1)}M`
                  : dealsStats.totalValue >= 1000
                  ? `$${(dealsStats.totalValue / 1000).toFixed(0)}K`
                  : dealsStats.totalValue > 0
                  ? `$${dealsStats.totalValue}`
                  : '$0'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => navigate('/settings')}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-500 dark:text-white/50 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-all text-xs"
            >
              <Settings className="h-4 w-4" />
              Settings
            </button>
            <button className="flex items-center justify-center px-3 py-2 rounded-lg text-gray-500 dark:text-white/50 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Command Palette Trigger */}
      <div className="relative z-10 p-4 border-t border-gray-100 dark:border-white/[0.05]">
        <button
          className="w-full px-3 py-2.5 bg-gray-50 dark:bg-white/[0.03] rounded-xl flex items-center justify-between hover:bg-gray-100 dark:hover:bg-white/[0.06] transition-all border border-gray-200 dark:border-white/[0.05] group"
          onClick={() => {
            /* TODO: Open command palette */
          }}
        >
          {!isCollapsed ? (
            <>
              <span className="text-sm text-gray-400 dark:text-white/40 flex items-center gap-2 group-hover:text-gray-600 dark:group-hover:text-white/60 transition-colors">
                <Search className="h-4 w-4" />
                Search...
              </span>
              <kbd className="px-2 py-1 text-[10px] bg-gray-100 dark:bg-white/[0.05] border border-gray-200 dark:border-white/[0.08] rounded-md font-mono text-gray-400 dark:text-white/40">
                ⌘K
              </kbd>
            </>
          ) : (
            <Search className="h-5 w-5 text-gray-400 dark:text-white/40 mx-auto group-hover:text-gray-600 dark:group-hover:text-white/60 transition-colors" />
          )}
        </button>
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="p-2">
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full p-2 hover:bg-muted rounded transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-muted-foreground mx-auto" />
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
    return !isCollapsed ? <div className="my-2 border-t border-border" /> : null;
  }

  return (
    <div>
      <button
        onClick={hasSubItems ? onToggle : () => onNavigate(item.path)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300',
          isActive
            ? 'bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/5 text-blue-600 dark:text-white border border-blue-200 dark:border-white/10 shadow-sm dark:shadow-[0_0_20px_rgba(139,92,246,0.15),inset_0_1px_0_rgba(255,255,255,0.05)]'
            : 'text-gray-600 dark:text-white/60 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/[0.05] border border-transparent',
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
                  item.badge.variant === 'info' && 'bg-primary/10 text-primary dark:bg-primary/20',
                  item.badge.variant === 'success' && 'bg-success/10 text-success dark:bg-success/20',
                  item.badge.variant === 'urgent' && 'animate-pulse-dot'
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
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
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

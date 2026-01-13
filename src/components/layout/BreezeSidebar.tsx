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
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActionStats } from '@/hooks/useNextActions';
import { useInboxStats } from '@/hooks/useInboxStats';
import { useContactsStats } from '@/hooks/useContactsStats';
import { useDealsStats } from '@/hooks/useDealsStats';

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
      id: 'deals',
      label: 'Deals',
      icon: Briefcase,
      path: '/deals',
      badge: { count: 0, variant: 'info', label: '$1.2M' },
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
          badge: { count: 12, variant: 'urgent' },
        },
        {
          id: 'at-risk',
          label: 'At Risk',
          icon: AlertTriangle,
          path: '/deals?filter=at-risk',
          badge: { count: 8, variant: 'warning' },
        },
        {
          id: 'stalled',
          label: 'Stalled',
          icon: Clock,
          path: '/deals?filter=stalled',
          badge: { count: 15, variant: 'warning' },
        },
        {
          id: 'closed-won',
          label: 'Closed Won',
          icon: CheckCircle2,
          path: '/deals?filter=won',
          badge: { count: 24, variant: 'success' },
        },
      ],
    },
  ];

  const automationItems: MenuItem[] = [
    {
      id: 'ai-agents',
      label: 'AI Agents',
      icon: Bot,
      path: '/ai-agents',
      badge: undefined, // TODO: Add AI agents count when available
      subItems: [
        {
          id: 'all-agents',
          label: 'All Agents',
          icon: List,
          path: '/ai-agents',
          badge: undefined, // TODO: Add AI agents count when available
        },
        {
          id: 'create-agent',
          label: 'Create Agent',
          icon: Plus,
          path: '/ai-agents/new',
        },
        {
          id: 'agent-templates',
          label: 'Templates',
          icon: FileText,
          path: '/ai-agents/templates',
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
        'bg-white border-r border-gray-200 flex flex-col transition-all duration-300',
        isCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200">
        {!isCollapsed && (
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl">🌬️</span>
              <span className="font-semibold text-gray-900">Breeze</span>
            </div>
            <p className="text-xs text-gray-500">Sales Made Breezy</p>
          </div>
        )}
        {isCollapsed && <span className="text-2xl mx-auto">🌬️</span>}

        {!isCollapsed && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        )}
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-4">
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
          <div className="my-3 border-t border-gray-200" />

          {/* Automation & Intelligence */}
          {!isCollapsed && (
            <div className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
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

          {/* Divider */}
          <div className="my-3 border-t border-gray-200" />

          {/* System */}
          {!isCollapsed && (
            <div className="px-2 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
              System
            </div>
          )}

          {systemItems.map(item => (
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

      {/* Quick Actions */}
      {!isCollapsed && (
        <div className="px-4 py-3 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" className="text-xs">
              <Focus className="h-3 w-3 mr-1" />
              Focus
            </Button>
            <Button variant="outline" size="sm" className="text-xs">
              <PhoneCall className="h-3 w-3 mr-1" />
              Call
            </Button>
          </div>
        </div>
      )}

      {/* User Profile */}
      {!isCollapsed && (
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{userName}</p>
              <p className="text-xs text-gray-500 truncate">{userEmail}</p>
            </div>
          </div>

          <div className="space-y-2 text-xs text-gray-600 mb-3">
            <div className="flex justify-between">
              <span>📊 Today:</span>
              <span className="font-medium">
                {stats?.completed || 0}/{(stats?.pending || 0) + (stats?.completed || 0)} done
              </span>
            </div>
            <div className="flex justify-between">
              <span>💰 Pipeline:</span>
              <span className="font-medium">
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

          <Button
            size="sm"
            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-xs font-medium mb-2"
          >
            ↗️ Upgrade to Pro
          </Button>

          <div className="flex items-center justify-between text-xs">
            <button
              onClick={() => navigate('/settings')}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <Settings className="h-4 w-4" />
            </button>
            <button className="text-gray-600 hover:text-gray-900 transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Command Palette Trigger */}
      <div className="p-4 border-t border-gray-200">
        <button
          className="w-full px-3 py-2 bg-gray-100 rounded-lg flex items-center justify-between hover:bg-gray-200 transition-colors"
          onClick={() => {
            /* TODO: Open command palette */
          }}
        >
          {!isCollapsed ? (
            <>
              <span className="text-sm text-gray-600 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Search
              </span>
              <kbd className="px-2 py-1 text-xs bg-white border border-gray-300 rounded font-mono">
                ⌘K
              </kbd>
            </>
          ) : (
            <Search className="h-5 w-5 text-gray-600 mx-auto" />
          )}
        </button>
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="p-2">
          <button
            onClick={() => setIsCollapsed(false)}
            className="w-full p-2 hover:bg-gray-100 rounded transition-colors"
          >
            <ChevronRight className="h-5 w-5 text-gray-600 mx-auto" />
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
    return !isCollapsed ? <div className="my-2 border-t border-gray-200" /> : null;
  }

  return (
    <div>
      <button
        onClick={hasSubItems ? onToggle : () => onNavigate(item.path)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
          isActive
            ? 'bg-blue-50 text-blue-600'
            : 'text-gray-700 hover:bg-gray-100',
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
                  item.badge.variant === 'info' && 'bg-blue-100 text-blue-700',
                  item.badge.variant === 'success' && 'bg-green-100 text-green-700'
                )}
              >
                {item.badge.label || item.badge.count}
              </Badge>
            )}

            {hasSubItems && (
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform',
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
              return <div key={subItem.id} className="my-2 border-t border-gray-200" />;
            }

            const SubIcon = subItem.icon;
            return (
              <button
                key={subItem.id}
                onClick={() => onNavigate(subItem.path)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
              >
                {SubIcon && <SubIcon className="w-4 h-4" />}
                <span className="flex-1 text-left">{subItem.label}</span>
                {subItem.badge && (
                  <span className="text-xs text-gray-500">({subItem.badge.count})</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

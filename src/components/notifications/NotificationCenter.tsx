/**
 * Intelligent Notification Center
 * AI-powered notifications with suggested actions
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  CheckCheck,
  X,
  Sparkles,
  TrendingUp,
  CheckSquare,
  UserPlus,
  AtSign,
  Settings,
  Users,
  Target,
  User,
  Mail,
  Calendar,
  Phone,
  Video,
  Eye,
  FileText,
  MessageCircle,
  BarChart,
  Archive,
  Filter,
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useNotifications,
  Notification,
  NotificationType,
  NotificationPriority,
  SuggestedAction,
  getNotificationTypeLabel,
  getPriorityBadgeVariant,
} from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

// Icon mapping for notification types
const typeIcons: Record<NotificationType, React.ElementType> = {
  deal_update: TrendingUp,
  task_due: CheckSquare,
  lead_activity: UserPlus,
  mention: AtSign,
  ai_insight: Sparkles,
  system: Settings,
  team_update: Users,
  goal_progress: Target,
  contact_activity: User,
  email_received: Mail,
  meeting_reminder: Calendar,
};

// Icon mapping for actions
const actionIcons: Record<string, React.ElementType> = {
  TrendingUp,
  Phone,
  CheckCircle: Check,
  Calendar,
  Eye,
  Mail,
  User,
  UserPlus,
  FileText,
  MessageCircle,
  BarChart,
  Video,
};

interface NotificationItemProps {
  notification: Notification;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onAction: (id: string, action: SuggestedAction) => void;
}

function NotificationItem({ notification, onMarkRead, onArchive, onAction }: NotificationItemProps) {
  const TypeIcon = typeIcons[notification.type || 'system'] || Bell;

  return (
    <div
      className={cn(
        'p-3 hover:bg-muted/50 transition-colors cursor-pointer border-b last:border-b-0',
        !notification.read && 'bg-primary/5'
      )}
      onClick={() => !notification.read && onMarkRead(notification.id)}
    >
      <div className="flex gap-3">
        {/* Icon */}
        <div
          className={cn(
            'h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0',
            notification.ai_priority === 'critical' && 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
            notification.ai_priority === 'high' && 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
            notification.ai_priority === 'medium' && 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
            notification.ai_priority === 'low' && 'bg-gray-100 text-gray-600 dark:bg-gray-900/30 dark:text-gray-400',
            !notification.ai_priority && 'bg-muted text-muted-foreground'
          )}
        >
          <TypeIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className={cn('text-sm font-medium truncate', !notification.read && 'font-semibold')}>
                  {notification.title}
                </p>
                {!notification.read && (
                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {notification.message}
              </p>
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {notification.time}
            </span>
          </div>

          {/* AI Summary */}
          {notification.ai_summary && (
            <div className="mt-2 p-2 bg-violet-50 dark:bg-violet-900/20 rounded-md border border-violet-100 dark:border-violet-900/30">
              <div className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                <Sparkles className="h-3 w-3" />
                <span className="text-xs font-medium">AI Insight</span>
              </div>
              <p className="text-xs text-violet-700 dark:text-violet-300 mt-1">
                {notification.ai_summary}
              </p>
            </div>
          )}

          {/* Suggested Actions */}
          {notification.ai_suggested_actions && notification.ai_suggested_actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {notification.ai_suggested_actions.map((action, idx) => {
                const ActionIcon = action.icon ? actionIcons[action.icon] : null;
                return (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      onAction(notification.id, action);
                    }}
                  >
                    {ActionIcon && <ActionIcon className="h-3 w-3 mr-1" />}
                    {action.label}
                  </Button>
                );
              })}
            </div>
          )}

          {/* Type and Priority badges */}
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className="text-[10px] h-5">
              {getNotificationTypeLabel(notification.type || 'system')}
            </Badge>
            {notification.ai_priority && (
              <Badge variant={getPriorityBadgeVariant(notification.ai_priority)} className="text-[10px] h-5 capitalize">
                {notification.ai_priority}
              </Badge>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              onArchive(notification.id);
            }}
          >
            <Archive className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    criticalCount,
    markAsRead,
    markAllAsRead,
    archiveNotification,
    executeSuggestedAction,
    getUnreadNotifications,
    getCriticalNotifications,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

  const filteredNotifications =
    filter === 'unread' ? getUnreadNotifications() :
    filter === 'critical' ? getCriticalNotifications() :
    notifications;

  const handleAction = (notificationId: string, action: SuggestedAction) => {
    executeSuggestedAction(notificationId, action);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-[10px] font-medium text-primary-foreground flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
          {criticalCount > 0 && (
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="end">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="h-5">
                {unreadCount} new
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Filter className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFilter('all')}>
                  <Bell className="h-4 w-4 mr-2" />
                  All Notifications
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('unread')}>
                  <Mail className="h-4 w-4 mr-2" />
                  Unread Only
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilter('critical')}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Critical Only
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={markAllAsRead}>
                <CheckCheck className="h-4 w-4 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Critical Alert Banner */}
        {criticalCount > 0 && (
          <div className="bg-red-50 dark:bg-red-900/20 border-b border-red-100 dark:border-red-900/30 px-4 py-2">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm font-medium">
                {criticalCount} critical notification{criticalCount > 1 ? 's' : ''} require{criticalCount === 1 ? 's' : ''} your attention
              </span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="all" className="w-full">
          <div className="border-b px-2">
            <TabsList className="h-10 w-full justify-start bg-transparent">
              <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
              <TabsTrigger value="ai_insights" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                AI Insights
              </TabsTrigger>
              <TabsTrigger value="mentions" className="text-xs">
                <AtSign className="h-3 w-3 mr-1" />
                Mentions
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="all" className="m-0">
            <ScrollArea className="h-[400px]">
              {filteredNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Bell className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">No notifications</p>
                  <p className="text-xs">You're all caught up!</p>
                </div>
              ) : (
                filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkRead={markAsRead}
                    onArchive={archiveNotification}
                    onAction={handleAction}
                  />
                ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="ai_insights" className="m-0">
            <ScrollArea className="h-[400px]">
              {notifications.filter(n => n.type === 'ai_insight').length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Sparkles className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">No AI insights</p>
                  <p className="text-xs">AI-generated insights will appear here</p>
                </div>
              ) : (
                notifications
                  .filter(n => n.type === 'ai_insight')
                  .map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={markAsRead}
                      onArchive={archiveNotification}
                      onAction={handleAction}
                    />
                  ))
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="mentions" className="m-0">
            <ScrollArea className="h-[400px]">
              {notifications.filter(n => n.type === 'mention').length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <AtSign className="h-10 w-10 mb-3 opacity-50" />
                  <p className="text-sm">No mentions</p>
                  <p className="text-xs">You'll be notified when someone mentions you</p>
                </div>
              ) : (
                notifications
                  .filter(n => n.type === 'mention')
                  .map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onMarkRead={markAsRead}
                      onArchive={archiveNotification}
                      onAction={handleAction}
                    />
                  ))
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="border-t p-2">
          <Button
            variant="ghost"
            className="w-full text-xs h-8"
            onClick={() => {
              setOpen(false);
              navigate('/settings');
            }}
          >
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Notification Settings
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useState, ReactNode } from 'react';
import { Bell, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { useIsMobile } from '@/hooks/use-mobile';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface HeaderProps {
  title: string;
  subtitle?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  actions?: ReactNode;
}

export function Header({ title, subtitle, action, actions }: HeaderProps) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotification } = useNotifications();
  const isMobile = useIsMobile();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-white/[0.05] bg-white/80 dark:bg-background/80 backdrop-blur-2xl backdrop-saturate-150">
      <div className="flex h-16 items-center justify-between px-4 md:px-6 gap-4">
        <div className={isMobile ? 'ml-12' : ''}>
          <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-500 dark:text-white/40">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Custom actions */}
          {actions}

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Notifications */}
          <Popover open={notificationsOpen} onOpenChange={setNotificationsOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="relative h-8 w-8">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-destructive" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h4 className="font-medium text-sm">Notifications</h4>
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-7">
                    Mark all as read
                  </Button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No notifications
                  </div>
                ) : (
                  notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`relative flex items-start gap-3 border-b border-border px-4 py-3 hover:bg-muted/50 cursor-pointer ${!notification.read ? 'bg-primary/5' : ''}`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      {!notification.read && (
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      <div className={`flex-1 ${notification.read ? 'ml-4' : ''}`}>
                        <p className="text-sm font-medium">{notification.title}</p>
                        <p className="text-xs text-muted-foreground">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-1">{notification.time}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearNotification(notification.id);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </PopoverContent>
          </Popover>

          {/* Action button */}
          {action && (
            <Button onClick={action.onClick} size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{action.label}</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
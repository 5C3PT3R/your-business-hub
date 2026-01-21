import { ReactNode } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationCenter } from '@/components/notifications/NotificationCenter';
import { useIsMobile } from '@/hooks/use-mobile';
import { ThemeToggle } from '@/components/ui/theme-toggle';

interface HeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  actions?: ReactNode;
}

export function Header({ title, subtitle, action, actions }: HeaderProps) {
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

          {/* AI-Powered Notification Center */}
          <NotificationCenter />

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

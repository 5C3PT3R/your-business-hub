import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidebarCollapse } from '@/hooks/useSidebarCollapse';
import { AgentButton } from '@/components/agent/AgentButton';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { collapsed } = useSidebarCollapse();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-foreground animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className={cn(
        'min-h-screen transition-all duration-200',
        isMobile ? 'pl-0' : collapsed ? 'pl-16' : 'pl-60'
      )}>
        {children}
      </main>
      <AgentButton />
    </div>
  );
}
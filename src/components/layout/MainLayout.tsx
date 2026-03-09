import { ReactNode, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BreezeSidebar } from './BreezeSidebar';
import { MobileNavigation } from './MobileNavigation';
import { useAuth } from '@/hooks/useAuth';
import { useIsMobile } from '@/hooks/use-mobile';
import { AgentButton } from '@/components/agent/AgentButton';
import { cn } from '@/lib/utils';

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const mainRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  // Scroll main content to top only on route change, not on re-renders
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-xl gradient-brand animate-pulse" />
            <div className="absolute inset-0 h-12 w-12 rounded-xl gradient-brand blur-xl opacity-50 animate-pulse" />
          </div>
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="h-screen bg-background flex relative overflow-hidden">
      {/* Dramatic animated gradient background - React Bits style */}
      <div className="fixed inset-0 pointer-events-none">
        {/* Primary gradient mesh - works in both light and dark */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5 dark:from-blue-950/30 dark:to-purple-950/20" />

        {/* Animated gradient orbs */}
        <div className="absolute top-0 right-[20%] w-[800px] h-[800px] bg-gradient-to-br from-blue-500/5 via-purple-500/3 to-transparent dark:from-blue-500/8 dark:via-purple-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-[10%] w-[600px] h-[600px] bg-gradient-to-tr from-violet-500/5 via-pink-500/3 to-transparent dark:from-violet-500/8 dark:via-pink-500/5 rounded-full blur-3xl" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[50%] w-[400px] h-[400px] bg-gradient-to-r from-cyan-500/3 to-blue-500/3 dark:from-cyan-500/5 dark:to-blue-500/5 rounded-full blur-2xl animate-float" />

        {/* Subtle grid overlay - only visible in dark mode */}
        <div className="absolute inset-0 opacity-0 dark:opacity-[0.02]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
                           linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />
      </div>

      {!isMobile && <BreezeSidebar />}
      <main
        ref={mainRef}
        className={cn(
          'flex-1 h-screen overflow-y-auto relative z-10',
          isMobile && 'pb-20'
        )}
      >
        {children}
      </main>
      <AgentButton />
      {isMobile && <MobileNavigation />}
    </div>
  );
}
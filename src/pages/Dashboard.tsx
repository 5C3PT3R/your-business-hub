import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { IndustryDashboard } from '@/components/dashboard/IndustryDashboard';
import { AIInsightsWidget } from '@/components/dashboard/AIInsightsWidget';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspace } from '@/hooks/useWorkspace';

export default function Dashboard() {
  const { user } = useAuth();
  const { template } = useWorkspace();
  const userName = user?.user_metadata?.full_name?.split(' ')[0] || 'there';

  return (
    <MainLayout>
      <Header
        title="Dashboard"
        subtitle={`Welcome back, ${userName}! Here's your ${template?.name || 'CRM'} overview.`}
      />

      <div className="p-6 md:p-8 space-y-6 relative overflow-hidden">
        {/* Animated background gradients - Royal Olive & Gold */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-amber-500/20 via-yellow-500/15 to-lime-500/10 dark:from-amber-500/20 dark:via-yellow-600/15 dark:to-lime-700/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-lime-500/15 via-amber-500/10 to-transparent dark:from-lime-700/15 dark:via-amber-600/10 rounded-full blur-3xl" />
        </div>

        <div className="relative space-y-6">
          <AIInsightsWidget />
          <IndustryDashboard />
        </div>
      </div>
    </MainLayout>
  );
}

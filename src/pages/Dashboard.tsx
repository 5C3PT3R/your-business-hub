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

      <div className="p-4 md:p-6 space-y-6 relative overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Animated background gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-pink-500/10 dark:from-blue-500/30 dark:via-purple-500/20 dark:to-pink-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent dark:from-cyan-500/20 dark:via-blue-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative">
          <AIInsightsWidget />
          <IndustryDashboard />
        </div>
      </div>
    </MainLayout>
  );
}

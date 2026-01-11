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

      <div className="p-4 md:p-6 space-y-6">
        <AIInsightsWidget />
        <IndustryDashboard />
      </div>
    </MainLayout>
  );
}

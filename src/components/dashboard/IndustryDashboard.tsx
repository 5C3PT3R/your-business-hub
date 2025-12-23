import { useWorkspace } from '@/hooks/useWorkspace';
import { SalesDashboard } from './dashboards/SalesDashboard';
import { RealEstateDashboard } from './dashboards/RealEstateDashboard';
import { EcommerceDashboard } from './dashboards/EcommerceDashboard';
import { InsuranceDashboard } from './dashboards/InsuranceDashboard';

export function IndustryDashboard() {
  const { workspace } = useWorkspace();
  const industryType = workspace?.industry_type;

  switch (industryType) {
    case 'real_estate':
      return <RealEstateDashboard />;
    case 'ecommerce':
      return <EcommerceDashboard />;
    case 'insurance':
      return <InsuranceDashboard />;
    case 'sales':
    default:
      return <SalesDashboard />;
  }
}

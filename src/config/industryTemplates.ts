import { 
  Briefcase, 
  Building2, 
  ShoppingCart, 
  Landmark, 
  Shield,
  LucideIcon 
} from 'lucide-react';

export type IndustryType = 'sales' | 'real_estate' | 'ecommerce' | 'banking' | 'insurance';

export interface IndustryTemplate {
  id: IndustryType;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  gradient: string;
  enabledModules: string[];
  pipelines: string[];
  uiLabels: {
    deals: string;
    contacts: string;
    leads: string;
    tasks: string;
  };
  dashboardWidgets: string[];
  accentColor: string;
}

export const industryTemplates: Record<IndustryType, IndustryTemplate> = {
  sales: {
    id: 'sales',
    name: 'Sales CRM',
    description: 'Close deals faster with AI-powered calling',
    icon: Briefcase,
    color: 'hsl(270, 70%, 60%)',
    gradient: 'from-violet-500 to-purple-600',
    accentColor: 'violet',
    enabledModules: ['leads', 'contacts', 'deals', 'tasks', 'reports'],
    pipelines: ['sales_pipeline'],
    uiLabels: {
      deals: 'Deals',
      contacts: 'Contacts',
      leads: 'Leads',
      tasks: 'Tasks',
    },
    dashboardWidgets: ['revenue_chart', 'lead_sources', 'recent_deals', 'upcoming_tasks', 'metrics'],
  },
  real_estate: {
    id: 'real_estate',
    name: 'Real Estate CRM',
    description: 'Match buyers to properties automatically',
    icon: Building2,
    color: 'hsl(155, 70%, 40%)',
    gradient: 'from-emerald-500 to-teal-600',
    accentColor: 'emerald',
    enabledModules: ['properties', 'clients', 'bookings', 'site_visits', 'tasks'],
    pipelines: ['buyer_pipeline', 'seller_pipeline'],
    uiLabels: {
      deals: 'Bookings',
      contacts: 'Clients',
      leads: 'Inquiries',
      tasks: 'Site Visits',
    },
    dashboardWidgets: ['property_listings', 'site_visits_calendar', 'booking_pipeline', 'hot_leads', 'metrics'],
  },
  ecommerce: {
    id: 'ecommerce',
    name: 'E-commerce CRM',
    description: 'Resolve customer issues from calls instantly',
    icon: ShoppingCart,
    color: 'hsl(38, 92%, 50%)',
    gradient: 'from-orange-500 to-amber-500',
    accentColor: 'orange',
    enabledModules: ['tickets', 'customers', 'orders', 'returns', 'reviews'],
    pipelines: ['support_pipeline', 'returns_pipeline'],
    uiLabels: {
      deals: 'Orders',
      contacts: 'Customers',
      leads: 'Tickets',
      tasks: 'Returns',
    },
    dashboardWidgets: ['order_stats', 'ticket_queue', 'customer_satisfaction', 'return_rate', 'metrics'],
  },
  banking: {
    id: 'banking',
    name: 'Banking CRM',
    description: 'Call-center CRM with SLA & compliance',
    icon: Landmark,
    color: 'hsl(210, 80%, 55%)',
    gradient: 'from-blue-500 to-indigo-600',
    accentColor: 'blue',
    enabledModules: ['accounts', 'applications', 'compliance', 'sla_tracking', 'calls'],
    pipelines: ['loan_pipeline', 'account_opening_pipeline'],
    uiLabels: {
      deals: 'Applications',
      contacts: 'Accounts',
      leads: 'Prospects',
      tasks: 'Follow-ups',
    },
    dashboardWidgets: ['sla_compliance', 'application_status', 'call_metrics', 'pending_approvals', 'metrics'],
  },
  insurance: {
    id: 'insurance',
    name: 'Insurance CRM',
    description: 'Manage claims directly from conversations',
    icon: Shield,
    color: 'hsl(340, 75%, 55%)',
    gradient: 'from-rose-500 to-pink-600',
    accentColor: 'rose',
    enabledModules: ['policies', 'claims', 'renewals', 'agents', 'underwriting'],
    pipelines: ['claims_pipeline', 'policy_pipeline'],
    uiLabels: {
      deals: 'Claims',
      contacts: 'Policyholders',
      leads: 'Quotes',
      tasks: 'Renewals',
    },
    dashboardWidgets: ['claims_overview', 'policy_renewals', 'agent_performance', 'premium_collection', 'metrics'],
  },
};

export const getIndustryTemplate = (industry: IndustryType): IndustryTemplate => {
  return industryTemplates[industry] || industryTemplates.sales;
};

export const getAllIndustries = (): IndustryTemplate[] => {
  return Object.values(industryTemplates);
};

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  status: 'new' | 'contacted' | 'qualified' | 'lost';
  source: string;
  createdAt: string;
  value: number;
}

export interface Contact {
  id: string;
  name: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  avatar?: string;
  lastContact: string;
}

export interface Deal {
  id: string;
  title: string;
  company: string;
  value: number;
  stage: 'prospecting' | 'qualification' | 'proposal' | 'negotiation' | 'closed-won' | 'closed-lost';
  probability: number;
  expectedClose: string;
  owner: string;
  contactId: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  dueDate: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  assignee: string;
  relatedTo?: string;
}

export interface Activity {
  id: string;
  type: 'call' | 'email' | 'meeting' | 'note';
  title: string;
  description: string;
  date: string;
  contactId?: string;
  dealId?: string;
}

export interface DashboardMetrics {
  totalLeads: number;
  leadsChange: number;
  totalDeals: number;
  dealsChange: number;
  revenue: number;
  revenueChange: number;
  conversionRate: number;
  conversionChange: number;
}

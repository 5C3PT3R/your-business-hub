import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';

export interface EcommerceCustomer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  lifetime_value: number;
  total_orders: number;
  created_at: string;
}

export interface EcommerceOrder {
  id: string;
  order_number: string;
  customer_id: string | null;
  items: any[];
  total_amount: number;
  order_status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  delivery_date: string | null;
  created_at: string;
  customer?: EcommerceCustomer;
}

export interface EcommerceTicket {
  id: string;
  ticket_number: string;
  customer_id: string | null;
  order_id: string | null;
  subject: string;
  description: string | null;
  category: 'refund' | 'delivery_delay' | 'damaged_product' | 'payment_issue' | 'general' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'new' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  sla_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  customer?: EcommerceCustomer;
  order?: EcommerceOrder;
}

export function useEcommerceCustomers() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['ecommerce_customers', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from('ecommerce_customers')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EcommerceCustomer[];
    },
    enabled: !!workspace?.id,
  });
}

export function useEcommerceOrders() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['ecommerce_orders', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select('*, customer:ecommerce_customers(*)')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EcommerceOrder[];
    },
    enabled: !!workspace?.id,
  });
}

export function useEcommerceTickets() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['ecommerce_tickets', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from('ecommerce_tickets')
        .select('*, customer:ecommerce_customers(*), order:ecommerce_orders(*)')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as EcommerceTicket[];
    },
    enabled: !!workspace?.id,
  });
}

export function useEcommerceMetrics() {
  const { data: customers = [] } = useEcommerceCustomers();
  const { data: orders = [] } = useEcommerceOrders();
  const { data: tickets = [] } = useEcommerceTickets();

  const openTickets = tickets.filter(t => ['new', 'in_progress', 'waiting'].includes(t.status));
  const urgentTickets = tickets.filter(t => t.priority === 'urgent' && t.status !== 'resolved' && t.status !== 'closed');
  const slaBreach = tickets.filter(t => t.sla_due_at && new Date(t.sla_due_at) < new Date() && t.status !== 'resolved' && t.status !== 'closed');
  
  const todayOrders = orders.filter(o => {
    const today = new Date();
    const orderDate = new Date(o.created_at);
    return orderDate.toDateString() === today.toDateString();
  });

  const totalRevenue = orders
    .filter(o => o.payment_status === 'paid')
    .reduce((sum, o) => sum + (o.total_amount || 0), 0);

  const avgResolutionTime = tickets
    .filter(t => t.resolved_at && t.created_at)
    .reduce((sum, t) => {
      const created = new Date(t.created_at).getTime();
      const resolved = new Date(t.resolved_at!).getTime();
      return sum + (resolved - created);
    }, 0) / (tickets.filter(t => t.resolved_at).length || 1);

  return {
    totalCustomers: customers.length,
    totalOrders: orders.length,
    todayOrders: todayOrders.length,
    totalRevenue,
    openTickets: openTickets.length,
    urgentTickets: urgentTickets.length,
    slaBreach: slaBreach.length,
    avgResolutionTime: Math.round(avgResolutionTime / (1000 * 60 * 60)), // in hours
    ticketsByStatus: {
      new: tickets.filter(t => t.status === 'new').length,
      in_progress: tickets.filter(t => t.status === 'in_progress').length,
      waiting: tickets.filter(t => t.status === 'waiting').length,
      resolved: tickets.filter(t => t.status === 'resolved').length,
    },
    ticketsByCategory: {
      refund: tickets.filter(t => t.category === 'refund').length,
      delivery_delay: tickets.filter(t => t.category === 'delivery_delay').length,
      damaged_product: tickets.filter(t => t.category === 'damaged_product').length,
      payment_issue: tickets.filter(t => t.category === 'payment_issue').length,
      general: tickets.filter(t => t.category === 'general').length,
    },
  };
}

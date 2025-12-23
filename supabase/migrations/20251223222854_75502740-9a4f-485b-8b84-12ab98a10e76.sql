-- E-commerce CRM Tables

-- Customers table (E-commerce)
CREATE TABLE public.ecommerce_customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  lifetime_value NUMERIC DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Orders table (E-commerce)
CREATE TYPE public.order_status AS ENUM ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded');
CREATE TYPE public.payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

CREATE TABLE public.ecommerce_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.ecommerce_customers(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  items JSONB DEFAULT '[]'::jsonb,
  total_amount NUMERIC DEFAULT 0,
  order_status order_status DEFAULT 'pending',
  payment_status payment_status DEFAULT 'pending',
  delivery_date DATE,
  refund_eligible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tickets table (E-commerce)
CREATE TYPE public.ticket_status AS ENUM ('new', 'in_progress', 'waiting', 'resolved', 'closed');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');
CREATE TYPE public.ticket_category AS ENUM ('refund', 'delivery_delay', 'damaged_product', 'payment_issue', 'general', 'other');

CREATE TABLE public.ecommerce_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.ecommerce_customers(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.ecommerce_orders(id) ON DELETE SET NULL,
  ticket_number TEXT NOT NULL,
  subject TEXT NOT NULL,
  description TEXT,
  category ticket_category DEFAULT 'general',
  priority ticket_priority DEFAULT 'medium',
  status ticket_status DEFAULT 'new',
  sla_due_at TIMESTAMP WITH TIME ZONE,
  first_response_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Real Estate CRM Tables

-- Clients table (Real Estate)
CREATE TYPE public.client_type AS ENUM ('buyer', 'seller', 'both');
CREATE TYPE public.intent_level AS ENUM ('cold', 'warm', 'hot');

CREATE TABLE public.realestate_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  client_type client_type DEFAULT 'buyer',
  budget_min NUMERIC,
  budget_max NUMERIC,
  preferred_locations TEXT[],
  property_type TEXT,
  intent_level intent_level DEFAULT 'warm',
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Properties table (Real Estate)
CREATE TYPE public.property_status AS ENUM ('available', 'under_negotiation', 'booked', 'sold');
CREATE TYPE public.property_type AS ENUM ('apartment', 'villa', 'plot', 'commercial', 'penthouse', 'studio');

CREATE TABLE public.realestate_properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  address TEXT,
  property_type property_type DEFAULT 'apartment',
  price NUMERIC NOT NULL,
  bedrooms INTEGER,
  bathrooms INTEGER,
  area_sqft NUMERIC,
  status property_status DEFAULT 'available',
  description TEXT,
  amenities TEXT[],
  images TEXT[],
  broker_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Site Visits table (Real Estate)
CREATE TYPE public.visit_status AS ENUM ('scheduled', 'completed', 'cancelled', 'no_show');

CREATE TABLE public.realestate_site_visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.realestate_clients(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.realestate_properties(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status visit_status DEFAULT 'scheduled',
  notes TEXT,
  feedback TEXT,
  interest_level INTEGER CHECK (interest_level >= 1 AND interest_level <= 5),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Buyer Pipeline table (Real Estate)
CREATE TYPE public.buyer_stage AS ENUM ('inquiry', 'qualified', 'site_visit', 'negotiation', 'booked', 'closed_won', 'closed_lost');

CREATE TABLE public.realestate_buyer_pipeline (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.realestate_clients(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.realestate_properties(id) ON DELETE SET NULL,
  stage buyer_stage DEFAULT 'inquiry',
  expected_close_date DATE,
  deal_value NUMERIC,
  probability INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.ecommerce_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ecommerce_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realestate_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realestate_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realestate_site_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.realestate_buyer_pipeline ENABLE ROW LEVEL SECURITY;

-- RLS Policies for E-commerce Customers
CREATE POLICY "Users can view workspace customers" ON public.ecommerce_customers
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace customers" ON public.ecommerce_customers
  FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace customers" ON public.ecommerce_customers
  FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace customers" ON public.ecommerce_customers
  FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for E-commerce Orders
CREATE POLICY "Users can view workspace orders" ON public.ecommerce_orders
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace orders" ON public.ecommerce_orders
  FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace orders" ON public.ecommerce_orders
  FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace orders" ON public.ecommerce_orders
  FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for E-commerce Tickets
CREATE POLICY "Users can view workspace tickets" ON public.ecommerce_tickets
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace tickets" ON public.ecommerce_tickets
  FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace tickets" ON public.ecommerce_tickets
  FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace tickets" ON public.ecommerce_tickets
  FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for Real Estate Clients
CREATE POLICY "Users can view workspace clients" ON public.realestate_clients
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace clients" ON public.realestate_clients
  FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace clients" ON public.realestate_clients
  FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace clients" ON public.realestate_clients
  FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for Real Estate Properties
CREATE POLICY "Users can view workspace properties" ON public.realestate_properties
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace properties" ON public.realestate_properties
  FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace properties" ON public.realestate_properties
  FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace properties" ON public.realestate_properties
  FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for Real Estate Site Visits
CREATE POLICY "Users can view workspace site visits" ON public.realestate_site_visits
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace site visits" ON public.realestate_site_visits
  FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace site visits" ON public.realestate_site_visits
  FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace site visits" ON public.realestate_site_visits
  FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- RLS Policies for Real Estate Buyer Pipeline
CREATE POLICY "Users can view workspace pipeline" ON public.realestate_buyer_pipeline
  FOR SELECT USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can insert workspace pipeline" ON public.realestate_buyer_pipeline
  FOR INSERT WITH CHECK (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can update workspace pipeline" ON public.realestate_buyer_pipeline
  FOR UPDATE USING (is_workspace_member(auth.uid(), workspace_id));
CREATE POLICY "Users can delete workspace pipeline" ON public.realestate_buyer_pipeline
  FOR DELETE USING (is_workspace_member(auth.uid(), workspace_id));

-- Triggers for updated_at
CREATE TRIGGER update_ecommerce_customers_updated_at BEFORE UPDATE ON public.ecommerce_customers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ecommerce_orders_updated_at BEFORE UPDATE ON public.ecommerce_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ecommerce_tickets_updated_at BEFORE UPDATE ON public.ecommerce_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_realestate_clients_updated_at BEFORE UPDATE ON public.realestate_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_realestate_properties_updated_at BEFORE UPDATE ON public.realestate_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_realestate_site_visits_updated_at BEFORE UPDATE ON public.realestate_site_visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_realestate_buyer_pipeline_updated_at BEFORE UPDATE ON public.realestate_buyer_pipeline
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes for performance
CREATE INDEX idx_ecommerce_customers_workspace ON public.ecommerce_customers(workspace_id);
CREATE INDEX idx_ecommerce_orders_workspace ON public.ecommerce_orders(workspace_id);
CREATE INDEX idx_ecommerce_orders_customer ON public.ecommerce_orders(customer_id);
CREATE INDEX idx_ecommerce_tickets_workspace ON public.ecommerce_tickets(workspace_id);
CREATE INDEX idx_ecommerce_tickets_status ON public.ecommerce_tickets(status);
CREATE INDEX idx_ecommerce_tickets_sla ON public.ecommerce_tickets(sla_due_at);
CREATE INDEX idx_realestate_clients_workspace ON public.realestate_clients(workspace_id);
CREATE INDEX idx_realestate_properties_workspace ON public.realestate_properties(workspace_id);
CREATE INDEX idx_realestate_properties_status ON public.realestate_properties(status);
CREATE INDEX idx_realestate_site_visits_workspace ON public.realestate_site_visits(workspace_id);
CREATE INDEX idx_realestate_site_visits_scheduled ON public.realestate_site_visits(scheduled_at);
CREATE INDEX idx_realestate_buyer_pipeline_workspace ON public.realestate_buyer_pipeline(workspace_id);
CREATE INDEX idx_realestate_buyer_pipeline_stage ON public.realestate_buyer_pipeline(stage);
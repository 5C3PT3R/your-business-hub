import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';

export interface RealEstateClient {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  client_type: 'buyer' | 'seller' | 'both';
  budget_min: number | null;
  budget_max: number | null;
  preferred_locations: string[] | null;
  property_type: string | null;
  intent_level: 'cold' | 'warm' | 'hot';
  notes: string | null;
  created_at: string;
}

export interface RealEstateProperty {
  id: string;
  title: string;
  location: string;
  address: string | null;
  property_type: 'apartment' | 'villa' | 'plot' | 'commercial' | 'penthouse' | 'studio';
  price: number;
  bedrooms: number | null;
  bathrooms: number | null;
  area_sqft: number | null;
  status: 'available' | 'under_negotiation' | 'booked' | 'sold';
  description: string | null;
  amenities: string[] | null;
  created_at: string;
}

export interface RealEstateSiteVisit {
  id: string;
  client_id: string;
  property_id: string;
  scheduled_at: string;
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  feedback: string | null;
  interest_level: number | null;
  created_at: string;
  client?: RealEstateClient;
  property?: RealEstateProperty;
}

export interface RealEstateBuyerPipeline {
  id: string;
  client_id: string;
  property_id: string | null;
  stage: 'inquiry' | 'qualified' | 'site_visit' | 'negotiation' | 'booked' | 'closed_won' | 'closed_lost';
  expected_close_date: string | null;
  deal_value: number | null;
  probability: number;
  notes: string | null;
  created_at: string;
  client?: RealEstateClient;
  property?: RealEstateProperty;
}

export function useRealEstateClients() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['realestate_clients', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from('realestate_clients')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RealEstateClient[];
    },
    enabled: !!workspace?.id,
  });
}

export function useRealEstateProperties() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['realestate_properties', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from('realestate_properties')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RealEstateProperty[];
    },
    enabled: !!workspace?.id,
  });
}

export function useRealEstateSiteVisits() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['realestate_site_visits', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from('realestate_site_visits')
        .select('*, client:realestate_clients(*), property:realestate_properties(*)')
        .eq('workspace_id', workspace.id)
        .order('scheduled_at', { ascending: true });
      if (error) throw error;
      return data as RealEstateSiteVisit[];
    },
    enabled: !!workspace?.id,
  });
}

export function useRealEstatePipeline() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ['realestate_pipeline', workspace?.id],
    queryFn: async () => {
      if (!workspace?.id) return [];
      const { data, error } = await supabase
        .from('realestate_buyer_pipeline')
        .select('*, client:realestate_clients(*), property:realestate_properties(*)')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as RealEstateBuyerPipeline[];
    },
    enabled: !!workspace?.id,
  });
}

export function useRealEstateMetrics() {
  const { data: clients = [] } = useRealEstateClients();
  const { data: properties = [] } = useRealEstateProperties();
  const { data: siteVisits = [] } = useRealEstateSiteVisits();
  const { data: pipeline = [] } = useRealEstatePipeline();

  const hotClients = clients.filter(c => c.intent_level === 'hot');
  const availableProperties = properties.filter(p => p.status === 'available');
  const bookedProperties = properties.filter(p => p.status === 'booked' || p.status === 'sold');
  
  const upcomingSiteVisits = siteVisits.filter(sv => 
    sv.status === 'scheduled' && new Date(sv.scheduled_at) >= new Date()
  );

  const todaySiteVisits = siteVisits.filter(sv => {
    const today = new Date();
    const visitDate = new Date(sv.scheduled_at);
    return visitDate.toDateString() === today.toDateString() && sv.status === 'scheduled';
  });

  const totalPipelineValue = pipeline
    .filter(p => !['closed_lost'].includes(p.stage))
    .reduce((sum, p) => sum + (p.deal_value || 0), 0);

  const wonDeals = pipeline.filter(p => p.stage === 'closed_won');
  const totalWonValue = wonDeals.reduce((sum, p) => sum + (p.deal_value || 0), 0);

  return {
    totalClients: clients.length,
    hotClients: hotClients.length,
    totalProperties: properties.length,
    availableProperties: availableProperties.length,
    bookedProperties: bookedProperties.length,
    upcomingSiteVisits: upcomingSiteVisits.length,
    todaySiteVisits: todaySiteVisits.length,
    totalPipelineValue,
    totalWonValue,
    pipelineByStage: {
      inquiry: pipeline.filter(p => p.stage === 'inquiry').length,
      qualified: pipeline.filter(p => p.stage === 'qualified').length,
      site_visit: pipeline.filter(p => p.stage === 'site_visit').length,
      negotiation: pipeline.filter(p => p.stage === 'negotiation').length,
      booked: pipeline.filter(p => p.stage === 'booked').length,
      closed_won: pipeline.filter(p => p.stage === 'closed_won').length,
    },
    clientsByIntent: {
      hot: clients.filter(c => c.intent_level === 'hot').length,
      warm: clients.filter(c => c.intent_level === 'warm').length,
      cold: clients.filter(c => c.intent_level === 'cold').length,
    },
  };
}

/**
 * Companies Hook - Manage B2B company relationships
 * Note: Uses type assertions until 'companies' table migration is applied
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { useToast } from './use-toast';

export interface Company {
  id: string;
  workspace_id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  employee_count: string | null;
  revenue_range: string | null;
  location: string | null;
  website: string | null;
  logo_url: string | null;
  description: string | null;
  linkedin_url: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  founded_year: number | null;
  tech_stack: string[] | null;
  tags: string[] | null;
  enriched_at: string | null;
  custom_fields: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Computed fields from relations
  contacts_count?: number;
  deals_count?: number;
  total_deal_value?: number;
}

export interface CreateCompanyInput {
  name: string;
  domain?: string | null;
  industry?: string | null;
  employee_count?: string | null;
  revenue_range?: string | null;
  location?: string | null;
  website?: string | null;
  logo_url?: string | null;
  description?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
  founded_year?: number | null;
  tech_stack?: string[] | null;
  tags?: string[] | null;
}

// Helper to capitalize words
function capitalizeWords(str: string): string {
  return str
    .split(/[\s\-_]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Type-safe supabase accessor for companies table (until migration is applied)
const db = supabase as any;

export function useCompanies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  // Fetch all companies with relation counts
  const fetchCompanies = useCallback(async () => {
    if (!workspace?.id) {
      setCompanies([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get companies
      const { data: companiesData, error: companiesError } = await db
        .from('companies')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('name', { ascending: true });

      if (companiesError) throw companiesError;

      // Get contact counts per company
      const { data: contactCounts } = await db
        .from('contacts')
        .select('company_id')
        .eq('workspace_id', workspace.id)
        .not('company_id', 'is', null);

      // Get deal counts and values per company
      const { data: dealData } = await db
        .from('deals')
        .select('company_id, value')
        .eq('workspace_id', workspace.id)
        .not('company_id', 'is', null);

      // Count contacts per company
      const contactCountMap: Record<string, number> = {};
      (contactCounts || []).forEach((c: any) => {
        contactCountMap[c.company_id] = (contactCountMap[c.company_id] || 0) + 1;
      });

      // Count deals and sum values per company
      const dealCountMap: Record<string, number> = {};
      const dealValueMap: Record<string, number> = {};
      (dealData || []).forEach((d: any) => {
        dealCountMap[d.company_id] = (dealCountMap[d.company_id] || 0) + 1;
        dealValueMap[d.company_id] = (dealValueMap[d.company_id] || 0) + (d.value || 0);
      });

      // Merge counts into companies
      const enrichedCompanies: Company[] = (companiesData || []).map((company: any) => ({
        ...company,
        contacts_count: contactCountMap[company.id] || 0,
        deals_count: dealCountMap[company.id] || 0,
        total_deal_value: dealValueMap[company.id] || 0,
      }));

      setCompanies(enrichedCompanies);
    } catch (err) {
      console.error('Error fetching companies:', err);
      setError('Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  // Get single company by ID
  const getCompanyById = useCallback(
    async (id: string): Promise<Company | null> => {
      if (!workspace?.id) return null;

      try {
        const { data, error: fetchError } = await db
          .from('companies')
          .select('*')
          .eq('id', id)
          .eq('workspace_id', workspace.id)
          .single();

        if (fetchError) throw fetchError;

        // Get contact count
        const { count: contactsCount } = await db
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .eq('company_id', id);

        // Get deals
        const { data: dealsData } = await db
          .from('deals')
          .select('id, value')
          .eq('company_id', id);

        return {
          ...data,
          contacts_count: contactsCount || 0,
          deals_count: dealsData?.length || 0,
          total_deal_value: dealsData?.reduce((sum: number, d: any) => sum + (d.value || 0), 0) || 0,
        } as Company;
      } catch (err) {
        console.error('Error fetching company:', err);
        return null;
      }
    },
    [workspace?.id]
  );

  // Create new company
  const addCompany = useCallback(
    async (input: CreateCompanyInput): Promise<Company | null> => {
      if (!workspace?.id) {
        toast({
          title: 'Error',
          description: 'No workspace selected',
          variant: 'destructive',
        });
        return null;
      }

      try {
        const { data, error: insertError } = await db
          .from('companies')
          .insert({
            workspace_id: workspace.id,
            ...input,
          })
          .select()
          .single();

        if (insertError) throw insertError;

        const newCompany: Company = { ...data, contacts_count: 0, deals_count: 0, total_deal_value: 0 };
        setCompanies((prev) => [...prev, newCompany]);

        toast({
          title: 'Company created',
          description: `${input.name} has been added`,
        });

        return newCompany;
      } catch (err: any) {
        console.error('Error creating company:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to create company',
          variant: 'destructive',
        });
        return null;
      }
    },
    [workspace?.id, toast]
  );

  // Update company
  const updateCompany = useCallback(
    async (id: string, updates: Partial<CreateCompanyInput>): Promise<boolean> => {
      try {
        const { error: updateError } = await db.from('companies').update(updates).eq('id', id);

        if (updateError) throw updateError;

        setCompanies((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...updates } : c))
        );

        toast({
          title: 'Company updated',
          description: 'Changes have been saved',
        });

        return true;
      } catch (err: any) {
        console.error('Error updating company:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to update company',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  // Delete company
  const deleteCompany = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const { error: deleteError } = await db.from('companies').delete().eq('id', id);

        if (deleteError) throw deleteError;

        setCompanies((prev) => prev.filter((c) => c.id !== id));

        toast({
          title: 'Company deleted',
          description: 'Company has been removed',
        });

        return true;
      } catch (err: any) {
        console.error('Error deleting company:', err);
        toast({
          title: 'Error',
          description: err.message || 'Failed to delete company',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast]
  );

  // Simulate enrichment (placeholder)
  const enrichCompany = useCallback(
    async (id: string): Promise<boolean> => {
      console.log('Enriching company:', id);
      console.log('This would call Clearbit API to fetch company data');

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Update enriched_at timestamp
      const { error: enrichError } = await db
        .from('companies')
        .update({ enriched_at: new Date().toISOString() })
        .eq('id', id);

      if (enrichError) {
        toast({
          title: 'Enrichment failed',
          description: 'Could not enrich company data',
          variant: 'destructive',
        });
        return false;
      }

      toast({
        title: 'Enrichment simulated',
        description: 'In production, this would fetch data from Clearbit',
      });

      return true;
    },
    [toast]
  );

  // Get contacts for a company
  const getCompanyContacts = useCallback(
    async (companyId: string) => {
      const { data, error: fetchError } = await db
        .from('contacts')
        .select('*')
        .eq('company_id', companyId)
        .order('name');

      if (fetchError) {
        console.error('Error fetching company contacts:', fetchError);
        return [];
      }

      return data || [];
    },
    []
  );

  // Get deals for a company
  const getCompanyDeals = useCallback(
    async (companyId: string) => {
      const { data, error: fetchError } = await db
        .from('deals')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        console.error('Error fetching company deals:', fetchError);
        return [];
      }

      return data || [];
    },
    []
  );

  // Find or create company by domain (auto-association)
  const findOrCreateByDomain = useCallback(
    async (domain: string, fallbackName?: string): Promise<Company | null> => {
      if (!workspace?.id || !domain) return null;

      // Normalize domain
      const normalizedDomain = domain.toLowerCase().trim();

      try {
        // Check if company with this domain exists
        const { data: existing, error: findError } = await db
          .from('companies')
          .select('*')
          .eq('workspace_id', workspace.id)
          .eq('domain', normalizedDomain)
          .single();

        if (existing && !findError) {
          return existing as Company;
        }

        // Create new company from domain
        const companyName = fallbackName || capitalizeWords(normalizedDomain.replace(/\.(com|io|co|org|net|ai)$/, ''));

        const { data: newCompany, error: createError } = await db
          .from('companies')
          .insert({
            workspace_id: workspace.id,
            name: companyName,
            domain: normalizedDomain,
            website: `https://${normalizedDomain}`,
            logo_url: `https://logo.clearbit.com/${normalizedDomain}`, // Clearbit logo API
          })
          .select()
          .single();

        if (createError) throw createError;

        // Add to local state
        const enrichedCompany: Company = { ...newCompany, contacts_count: 0, deals_count: 0, total_deal_value: 0 };
        setCompanies(prev => [...prev, enrichedCompany]);

        toast({
          title: 'Company auto-created',
          description: `${companyName} was automatically created from email domain`,
        });

        return enrichedCompany;
      } catch (err) {
        console.error('Error in findOrCreateByDomain:', err);
        return null;
      }
    },
    [workspace?.id, toast]
  );

  // Extract domain from email
  const extractDomainFromEmail = (email: string): string | null => {
    if (!email || !email.includes('@')) return null;

    const domain = email.split('@')[1].toLowerCase();

    // Skip common free email providers
    const freeProviders = [
      'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com',
      'icloud.com', 'aol.com', 'mail.com', 'protonmail.com',
      'zoho.com', 'yandex.com', 'live.com', 'msn.com'
    ];

    if (freeProviders.includes(domain)) {
      return null;
    }

    return domain;
  };

  // Auto-associate contact with company based on email
  const autoAssociateContact = useCallback(
    async (contactId: string, email: string): Promise<string | null> => {
      if (!workspace?.id) return null;

      const domain = extractDomainFromEmail(email);
      if (!domain) return null;

      const company = await findOrCreateByDomain(domain);
      if (!company) return null;

      // Update contact with company_id
      const { error: updateError } = await db
        .from('contacts')
        .update({ company_id: company.id })
        .eq('id', contactId);

      if (updateError) {
        console.error('Failed to associate contact with company:', updateError);
        return null;
      }

      return company.id;
    },
    [workspace?.id, findOrCreateByDomain]
  );

  // Link contact to company
  const linkContactToCompany = useCallback(
    async (contactId: string, companyId: string): Promise<boolean> => {
      try {
        const { error: updateError } = await db
          .from('contacts')
          .update({ company_id: companyId })
          .eq('id', contactId);

        if (updateError) throw updateError;

        toast({
          title: 'Contact linked',
          description: 'Contact has been linked to the company',
        });

        // Refresh companies to update counts
        fetchCompanies();
        return true;
      } catch (err) {
        console.error('Error linking contact:', err);
        toast({
          title: 'Error',
          description: 'Failed to link contact to company',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, fetchCompanies]
  );

  // Unlink contact from company
  const unlinkContactFromCompany = useCallback(
    async (contactId: string): Promise<boolean> => {
      try {
        const { error: updateError } = await db
          .from('contacts')
          .update({ company_id: null })
          .eq('id', contactId);

        if (updateError) throw updateError;

        toast({
          title: 'Contact unlinked',
          description: 'Contact has been removed from the company',
        });

        fetchCompanies();
        return true;
      } catch (err) {
        console.error('Error unlinking contact:', err);
        toast({
          title: 'Error',
          description: 'Failed to unlink contact',
          variant: 'destructive',
        });
        return false;
      }
    },
    [toast, fetchCompanies]
  );

  // Initial fetch
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  return {
    companies,
    loading,
    error,
    fetchCompanies,
    getCompanyById,
    addCompany,
    updateCompany,
    deleteCompany,
    enrichCompany,
    getCompanyContacts,
    getCompanyDeals,
    findOrCreateByDomain,
    extractDomainFromEmail,
    autoAssociateContact,
    linkContactToCompany,
    unlinkContactFromCompany,
  };
}

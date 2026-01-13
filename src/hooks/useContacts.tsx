import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { useToast } from './use-toast';

export interface Contact {
  id: string;
  name: string;
  first_name?: string | null;
  last_name?: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  avatar_url: string | null;
  status: string | null;
  linkedin_url?: string | null;
  lifecycle_stage?: 'lead' | 'mql' | 'sql' | 'opportunity' | 'customer' | 'churned' | null;
  lead_score?: number;
  email_verified?: boolean;
  phone_valid?: boolean;
  data_completeness?: number;
  custom_fields?: Record<string, any>;
  tags?: string[];
  notes?: string | null;
  last_activity_at?: string | null;
  created_at: string;
  updated_at?: string;
  workspace_id: string | null;
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const PAGE_SIZE = 50;
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  const fetchContacts = async (page: number = 1) => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (!workspace) {
      // Wait for workspace to load
      setLoading(true);
      return;
    }

    setLoading(true);
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[useContacts] Error fetching contacts:', error);
      toast({
        title: "Error fetching contacts",
        description: error.message,
        variant: "destructive",
      });
    } else {
      console.log('[useContacts] Fetched contacts:', data?.length || 0);
      setContacts(data || []);
      setTotalCount(count || 0);
      setCurrentPage(page);
    }
    setLoading(false);
  };

  useEffect(() => {
    console.log('[useContacts] Effect triggered - user:', !!user, 'workspace:', workspace?.id);
    if (user && workspace?.id) {
      fetchContacts();
    } else if (!user) {
      setContacts([]);
      setLoading(false);
    }
  }, [user, workspace?.id]);

  const addContact = async (contact: Omit<Contact, 'id' | 'created_at' | 'workspace_id'>) => {
    if (!user || !workspace) return;

    const { data, error } = await supabase
      .from('contacts')
      .insert([{ ...contact, user_id: user.id, workspace_id: workspace.id }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error adding contact",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Contact added",
      description: `${contact.name} has been added to your contacts.`,
    });
    
    setContacts(prev => [data, ...prev]);
    return data;
  };

  const updateContact = async (id: string, updates: Partial<Contact>) => {
    const { data, error } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Error updating contact",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    setContacts(prev => prev.map(c => c.id === id ? data : c));
    return data;
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting contact",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Contact deleted",
      description: "The contact has been removed.",
    });

    setContacts(prev => prev.filter(c => c.id !== id));
    return true;
  };

  const getContactById = async (id: string): Promise<Contact | null> => {
    if (!workspace) return null;

    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .single();

    if (error) {
      console.error('[useContacts] Error fetching contact:', error);
      toast({
        title: "Error fetching contact",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    return data;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return {
    contacts,
    loading,
    currentPage,
    totalCount,
    totalPages,
    PAGE_SIZE,
    fetchContacts,
    addContact,
    updateContact,
    deleteContact,
    getContactById,
  };
}
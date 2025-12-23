import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { useToast } from './use-toast';

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  avatar_url: string | null;
  status: string | null;
  created_at: string;
  workspace_id: string | null;
}

export function useContacts() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  const fetchContacts = async () => {
    if (!user || !workspace) return;
    
    setLoading(true);
    const { data, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching contacts",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setContacts(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchContacts();
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

  return { contacts, loading, fetchContacts, addContact, updateContact, deleteContact };
}
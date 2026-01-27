import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { useToast } from './use-toast';

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  due_date: string | null;
  related_deal_id: string | null;
  related_contact_id: string | null;
  related_lead_id?: string | null;
  created_at: string;
  workspace_id: string | null;
}

export function useTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  const fetchTasks = async () => {
    if (!user || !workspace) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('due_date', { ascending: true });

    if (error) {
      toast({
        title: "Error fetching tasks",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setTasks(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user && workspace?.id) {
      fetchTasks();
    } else {
      setTasks([]);
      setLoading(false);
    }
  }, [user, workspace?.id]);

  const addTask = async (task: Omit<Task, 'id' | 'created_at' | 'workspace_id' | 'related_lead_id'> & { related_lead_id?: string | null }) => {
    if (!user || !workspace) return;

    const { data, error } = await supabase
      .from('tasks')
      .insert([{ ...task, user_id: user.id, workspace_id: workspace.id }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error adding task",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Task added",
      description: `"${task.title}" has been added.`,
    });
    
    setTasks(prev => [data, ...prev]);
    return data;
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    const { data, error } = await supabase
      .from('tasks')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Error updating task",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    setTasks(prev => prev.map(t => t.id === id ? data : t));
    return data;
  };

  const deleteTask = async (id: string) => {
    const { error } = await supabase
      .from('tasks')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting task",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Task deleted",
      description: "The task has been removed.",
    });
    
    setTasks(prev => prev.filter(t => t.id !== id));
    return true;
  };

  return { tasks, loading, fetchTasks, addTask, updateTask, deleteTask };
}
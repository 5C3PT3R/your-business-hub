import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Workflow, WorkflowExecution, WorkflowNode, WorkflowEdge, WorkflowStatus, TriggerType } from '@/types/workflows';

export function useWorkflows() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { workspace } = useWorkspace();

  const fetchWorkflows = useCallback(async () => {
    if (!workspace?.id) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('workflows')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('is_template', false)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setWorkflows((data as Workflow[]) || []);
    } catch (err: any) {
      console.error('Error fetching workflows:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const addWorkflow = async (workflow: {
    name: string;
    description?: string;
    trigger_type: TriggerType;
    nodes?: WorkflowNode[];
    edges?: WorkflowEdge[];
  }): Promise<Workflow | null> => {
    if (!workspace?.id) return null;

    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error: insertError } = await supabase
        .from('workflows')
        .insert([{
          user_id: userData.user.id,
          workspace_id: workspace.id,
          name: workflow.name,
          description: workflow.description || null,
          trigger_type: workflow.trigger_type,
          nodes: workflow.nodes || [],
          edges: workflow.edges || [],
          status: 'draft',
        }])
        .select()
        .single();

      if (insertError) throw insertError;

      const newWorkflow = data as Workflow;
      setWorkflows(prev => [newWorkflow, ...prev]);
      return newWorkflow;
    } catch (err: any) {
      console.error('Error adding workflow:', err);
      setError(err.message);
      return null;
    }
  };

  const updateWorkflow = async (
    id: string,
    updates: Partial<Pick<Workflow, 'name' | 'description' | 'status' | 'nodes' | 'edges' | 'trigger_type'>>
  ): Promise<boolean> => {
    try {
      const { error: updateError } = await supabase
        .from('workflows')
        .update(updates)
        .eq('id', id);

      if (updateError) throw updateError;

      setWorkflows(prev =>
        prev.map(w => (w.id === id ? { ...w, ...updates } : w))
      );
      return true;
    } catch (err: any) {
      console.error('Error updating workflow:', err);
      setError(err.message);
      return false;
    }
  };

  const deleteWorkflow = async (id: string): Promise<boolean> => {
    try {
      const { error: deleteError } = await supabase
        .from('workflows')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      setWorkflows(prev => prev.filter(w => w.id !== id));
      return true;
    } catch (err: any) {
      console.error('Error deleting workflow:', err);
      setError(err.message);
      return false;
    }
  };

  const toggleWorkflowStatus = async (id: string): Promise<boolean> => {
    const workflow = workflows.find(w => w.id === id);
    if (!workflow) return false;

    const newStatus: WorkflowStatus = workflow.status === 'active' ? 'paused' : 'active';
    return updateWorkflow(id, { status: newStatus });
  };

  const duplicateWorkflow = async (id: string): Promise<Workflow | null> => {
    const workflow = workflows.find(w => w.id === id);
    if (!workflow) return null;

    return addWorkflow({
      name: `${workflow.name} (Copy)`,
      description: workflow.description || undefined,
      trigger_type: workflow.trigger_type,
      nodes: workflow.nodes,
      edges: workflow.edges,
    });
  };

  const getWorkflowById = async (id: string): Promise<Workflow | null> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      return data as Workflow;
    } catch (err: any) {
      console.error('Error fetching workflow:', err);
      return null;
    }
  };

  const getWorkflowExecutions = async (workflowId: string): Promise<WorkflowExecution[]> => {
    try {
      const { data, error: fetchError } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('workflow_id', workflowId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      return (data as WorkflowExecution[]) || [];
    } catch (err: any) {
      console.error('Error fetching executions:', err);
      return [];
    }
  };

  // Stats for the sidebar/dashboard
  const stats = {
    total: workflows.length,
    active: workflows.filter(w => w.status === 'active').length,
    paused: workflows.filter(w => w.status === 'paused').length,
    draft: workflows.filter(w => w.status === 'draft').length,
    totalExecutions: workflows.reduce((sum, w) => sum + w.total_executions, 0),
  };

  return {
    workflows,
    loading,
    error,
    stats,
    fetchWorkflows,
    addWorkflow,
    updateWorkflow,
    deleteWorkflow,
    toggleWorkflowStatus,
    duplicateWorkflow,
    getWorkflowById,
    getWorkflowExecutions,
  };
}

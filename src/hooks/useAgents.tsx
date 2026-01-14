import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspace } from './useWorkspace';
import { useToast } from './use-toast';
import { Agent, AgentExecution, AgentConfig, AgentType, ScheduleType, DEFAULT_AGENT_CONFIG } from '@/types/agents';

export function useAgents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  // Fetch all agents for the current workspace
  const fetchAgents = useCallback(async () => {
    if (!user || !workspace) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('workspace_id', workspace.id)
      .eq('is_template', false)
      .order('created_at', { ascending: false });

    if (error) {
      toast({
        title: "Error fetching agents",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setAgents((data as Agent[]) || []);
    }
    setLoading(false);
  }, [user, workspace, toast]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Add a new agent
  const addAgent = async (agent: Omit<Agent, 'id' | 'created_at' | 'updated_at' | 'workspace_id' | 'user_id' | 'total_executions' | 'successful_executions' | 'failed_executions' | 'is_template'>) => {
    if (!user || !workspace) return null;

    const { data, error } = await supabase
      .from('agents')
      .insert([{
        ...agent,
        user_id: user.id,
        workspace_id: workspace.id,
        is_template: false
      }])
      .select()
      .single();

    if (error) {
      toast({
        title: "Error creating agent",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Agent created",
      description: `${agent.name} has been created successfully.`,
    });

    setAgents(prev => [(data as Agent), ...prev]);
    return data as Agent;
  };

  // Update an existing agent
  const updateAgent = async (id: string, updates: Partial<Agent>) => {
    const { data, error } = await supabase
      .from('agents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      toast({
        title: "Error updating agent",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    toast({
      title: "Agent updated",
      description: "The agent has been updated successfully.",
    });

    setAgents(prev => prev.map(a => a.id === id ? (data as Agent) : a));
    return data as Agent;
  };

  // Delete an agent
  const deleteAgent = async (id: string) => {
    const { error } = await supabase
      .from('agents')
      .delete()
      .eq('id', id);

    if (error) {
      toast({
        title: "Error deleting agent",
        description: error.message,
        variant: "destructive",
      });
      return false;
    }

    toast({
      title: "Agent deleted",
      description: "The agent has been removed successfully.",
    });

    setAgents(prev => prev.filter(a => a.id !== id));
    return true;
  };

  // Get a single agent by ID
  const getAgentById = async (id: string): Promise<Agent | null> => {
    if (!workspace) return null;

    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      toast({
        title: "Error fetching agent",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }

    return data as Agent | null;
  };

  // Execute an agent manually
  const executeAgent = async (agentId: string): Promise<AgentExecution | null> => {
    if (!workspace) return null;

    // Create execution record
    const { data: execution, error: execError } = await supabase
      .from('agent_executions')
      .insert([{
        agent_id: agentId,
        workspace_id: workspace.id,
        status: 'running',
        trigger_type: 'manual',
        started_at: new Date().toISOString(),
      }])
      .select()
      .single();

    if (execError) {
      toast({
        title: "Failed to start execution",
        description: execError.message,
        variant: "destructive",
      });
      return null;
    }

    // Update agent's last_run_at and total_executions
    await supabase
      .from('agents')
      .update({
        last_run_at: new Date().toISOString(),
        total_executions: supabase.sql`total_executions + 1`
      })
      .eq('id', agentId);

    toast({
      title: "Agent execution started",
      description: "The agent is now processing. Check the logs for results.",
    });

    // Refresh agents list
    fetchAgents();

    return execution as AgentExecution;
  };

  // Toggle agent status (active <-> paused)
  const toggleAgentStatus = async (id: string) => {
    const agent = agents.find(a => a.id === id);
    if (!agent) return null;

    const newStatus = agent.status === 'active' ? 'paused' : 'active';
    const statusLabel = newStatus === 'active' ? 'activated' : 'paused';

    const result = await updateAgent(id, { status: newStatus });

    if (result) {
      toast({
        title: `Agent ${statusLabel}`,
        description: `${agent.name} has been ${statusLabel}.`,
      });
    }

    return result;
  };

  // Get execution logs for an agent
  const getExecutionLogs = async (agentId: string): Promise<AgentExecution[]> => {
    const { data, error } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      toast({
        title: "Error fetching logs",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }

    return (data as AgentExecution[]) || [];
  };

  // Fetch template agents
  const fetchTemplates = async (): Promise<Agent[]> => {
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('is_template', true)
      .order('agent_type');

    if (error) {
      toast({
        title: "Error fetching templates",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }

    return (data as Agent[]) || [];
  };

  // Create an agent from a template
  const createFromTemplate = async (templateId: string, overrides?: { name?: string; description?: string }) => {
    const template = await getAgentById(templateId);
    if (!template) {
      toast({
        title: "Template not found",
        description: "The selected template could not be found.",
        variant: "destructive",
      });
      return null;
    }

    // Create new agent from template
    const newAgent = await addAgent({
      name: overrides?.name || `${template.name} Copy`,
      description: overrides?.description || template.description,
      agent_type: template.agent_type,
      status: 'inactive',
      config: template.config,
      schedule_type: 'manual',
      schedule_config: {},
      last_run_at: null,
      next_run_at: null,
    });

    if (newAgent) {
      toast({
        title: "Agent created from template",
        description: `${newAgent.name} has been created. Configure it to get started.`,
      });
    }

    return newAgent;
  };

  // Get success rate for an agent
  const getSuccessRate = (agent: Agent): number => {
    if (agent.total_executions === 0) return 0;
    return Math.round((agent.successful_executions / agent.total_executions) * 100);
  };

  return {
    agents,
    loading,
    fetchAgents,
    addAgent,
    updateAgent,
    deleteAgent,
    getAgentById,
    executeAgent,
    toggleAgentStatus,
    getExecutionLogs,
    fetchTemplates,
    createFromTemplate,
    getSuccessRate,
  };
}

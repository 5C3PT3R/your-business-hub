import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from './useWorkspace';
import { useLeads } from './useLeads';
import { useContacts } from './useContacts';
import { useDeals } from './useDeals';
import { useTasks } from './useTasks';
import { useToast } from './use-toast';
import { AgentResponse, PlannedAction, industryActions } from '@/types/agent';

export interface ParsedFileData {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

export function useAgent() {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AgentResponse | null>(null);
  const [executedActions, setExecutedActions] = useState<string[]>([]);
  
  const { workspace } = useWorkspace();
  const { leads, addLead, updateLead, deleteLead } = useLeads();
  const { contacts, addContact, updateContact, deleteContact } = useContacts();
  const { deals, addDeal, updateDeal, deleteDeal } = useDeals();
  const { tasks, addTask, updateTask, deleteTask } = useTasks();
  const { toast } = useToast();

  const sendInstruction = useCallback(async (instruction: string, fileData?: ParsedFileData) => {
    if (!workspace) {
      toast({
        title: "No workspace selected",
        description: "Please select a workspace first.",
        variant: "destructive",
      });
      return null;
    }

    setIsLoading(true);
    setResponse(null);
    setExecutedActions([]);

    try {
      const industryType = workspace.industry_type;
      const allowedActions = industryActions[industryType] || industryActions.sales;

      const context: Record<string, any> = {
        leads: leads.slice(0, 10),
        contacts: contacts.slice(0, 10),
        deals: deals.slice(0, 10),
        tasks: tasks.slice(0, 10),
      };

      // Include file data if provided
      if (fileData) {
        context.uploadedFile = {
          fileName: fileData.fileName,
          headers: fileData.headers,
          sampleRows: fileData.rows.slice(0, 5), // Send first 5 rows as sample
          totalRows: fileData.totalRows,
        };
      }

      const { data, error } = await supabase.functions.invoke('crm-agent', {
        body: {
          instruction,
          workspaceId: workspace.id,
          industryType,
          context,
          allowedActions,
          fileData: fileData ? {
            headers: fileData.headers,
            rows: fileData.rows,
          } : undefined,
        },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setResponse(data as AgentResponse);
      return data as AgentResponse;

    } catch (error) {
      console.error('Agent error:', error);
      toast({
        title: "Agent Error",
        description: error instanceof Error ? error.message : "Failed to process instruction",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [workspace, leads, contacts, deals, tasks, toast]);

  const executeAction = useCallback(async (action: PlannedAction) => {
    try {
      // Execute based on action type
      switch (action.action) {
        case 'create_lead':
          await addLead({
            name: action.params?.name || 'New Lead',
            email: action.params?.email || null,
            phone: action.params?.phone || null,
            company: action.params?.company || null,
            source: action.params?.source || null,
            status: 'new',
            value: action.params?.value || 0,
          });
          break;

        case 'update_lead':
          if (action.record_id) {
            await updateLead(action.record_id, action.params || {});
          }
          break;

        case 'qualify_lead':
          if (action.record_id) {
            await updateLead(action.record_id, { status: 'qualified' });
          }
          break;

        case 'create_contact':
          await addContact({
            name: action.params?.name || 'New Contact',
            email: action.params?.email || null,
            phone: action.params?.phone || null,
            company: action.params?.company || null,
            position: action.params?.position || null,
            avatar_url: null,
            status: 'active',
          });
          break;

        case 'update_contact':
          if (action.record_id) {
            await updateContact(action.record_id, action.params || {});
          }
          break;

        case 'create_deal':
          await addDeal({
            title: action.params?.title || 'New Deal',
            value: action.params?.value || 0,
            stage: 'discovery',
            company: action.params?.company || null,
            contact_id: action.params?.contact_id || null,
            expected_close_date: action.params?.expected_close_date || null,
            probability: action.params?.probability || 0,
          });
          break;

        case 'update_deal_stage':
          if (action.record_id && action.params?.stage) {
            await updateDeal(action.record_id, { stage: action.params.stage });
          }
          break;

        case 'create_task':
          await addTask({
            title: action.params?.title || 'New Task',
            description: action.params?.description || null,
            priority: action.params?.priority || 'medium',
            status: 'pending',
            due_date: action.params?.due_date || null,
            related_deal_id: action.params?.deal_id || null,
            related_contact_id: action.params?.contact_id || null,
          });
          break;

        case 'complete_task':
          if (action.record_id) {
            await updateTask(action.record_id, { status: 'completed' });
          }
          break;

        case 'bulk_create_leads':
          if (action.params?.items && Array.isArray(action.params.items)) {
            for (const item of action.params.items) {
              await addLead({
                name: item.name || 'Imported Lead',
                email: item.email || null,
                phone: item.phone || null,
                company: item.company || null,
                source: 'import',
                status: 'new',
                value: item.value || 0,
              });
            }
          }
          break;

        case 'bulk_create_contacts':
          if (action.params?.items && Array.isArray(action.params.items)) {
            for (const item of action.params.items) {
              await addContact({
                name: item.name || 'Imported Contact',
                email: item.email || null,
                phone: item.phone || null,
                company: item.company || null,
                position: item.position || null,
                avatar_url: null,
                status: 'active',
              });
            }
          }
          break;

        default:
          console.log('Action not implemented:', action.action);
          toast({
            title: "Action Simulated",
            description: `${action.action} would be executed here.`,
          });
      }

      setExecutedActions(prev => [...prev, action.action]);
      
      toast({
        title: "Action Executed",
        description: `Successfully executed: ${action.action}`,
      });

      return true;
    } catch (error) {
      console.error('Action execution error:', error);
      toast({
        title: "Execution Failed",
        description: error instanceof Error ? error.message : "Failed to execute action",
        variant: "destructive",
      });
      return false;
    }
  }, [addLead, updateLead, addContact, updateContact, addDeal, updateDeal, addTask, updateTask, toast]);

  const executeAllApproved = useCallback(async (actions: PlannedAction[]) => {
    const results = [];
    for (const action of actions) {
      if (!action.requires_approval || action.confidence >= 0.85) {
        const result = await executeAction(action);
        results.push({ action: action.action, success: result });
      }
    }
    return results;
  }, [executeAction]);

  const clearResponse = useCallback(() => {
    setResponse(null);
    setExecutedActions([]);
  }, []);

  return {
    isLoading,
    response,
    executedActions,
    sendInstruction,
    executeAction,
    executeAllApproved,
    clearResponse,
  };
}

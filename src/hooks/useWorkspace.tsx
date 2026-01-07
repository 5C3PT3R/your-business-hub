import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { IndustryType, getIndustryTemplate, IndustryTemplate } from '@/config/industryTemplates';

interface Workspace {
  id: string;
  name: string;
  industry_type: IndustryType;
  owner_id: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface WorkspaceContextType {
  workspace: Workspace | null;
  workspaces: Workspace[];
  loading: boolean;
  hasWorkspace: boolean;
  template: IndustryTemplate | null;
  createWorkspace: (name: string, industryType: IndustryType) => Promise<{ error: Error | null }>;
  switchWorkspace: (workspaceId: string) => void;
  refetch: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = async () => {
    if (!user) {
      console.log('[useWorkspace] No user, clearing workspaces');
      setWorkspaces([]);
      setWorkspace(null);
      setLoading(false);
      return;
    }

    console.log('[useWorkspace] Fetching workspaces for user:', user.id);

    try {
      // Fetch workspaces where user is owner or member
      const { data: memberWorkspaces, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id);

      if (memberError) {
        console.error('[useWorkspace] Error fetching workspace members:', memberError);
        throw memberError;
      }

      console.log('[useWorkspace] Member workspaces:', memberWorkspaces);

      const memberWorkspaceIds = memberWorkspaces?.map(m => m.workspace_id) || [];

      let allWorkspaces = [];
      
      if (memberWorkspaceIds.length > 0) {
        const { data, error } = await supabase
          .from('workspaces')
          .select('*')
          .or(`owner_id.eq.${user.id},id.in.(${memberWorkspaceIds.join(',')})`);
        
        if (error) throw error;
        allWorkspaces = data || [];
      } else {
        const { data, error } = await supabase
          .from('workspaces')
          .select('*')
          .eq('owner_id', user.id);
        
        if (error) throw error;
        allWorkspaces = data || [];
      }

      const typedWorkspaces = (allWorkspaces || []).map(w => ({
        ...w,
        industry_type: w.industry_type as IndustryType,
        config: (w.config || {}) as Record<string, unknown>,
      }));

      setWorkspaces(typedWorkspaces);
      console.log('[useWorkspace] Found workspaces:', typedWorkspaces.length);

      // Auto-select first workspace or from localStorage
      const savedWorkspaceId = localStorage.getItem('current_workspace_id');
      const savedWorkspace = typedWorkspaces.find(w => w.id === savedWorkspaceId);

      if (savedWorkspace) {
        console.log('[useWorkspace] Setting saved workspace:', savedWorkspaceId);
        setWorkspace(savedWorkspace);
      } else if (typedWorkspaces.length > 0) {
        console.log('[useWorkspace] Setting first workspace:', typedWorkspaces[0].id);
        setWorkspace(typedWorkspaces[0]);
        localStorage.setItem('current_workspace_id', typedWorkspaces[0].id);
      } else {
        console.log('[useWorkspace] No workspaces found');
      }
    } catch (error) {
      console.error('[useWorkspace] Error fetching workspaces:', error);
    } finally {
      console.log('[useWorkspace] Fetch complete, setting loading to false');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  const createWorkspace = async (name: string, industryType: IndustryType) => {
    if (!user) {
      console.error('[useWorkspace] Cannot create workspace: No user');
      return { error: new Error('User not authenticated') };
    }

    console.log('[useWorkspace] Creating workspace:', { name, industryType, userId: user.id });

    try {
      const template = getIndustryTemplate(industryType);
      console.log('[useWorkspace] Using template:', template);

      const { data: newWorkspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name,
          industry_type: industryType,
          owner_id: user.id,
          config: {
            enabled_modules: template.enabledModules,
            pipelines: template.pipelines,
            ui_labels: template.uiLabels,
            dashboard_widgets: template.dashboardWidgets,
          },
        })
        .select()
        .single();

      if (workspaceError) {
        console.error('[useWorkspace] Workspace creation error:', workspaceError);
        throw workspaceError;
      }

      console.log('[useWorkspace] Workspace created:', newWorkspace.id);

      // Add owner as a member
      console.log('[useWorkspace] Adding owner as member');
      const { error: memberError } = await supabase
        .from('workspace_members')
        .insert({
          workspace_id: newWorkspace.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) {
        console.error('[useWorkspace] Member creation error:', memberError);
        throw memberError;
      }

      console.log('[useWorkspace] Member added successfully');

      const typedWorkspace = {
        ...newWorkspace,
        industry_type: newWorkspace.industry_type as IndustryType,
        config: (newWorkspace.config || {}) as Record<string, unknown>,
      };

      setWorkspace(typedWorkspace);
      setWorkspaces(prev => [...prev, typedWorkspace]);
      localStorage.setItem('current_workspace_id', newWorkspace.id);

      return { error: null };
    } catch (error) {
      console.error('Error creating workspace:', error);
      return { error: error as Error };
    }
  };

  const switchWorkspace = (workspaceId: string) => {
    const targetWorkspace = workspaces.find(w => w.id === workspaceId);
    if (targetWorkspace) {
      setWorkspace(targetWorkspace);
      localStorage.setItem('current_workspace_id', workspaceId);
    }
  };

  const template = workspace ? getIndustryTemplate(workspace.industry_type) : null;

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,
        workspaces,
        loading,
        hasWorkspace: workspaces.length > 0,
        template,
        createWorkspace,
        switchWorkspace,
        refetch: fetchWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}

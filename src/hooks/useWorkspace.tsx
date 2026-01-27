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
      setWorkspaces([]);
      setWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log('[useWorkspace] Fetching workspaces for user:', user.id);

    const QUERY_TIMEOUT = 8000; // 8 seconds

    try {
      // Try to get from localStorage first for immediate display
      const cachedWorkspaceData = localStorage.getItem('cached_workspace_data');
      const savedWorkspaceId = localStorage.getItem('current_workspace_id');
      let cachedWorkspace: Workspace | null = null;

      if (cachedWorkspaceData) {
        try {
          const parsed = JSON.parse(cachedWorkspaceData);
          // Verify it belongs to current user
          if (parsed.owner_id === user.id) {
            cachedWorkspace = {
              ...parsed,
              industry_type: parsed.industry_type as IndustryType,
              config: (parsed.config || {}) as Record<string, unknown>,
            };
            console.log('[useWorkspace] Found cached workspace:', cachedWorkspace.id);
          }
        } catch {
          console.warn('[useWorkspace] Failed to parse cached workspace');
        }
      }

      // Race the DB query against a timeout
      const queryPromise = supabase
        .from('workspaces')
        .select('*')
        .eq('owner_id', user.id);

      const timeoutPromise = new Promise<{ data: null; error: { message: string } }>((resolve) => {
        setTimeout(() => resolve({ data: null, error: { message: 'Query timeout' } }), QUERY_TIMEOUT);
      });

      const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

      if (error) {
        console.warn('[useWorkspace] Query error/timeout:', error.message);

        // Fallback to cached workspace if DB failed
        if (cachedWorkspace) {
          console.log('[useWorkspace] Using cached workspace due to DB error');
          setWorkspaces([cachedWorkspace]);
          setWorkspace(cachedWorkspace);
          setLoading(false);
          return;
        }

        // No cache available - check if we have a workspace ID at least
        if (savedWorkspaceId) {
          console.log('[useWorkspace] Creating minimal workspace from localStorage ID');
          const minimalWorkspace: Workspace = {
            id: savedWorkspaceId,
            name: 'Your Workspace',
            industry_type: 'sales' as IndustryType,
            owner_id: user.id,
            config: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          setWorkspaces([minimalWorkspace]);
          setWorkspace(minimalWorkspace);
          setLoading(false);
          return;
        }

        // No fallback available
        setWorkspaces([]);
        setWorkspace(null);
        setLoading(false);
        return;
      }

      console.log('[useWorkspace] Query returned:', data?.length || 0, 'workspaces');

      const typedWorkspaces = (data || []).map(w => ({
        ...w,
        industry_type: w.industry_type as IndustryType,
        config: (w.config || {}) as Record<string, unknown>,
      }));

      setWorkspaces(typedWorkspaces);

      // Auto-select workspace from localStorage or first available
      const savedWorkspace = typedWorkspaces.find(w => w.id === savedWorkspaceId);

      if (savedWorkspace) {
        setWorkspace(savedWorkspace);
        // Update cache with fresh data
        localStorage.setItem('cached_workspace_data', JSON.stringify(savedWorkspace));
      } else if (typedWorkspaces.length > 0) {
        setWorkspace(typedWorkspaces[0]);
        localStorage.setItem('current_workspace_id', typedWorkspaces[0].id);
        localStorage.setItem('cached_workspace_data', JSON.stringify(typedWorkspaces[0]));
      } else {
        setWorkspace(null);
      }

      setLoading(false);
    } catch (err) {
      console.error('[useWorkspace] Fetch error:', err);

      // Try localStorage fallback on any error
      const cachedWorkspaceData = localStorage.getItem('cached_workspace_data');
      if (cachedWorkspaceData) {
        try {
          const parsed = JSON.parse(cachedWorkspaceData);
          if (parsed.owner_id === user.id) {
            const cachedWorkspace = {
              ...parsed,
              industry_type: parsed.industry_type as IndustryType,
              config: (parsed.config || {}) as Record<string, unknown>,
            };
            console.log('[useWorkspace] Using cached workspace after error');
            setWorkspaces([cachedWorkspace]);
            setWorkspace(cachedWorkspace);
            setLoading(false);
            return;
          }
        } catch {
          // Ignore parse errors
        }
      }

      setWorkspaces([]);
      setWorkspace(null);
      setLoading(false);
    }
  };

  // Fetch when user changes
  useEffect(() => {
    fetchWorkspaces();
  }, [user?.id]);

  const createWorkspace = async (name: string, industryType: IndustryType) => {
    if (!user) {
      return { error: new Error('User not authenticated') };
    }

    try {
      const template = getIndustryTemplate(industryType);

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
        throw workspaceError;
      }

      // Add owner as a member
      await supabase
        .from('workspace_members')
        .insert({
          workspace_id: newWorkspace.id,
          user_id: user.id,
          role: 'owner',
        });

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

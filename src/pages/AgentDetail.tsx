/**
 * Agent Detail Page - View and configure AI Agent
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Bot,
  ArrowLeft,
  Settings,
  Play,
  Pause,
  Trash2,
  Activity,
  Clock,
  CheckCircle2,
  XCircle,
  Calendar,
  TrendingUp,
  Zap,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAgents } from '@/hooks/useAgents';
import { AgentConfigSheet } from '@/components/agents/AgentConfigSheet';
import { Agent, AgentConfig, getAgentTypeLabel, getAgentTypeDescription } from '@/types/agents';
import { cn } from '@/lib/utils';

// Mock execution history
const mockExecutions = [
  {
    id: '1',
    started_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
    status: 'completed',
    actions_taken: 3,
    trigger: 'new_lead',
    summary: 'Qualified lead and sent welcome email',
  },
  {
    id: '2',
    started_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 118).toISOString(),
    status: 'completed',
    actions_taken: 2,
    trigger: 'email_received',
    summary: 'Analyzed email sentiment, created follow-up task',
  },
  {
    id: '3',
    started_at: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 179).toISOString(),
    status: 'failed',
    actions_taken: 0,
    trigger: 'deal_stage_changed',
    summary: 'Failed: Missing contact email',
  },
  {
    id: '4',
    started_at: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
    completed_at: new Date(Date.now() - 1000 * 60 * 298).toISOString(),
    status: 'completed',
    actions_taken: 5,
    trigger: 'new_lead',
    summary: 'Qualified lead, enriched data, assigned owner',
  },
];

export default function AgentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { agents, loading, toggleAgentStatus, updateAgent, deleteAgent } = useAgents();

  const [agent, setAgent] = useState<Agent | null>(null);
  const [showConfigSheet, setShowConfigSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isRunning, setIsRunning] = useState(false);

  // Find agent from list
  useEffect(() => {
    if (!loading && id) {
      const found = agents.find((a) => a.id === id);
      setAgent(found || null);
    }
  }, [agents, loading, id]);

  // Handle run agent manually
  const handleRunAgent = async () => {
    if (!agent) return;
    setIsRunning(true);
    // Simulate running
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsRunning(false);
  };

  // Handle save config
  const handleSaveConfig = async (config: Partial<AgentConfig> & { isActive?: boolean; triggers?: string[] }) => {
    if (!agent) return;

    const { isActive, triggers, ...configUpdates } = config;

    // Update agent
    await updateAgent(agent.id, {
      config: {
        ...(agent.config as AgentConfig),
        ...configUpdates,
        triggers: triggers || (agent.config as AgentConfig)?.triggers || [],
      },
      status: isActive ? 'active' : 'inactive',
    });

    // Refresh agent
    const updated = agents.find((a) => a.id === agent.id);
    if (updated) setAgent(updated);
  };

  // Handle delete
  const handleDelete = async () => {
    if (!agent) return;
    const success = await deleteAgent(agent.id);
    if (success) {
      navigate('/agents');
    }
  };

  // Handle toggle status
  const handleToggleStatus = async () => {
    if (!agent) return;
    await toggleAgentStatus(agent.id);
    // Refresh
    const updated = agents.find((a) => a.id === agent.id);
    if (updated) setAgent({ ...updated, status: updated.status === 'active' ? 'inactive' : 'active' });
  };

  // Format relative time
  const formatRelativeTime = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!agent) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-screen">
          <Bot className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Agent not found</h2>
          <Button onClick={() => navigate('/agents')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Agents
          </Button>
        </div>
      </MainLayout>
    );
  }

  const config = agent.config as AgentConfig;
  const successRate = 75; // Mock
  const totalRuns = mockExecutions.length;
  const successfulRuns = mockExecutions.filter((e) => e.status === 'completed').length;

  return (
    <MainLayout>
      <div className="p-6 space-y-6 max-w-[1200px] mx-auto">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/agents')} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Agents
        </Button>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-8 w-8 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold">{agent.name}</h1>
                <Badge
                  variant={agent.status === 'active' ? 'default' : 'secondary'}
                  className={cn(
                    agent.status === 'active' && 'bg-emerald-500 hover:bg-emerald-600'
                  )}
                >
                  {agent.status === 'active' ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <p className="text-muted-foreground">{getAgentTypeLabel(agent.agent_type)}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {getAgentTypeDescription(agent.agent_type)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleRunAgent}
              disabled={isRunning || agent.status !== 'active'}
            >
              {isRunning ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Run Now
            </Button>
            <Button variant="outline" onClick={() => setShowConfigSheet(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Configure
            </Button>
            <Button
              variant={agent.status === 'active' ? 'destructive' : 'default'}
              onClick={handleToggleStatus}
            >
              {agent.status === 'active' ? (
                <>
                  <Pause className="h-4 w-4 mr-2" />
                  Deactivate
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Activate
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Activity className="h-4 w-4" />
                <span className="text-sm">Total Runs</span>
              </div>
              <p className="text-2xl font-bold mt-1">{totalRuns}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                <span className="text-sm">Success Rate</span>
              </div>
              <p className="text-2xl font-bold mt-1">{successRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Zap className="h-4 w-4" />
                <span className="text-sm">Actions Taken</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {mockExecutions.reduce((sum, e) => sum + e.actions_taken, 0)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Last Run</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {agent.last_run_at ? formatRelativeTime(agent.last_run_at) : 'Never'}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuration</CardTitle>
            <CardDescription>Current agent settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Tone</p>
                <p className="font-medium capitalize">{config?.tone || 'Professional'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Active Triggers</p>
                <p className="font-medium">{config?.triggers?.length || 0} configured</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Rules</p>
                <p className="font-medium">{config?.rules?.length || 0} rules</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Knowledge Base</p>
                <p className="font-medium">{config?.knowledgeBase?.length || 0} files</p>
              </div>
            </div>

            {config?.triggers && config.triggers.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Active Triggers</p>
                <div className="flex flex-wrap gap-2">
                  {config.triggers.map((trigger) => (
                    <Badge key={trigger} variant="secondary">
                      {trigger.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Execution History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Execution History</CardTitle>
            <CardDescription>Recent agent runs and their outcomes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>Actions</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockExecutions.map((execution) => (
                  <TableRow key={execution.id}>
                    <TableCell>
                      {execution.status === 'completed' ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">
                        {execution.trigger.replace(/_/g, ' ')}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="text-sm truncate">{execution.summary}</p>
                    </TableCell>
                    <TableCell>{execution.actions_taken}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatRelativeTime(execution.started_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Delete Agent</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete this agent and all its execution history.
                </p>
              </div>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Agent
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Config Sheet */}
        <AgentConfigSheet
          open={showConfigSheet}
          onOpenChange={setShowConfigSheet}
          agent={agent}
          onSave={handleSaveConfig}
        />

        {/* Delete Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Agent</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{agent.name}"? This action cannot be undone and
                will also delete all execution history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}

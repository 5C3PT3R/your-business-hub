import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Bot, Loader2 } from 'lucide-react';
import { useAgents } from '@/hooks/useAgents';
import { AgentCard } from '@/components/agents/AgentCard';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Agent, AgentType, DEFAULT_AGENT_CONFIG, getAgentTypeLabel, getAgentTypeDescription } from '@/types/agents';
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

const agentTypes: AgentType[] = [
  'receptionist',
  'sdr',
  'deal_analyst',
  'marketing_analyst',
  'follow_up',
  'coach',
];

export default function Agents() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'scratch' | 'template'>('template');
  const [templates, setTemplates] = useState<Agent[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [deleteConfirmAgent, setDeleteConfirmAgent] = useState<Agent | null>(null);

  const {
    agents,
    loading,
    addAgent,
    toggleAgentStatus,
    deleteAgent,
    fetchTemplates,
    createFromTemplate,
    getSuccessRate,
  } = useAgents();

  // Form state for creating new agent
  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    agent_type: 'receptionist' as AgentType,
  });

  // Load templates when dialog opens in template mode
  useEffect(() => {
    if (isCreateDialogOpen && createMode === 'template') {
      fetchTemplates().then(setTemplates);
    }
  }, [isCreateDialogOpen, createMode]);

  // Filter agents by search query
  const filteredAgents = agents.filter((agent) =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    getAgentTypeLabel(agent.agent_type).toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle create agent from scratch
  const handleCreateAgent = async () => {
    if (!newAgent.name.trim()) return;

    const agent = await addAgent({
      name: newAgent.name,
      description: newAgent.description || null,
      agent_type: newAgent.agent_type,
      status: 'inactive',
      config: DEFAULT_AGENT_CONFIG,
      schedule_type: 'manual',
      schedule_config: {},
      last_run_at: null,
      next_run_at: null,
    });

    if (agent) {
      setIsCreateDialogOpen(false);
      setNewAgent({ name: '', description: '', agent_type: 'receptionist' });
      // Navigate to agent detail page for configuration
      navigate(`/agents/${agent.id}`);
    }
  };

  // Handle create from template
  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId) return;

    const agent = await createFromTemplate(selectedTemplateId, {
      name: newAgent.name || undefined,
      description: newAgent.description || undefined,
    });

    if (agent) {
      setIsCreateDialogOpen(false);
      setNewAgent({ name: '', description: '', agent_type: 'receptionist' });
      setSelectedTemplateId('');
      // Navigate to agent detail page for configuration
      navigate(`/agents/${agent.id}`);
    }
  };

  // Handle delete agent
  const handleDeleteAgent = async () => {
    if (!deleteConfirmAgent) return;

    const success = await deleteAgent(deleteConfirmAgent.id);
    if (success) {
      setDeleteConfirmAgent(null);
    }
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        <Header
          title="AI Agents"
          subtitle="Manage autonomous assistants that handle repetitive tasks 24/7"
          actions={
            <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Agent
            </Button>
          }
        />

        {/* Toolbar */}
        <div className="p-6 border-b space-y-4">
          <div className="flex items-center gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search agents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredAgents.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No agents yet</h3>
              <p className="text-sm text-muted-foreground mb-4 max-w-sm">
                {searchQuery
                  ? 'No agents match your search. Try a different query.'
                  : 'Create your first AI agent to automate repetitive sales tasks.'}
              </p>
              {!searchQuery && (
                <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Agent
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  successRate={getSuccessRate(agent)}
                  onClick={() => navigate(`/agents/${agent.id}`)}
                  onToggleStatus={() => toggleAgentStatus(agent.id)}
                  onEdit={() => navigate(`/agents/${agent.id}`)}
                  onDelete={() => setDeleteConfirmAgent(agent)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Create Agent Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create AI Agent</DialogTitle>
              <DialogDescription>
                Choose to start from a pre-built template or create a custom agent from scratch.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Mode Selection */}
              <div className="flex gap-4">
                <Button
                  variant={createMode === 'template' ? 'default' : 'outline'}
                  onClick={() => setCreateMode('template')}
                  className="flex-1"
                >
                  From Template
                </Button>
                <Button
                  variant={createMode === 'scratch' ? 'default' : 'outline'}
                  onClick={() => setCreateMode('scratch')}
                  className="flex-1"
                >
                  From Scratch
                </Button>
              </div>

              {/* Template Selection */}
              {createMode === 'template' && (
                <div className="space-y-4">
                  <Label>Choose Template</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {templates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => setSelectedTemplateId(template.id)}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedTemplateId === template.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/50'
                        }`}
                      >
                        <h4 className="font-medium mb-1">{getAgentTypeLabel(template.agent_type)}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {getAgentTypeDescription(template.agent_type)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Agent Type Selection (From Scratch) */}
              {createMode === 'scratch' && (
                <div className="space-y-2">
                  <Label htmlFor="agent-type">Agent Type</Label>
                  <Select
                    value={newAgent.agent_type}
                    onValueChange={(value) => setNewAgent({ ...newAgent, agent_type: value as AgentType })}
                  >
                    <SelectTrigger id="agent-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {agentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {getAgentTypeLabel(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {getAgentTypeDescription(newAgent.agent_type)}
                  </p>
                </div>
              )}

              {/* Common Fields */}
              <div className="space-y-2">
                <Label htmlFor="name">Agent Name</Label>
                <Input
                  id="name"
                  placeholder="e.g., My SDR Agent"
                  value={newAgent.name}
                  onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What does this agent do?"
                  value={newAgent.description}
                  onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreateDialogOpen(false);
                    setNewAgent({ name: '', description: '', agent_type: 'receptionist' });
                    setSelectedTemplateId('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={createMode === 'template' ? handleCreateFromTemplate : handleCreateAgent}
                  disabled={
                    !newAgent.name.trim() ||
                    (createMode === 'template' && !selectedTemplateId)
                  }
                >
                  Create Agent
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!deleteConfirmAgent} onOpenChange={() => setDeleteConfirmAgent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Agent</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deleteConfirmAgent?.name}"? This action cannot be undone and will also delete all execution history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteAgent} className="bg-destructive">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}

import { useState, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  ReactFlowProvider,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useWorkflows } from '@/hooks/useWorkflows';
import { WorkflowCard } from '@/components/workflows/WorkflowCard';
import { NodePalette } from '@/components/workflows/NodePalette';
import { TriggerNode } from '@/components/workflows/nodes/TriggerNode';
import { AIProcessorNode } from '@/components/workflows/nodes/AIProcessorNode';
import { ActionNode } from '@/components/workflows/nodes/ActionNode';
import { ConditionNode } from '@/components/workflows/nodes/ConditionNode';
import { DelayNode } from '@/components/workflows/nodes/DelayNode';
import { workflowTemplates } from '@/components/workflows/workflowTemplates';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Search,
  Plus,
  Loader2,
  Wand2,
  Workflow,
  Play,
  Zap,
  UserPlus,
  Target,
  Mail,
  Calendar,
} from 'lucide-react';
import { TriggerType } from '@/types/workflows';

const nodeTypes = {
  trigger: TriggerNode,
  ai_processor: AIProcessorNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
};

const triggerOptions = [
  { value: 'contact_created', label: 'New Contact Created', icon: UserPlus },
  { value: 'deal_stage_changed', label: 'Deal Stage Changed', icon: Target },
  { value: 'email_received', label: 'Email Received', icon: Mail },
  { value: 'form_submitted', label: 'Form Submitted', icon: Zap },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled', icon: Calendar },
];

const templateIcons: Record<string, any> = {
  UserPlus: UserPlus,
  Calendar: Calendar,
  Mail: Mail,
  Target: Target,
};

function WorkflowsContent() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'scratch' | 'template' | 'ai'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    trigger_type: 'contact_created' as TriggerType,
  });

  const { workflows, loading, addWorkflow, deleteWorkflow, toggleWorkflowStatus, duplicateWorkflow } = useWorkflows();

  const filteredWorkflows = workflows.filter((workflow) =>
    workflow.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    workflow.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreateWorkflow = async () => {
    if (createMode === 'template' && selectedTemplate) {
      const template = workflowTemplates.find((t) => t.id === selectedTemplate);
      if (template) {
        const workflow = await addWorkflow({
          name: template.name,
          description: template.description,
          trigger_type: template.trigger_type,
          nodes: template.nodes,
          edges: template.edges,
        });
        if (workflow) {
          setIsCreateDialogOpen(false);
          navigate(`/workflows/${workflow.id}`);
        }
      }
    } else if (createMode === 'scratch') {
      if (!newWorkflow.name) return;
      const workflow = await addWorkflow({
        name: newWorkflow.name,
        description: newWorkflow.description,
        trigger_type: newWorkflow.trigger_type,
        nodes: [
          {
            id: 'trigger-1',
            type: 'trigger',
            position: { x: 250, y: 50 },
            data: {
              label: triggerOptions.find((t) => t.value === newWorkflow.trigger_type)?.label || 'Trigger',
              triggerType: newWorkflow.trigger_type,
            },
          },
        ],
        edges: [],
      });
      if (workflow) {
        setIsCreateDialogOpen(false);
        navigate(`/workflows/${workflow.id}`);
      }
    } else if (createMode === 'ai') {
      // AI generation would be implemented with OpenAI API
      // For now, create a basic workflow
      const workflow = await addWorkflow({
        name: 'AI Generated Workflow',
        description: aiPrompt,
        trigger_type: 'contact_created',
        nodes: [],
        edges: [],
      });
      if (workflow) {
        setIsCreateDialogOpen(false);
        navigate(`/workflows/${workflow.id}`);
      }
    }
  };

  const resetCreateForm = () => {
    setNewWorkflow({ name: '', description: '', trigger_type: 'contact_created' });
    setSelectedTemplate(null);
    setAiPrompt('');
    setCreateMode('template');
  };

  return (
    <MainLayout>
      <Header
        title="Workflows"
        subtitle="Build AI-powered automations"
      />

      <div className="p-4 md:p-6 space-y-6 relative overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Animated background gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-pink-500/10 dark:from-blue-500/30 dark:via-purple-500/20 dark:to-pink-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent dark:from-cyan-500/20 dark:via-blue-500/15 rounded-full blur-3xl" />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 dark:from-violet-500/15 dark:to-fuchsia-500/10 rounded-full blur-2xl" />
        </div>
        {/* Search and Actions */}
        <div className="flex flex-col sm:flex-row gap-3 animate-fade-in">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) resetCreateForm();
          }}>
            <DialogTrigger asChild>
              <Button variant="gradient">
                <Plus className="h-4 w-4 mr-2" />
                Create Workflow
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Workflow</DialogTitle>
              </DialogHeader>

              <Tabs value={createMode} onValueChange={(v) => setCreateMode(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="template">
                    <Workflow className="h-4 w-4 mr-2" />
                    Template
                  </TabsTrigger>
                  <TabsTrigger value="scratch">
                    <Plus className="h-4 w-4 mr-2" />
                    From Scratch
                  </TabsTrigger>
                  <TabsTrigger value="ai">
                    <Wand2 className="h-4 w-4 mr-2" />
                    AI Generate
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="template" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Choose a pre-built workflow template to get started quickly.
                  </p>
                  <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto">
                    {workflowTemplates.map((template) => {
                      const Icon = templateIcons[template.icon] || Workflow;
                      return (
                        <div
                          key={template.id}
                          onClick={() => setSelectedTemplate(template.id)}
                          className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                            selectedTemplate === template.id
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                              <Icon className="h-4 w-4 text-white" />
                            </div>
                            <h4 className="font-medium text-sm">{template.name}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {template.description}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>

                <TabsContent value="scratch" className="space-y-4 mt-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="workflow-name">Name</Label>
                      <Input
                        id="workflow-name"
                        value={newWorkflow.name}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, name: e.target.value })}
                        placeholder="My Workflow"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="workflow-desc">Description</Label>
                      <Textarea
                        id="workflow-desc"
                        value={newWorkflow.description}
                        onChange={(e) => setNewWorkflow({ ...newWorkflow, description: e.target.value })}
                        placeholder="What does this workflow do?"
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Trigger</Label>
                      <Select
                        value={newWorkflow.trigger_type}
                        onValueChange={(v) => setNewWorkflow({ ...newWorkflow, trigger_type: v as TriggerType })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select trigger" />
                        </SelectTrigger>
                        <SelectContent>
                          {triggerOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              <div className="flex items-center gap-2">
                                <option.icon className="h-4 w-4" />
                                {option.label}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="ai" className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Describe what you want to automate and AI will build the workflow for you.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="ai-prompt">Describe your workflow</Label>
                    <Textarea
                      id="ai-prompt"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Create a workflow that drafts a follow-up email if a high-value lead hasn't responded in 5 days..."
                      rows={4}
                    />
                  </div>
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <Wand2 className="h-4 w-4 text-amber-600" />
                    <p className="text-xs text-amber-800">
                      AI will analyze your description and create the workflow nodes automatically.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              <div className="flex justify-end gap-3 mt-4">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="gradient"
                  onClick={handleCreateWorkflow}
                  disabled={
                    (createMode === 'template' && !selectedTemplate) ||
                    (createMode === 'scratch' && !newWorkflow.name) ||
                    (createMode === 'ai' && !aiPrompt)
                  }
                >
                  {createMode === 'ai' && <Wand2 className="h-4 w-4 mr-2" />}
                  Create Workflow
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-sm text-muted-foreground">Total Workflows</p>
            <p className="text-2xl font-bold">{workflows.length}</p>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">
              {workflows.filter((w) => w.status === 'active').length}
            </p>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-sm text-muted-foreground">Total Runs</p>
            <p className="text-2xl font-bold">
              {workflows.reduce((sum, w) => sum + w.total_executions, 0)}
            </p>
          </div>
          <div className="p-4 rounded-xl border bg-card">
            <p className="text-sm text-muted-foreground">Success Rate</p>
            <p className="text-2xl font-bold text-blue-600">
              {workflows.length > 0
                ? Math.round(
                    (workflows.reduce((sum, w) => sum + w.successful_executions, 0) /
                      Math.max(1, workflows.reduce((sum, w) => sum + w.total_executions, 0))) *
                      100
                  )
                : 0}
              %
            </p>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Workflows Grid */}
        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-slide-up">
            {filteredWorkflows.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onClick={() => navigate(`/workflows/${workflow.id}`)}
                onToggleStatus={() => toggleWorkflowStatus(workflow.id)}
                onDuplicate={() => duplicateWorkflow(workflow.id)}
                onDelete={() => deleteWorkflow(workflow.id)}
              />
            ))}

            {filteredWorkflows.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 mb-4">
                  <Workflow className="h-8 w-8 text-violet-600" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  {searchQuery ? 'No workflows found' : 'No workflows yet'}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery
                    ? 'Try adjusting your search query'
                    : 'Create your first AI-powered automation'}
                </p>
                {!searchQuery && (
                  <Button variant="gradient" onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Workflow
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}

export default function Workflows() {
  return (
    <ReactFlowProvider>
      <WorkflowsContent />
    </ReactFlowProvider>
  );
}

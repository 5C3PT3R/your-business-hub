/**
 * AI Workflow Canvas Editor
 * "Lego Mindstorms meets Generative AI"
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  ReactFlowProvider,
  ReactFlowInstance,
  BackgroundVariant,
  Panel,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useWorkflows } from '@/hooks/useWorkflows';
import { supabase } from '@/integrations/supabase/client';
import { NodePalette } from '@/components/workflows/NodePalette';
import { TriggerNode } from '@/components/workflows/nodes/TriggerNode';
import { AIProcessorNode } from '@/components/workflows/nodes/AIProcessorNode';
import { ActionNode } from '@/components/workflows/nodes/ActionNode';
import { ConditionNode } from '@/components/workflows/nodes/ConditionNode';
import { DelayNode } from '@/components/workflows/nodes/DelayNode';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { useToast } from '@/hooks/use-toast';
import {
  ArrowLeft,
  Save,
  Play,
  Pause,
  Loader2,
  Wand2,
  Trash2,
  Settings,
  Zap,
  Bot,
  Sparkles,
  AlertTriangle,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkflowNode, WorkflowEdge } from '@/types/workflows';

// Node types for ReactFlow
const nodeTypes = {
  trigger: TriggerNode,
  ai_processor: AIProcessorNode,
  action: ActionNode,
  condition: ConditionNode,
  delay: DelayNode,
};

// Edge styles
const defaultEdgeOptions = {
  type: 'smoothstep',
  animated: true,
  style: { stroke: '#a855f7', strokeWidth: 2 },
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: '#a855f7',
  },
};

// Context sources for AI nodes
const contextSources = [
  { value: 'trigger_data', label: 'Trigger Data (Full)' },
  { value: 'contact', label: 'Contact Information' },
  { value: 'deal', label: 'Deal Information' },
  { value: 'email_body', label: 'Email Body' },
  { value: 'previous_node', label: 'Previous Node Output' },
];

// Condition operators
const conditionOperators = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does Not Equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'is_empty', label: 'Is Empty' },
];

function WorkflowEditorContent() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Workflow state
  const { updateWorkflow } = useWorkflows();
  const [workflow, setWorkflow] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // UI state
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [showNodeConfig, setShowNodeConfig] = useState(false);
  const [showMagicBuild, setShowMagicBuild] = useState(false);
  const [magicPrompt, setMagicPrompt] = useState('');
  const [generatingMagic, setGeneratingMagic] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [nodeToDelete, setNodeToDelete] = useState<string | null>(null);

  // Load workflow - only when id changes
  useEffect(() => {
    let isMounted = true;

    async function loadWorkflow() {
      if (!id) return;
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('workflows')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!isMounted) return;

        if (data) {
          setWorkflow(data);
          const rfNodes = (data.nodes || []).map((node: WorkflowNode) => ({
            id: node.id,
            type: node.type,
            position: node.position,
            data: node.data,
          }));
          const rfEdges = (data.edges || []).map((edge: WorkflowEdge) => ({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            sourceHandle: edge.sourceHandle,
            targetHandle: edge.targetHandle,
            label: edge.label,
            type: edge.type || 'smoothstep',
            animated: true,
            style: { stroke: '#a855f7', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' },
          }));
          setNodes(rfNodes);
          setEdges(rfEdges);
        }
      } catch (err) {
        console.error('Error loading workflow:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadWorkflow();
    return () => { isMounted = false; };
  }, [id]);

  // Track changes
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!loading && workflow) {
      if (initialLoadDone.current) {
        setIsDirty(true);
      } else {
        initialLoadDone.current = true;
      }
    }
  }, [nodes, edges, loading, workflow]);

  // Handle node selection
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
    setShowNodeConfig(true);
  }, []);

  // Handle connection
  const onConnect = useCallback((params: Connection) => {
    setEdges((eds) => addEdge({
      ...params,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#a855f7', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' },
    }, eds));
  }, [setEdges]);

  // Handle drag over
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  // Handle drop from palette
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const type = event.dataTransfer.getData('application/reactflow-type');
    const dataStr = event.dataTransfer.getData('application/reactflow-data');
    if (!type || !reactFlowInstance || !reactFlowWrapper.current) return;

    const data = dataStr ? JSON.parse(dataStr) : {};
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });

    const newNode: Node = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: { label: data.label || type, ...data },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [reactFlowInstance, setNodes]);

  // Handle drag start from palette
  const onDragStart = useCallback((event: React.DragEvent, nodeType: string, data: any) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.setData('application/reactflow-data', JSON.stringify(data));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  // Update node data
  const updateNodeData = useCallback((nodeId: string, newData: any) => {
    setNodes((nds) => nds.map((node) =>
      node.id === nodeId ? { ...node, data: { ...node.data, ...newData } } : node
    ));
    if (selectedNode?.id === nodeId) {
      setSelectedNode((prev) => prev ? { ...prev, data: { ...prev.data, ...newData } } : null);
    }
  }, [setNodes, selectedNode]);

  // Delete node
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setShowNodeConfig(false);
    setSelectedNode(null);
    setShowDeleteConfirm(false);
    setNodeToDelete(null);
  }, [setNodes, setEdges]);

  // Save workflow
  const handleSave = async () => {
    if (!workflow) return;
    setSaving(true);

    const workflowNodes: WorkflowNode[] = nodes.map((node) => ({
      id: node.id,
      type: node.type as any,
      position: node.position,
      data: node.data as any,
    }));

    const workflowEdges: WorkflowEdge[] = edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle || undefined,
      targetHandle: edge.targetHandle || undefined,
      label: edge.label as string | undefined,
      type: edge.type,
    }));

    const success = await updateWorkflow(workflow.id, { nodes: workflowNodes, edges: workflowEdges });

    if (success) {
      setIsDirty(false);
      toast({ title: 'Workflow saved', description: 'Your changes have been saved.' });
    } else {
      toast({ title: 'Error', description: 'Failed to save workflow.', variant: 'destructive' });
    }
    setSaving(false);
  };

  // Toggle workflow status
  const handleToggleStatus = async () => {
    if (!workflow) return;
    const newStatus = workflow.status === 'active' ? 'paused' : 'active';
    const success = await updateWorkflow(workflow.id, { status: newStatus });
    if (success) {
      setWorkflow((prev: any) => ({ ...prev, status: newStatus }));
      toast({ title: newStatus === 'active' ? 'Workflow activated' : 'Workflow paused' });
    }
  };

  // Magic Build
  const handleMagicBuild = async () => {
    if (!magicPrompt.trim()) return;
    setGeneratingMagic(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const generatedNodes: Node[] = [];
    const generatedEdges: any[] = [];
    let yPosition = 100;
    let lastNodeId: string | null = null;

    // Simple pattern matching for demo
    if (magicPrompt.toLowerCase().includes('email')) {
      const triggerId = `trigger-${Date.now()}`;
      generatedNodes.push({
        id: triggerId,
        type: 'trigger',
        position: { x: 300, y: yPosition },
        data: { label: 'Email Received', triggerType: 'email_received' },
      });
      lastNodeId = triggerId;
      yPosition += 150;
    }

    if (magicPrompt.toLowerCase().includes('analyz') || magicPrompt.toLowerCase().includes('check')) {
      const aiId = `ai-${Date.now()}`;
      generatedNodes.push({
        id: aiId,
        type: 'ai_processor',
        position: { x: 300, y: yPosition },
        data: { label: 'AI Analysis', model: 'gpt-4o-mini', instruction: 'Analyze the content.' },
      });
      if (lastNodeId) {
        generatedEdges.push({
          id: `edge-${Date.now()}`,
          source: lastNodeId,
          target: aiId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#a855f7', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' },
        });
      }
      lastNodeId = aiId;
      yPosition += 150;
    }

    if (magicPrompt.toLowerCase().includes('draft') || magicPrompt.toLowerCase().includes('reply')) {
      const actionId = `action-${Date.now() + 1}`;
      generatedNodes.push({
        id: actionId,
        type: 'action',
        position: { x: 300, y: yPosition },
        data: { label: 'Draft Email', actionType: 'draft_email' },
      });
      if (lastNodeId) {
        generatedEdges.push({
          id: `edge-${Date.now() + 1}`,
          source: lastNodeId,
          target: actionId,
          type: 'smoothstep',
          animated: true,
          style: { stroke: '#a855f7', strokeWidth: 2 },
          markerEnd: { type: MarkerType.ArrowClosed, color: '#a855f7' },
        });
      }
    }

    setNodes((nds) => [...nds, ...generatedNodes]);
    setEdges((eds) => [...eds, ...generatedEdges]);
    setGeneratingMagic(false);
    setShowMagicBuild(false);
    setMagicPrompt('');
    toast({ title: 'Workflow generated!', description: `Created ${generatedNodes.length} nodes.` });
  };

  // Render node config
  const renderNodeConfig = () => {
    if (!selectedNode) return null;
    const nodeType = selectedNode.type;
    const nodeData = selectedNode.data as any;

    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Label</Label>
          <Input
            value={nodeData.label || ''}
            onChange={(e) => updateNodeData(selectedNode.id, { label: e.target.value })}
          />
        </div>

        {nodeType === 'ai_processor' && (
          <>
            <div className="p-3 bg-violet-50 dark:bg-violet-950/50 rounded-lg border border-violet-200 dark:border-violet-800">
              <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300">
                <Bot className="h-4 w-4" />
                <span className="text-sm font-medium">AI Smart Block</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Instruction</Label>
              <Textarea
                value={nodeData.instruction || ''}
                onChange={(e) => updateNodeData(selectedNode.id, { instruction: e.target.value })}
                placeholder="What should the AI do?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Context Source</Label>
              <Select value={nodeData.contextSource || 'trigger_data'} onValueChange={(v) => updateNodeData(selectedNode.id, { contextSource: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {contextSources.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Model</Label>
              <Select value={nodeData.model || 'gpt-4o-mini'} onValueChange={(v) => updateNodeData(selectedNode.id, { model: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o-mini"><Zap className="h-3 w-3 inline mr-2 text-blue-500" />Fast</SelectItem>
                  <SelectItem value="gpt-4o"><Sparkles className="h-3 w-3 inline mr-2 text-yellow-500" />Smart</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {nodeType === 'condition' && (
          <>
            <div className="space-y-2">
              <Label>Field</Label>
              <Input value={nodeData.conditionField || ''} onChange={(e) => updateNodeData(selectedNode.id, { conditionField: e.target.value })} placeholder="{{variable}}" />
            </div>
            <div className="space-y-2">
              <Label>Operator</Label>
              <Select value={nodeData.conditionOperator || 'equals'} onValueChange={(v) => updateNodeData(selectedNode.id, { conditionOperator: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {conditionOperators.map((op) => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input value={nodeData.conditionValue || ''} onChange={(e) => updateNodeData(selectedNode.id, { conditionValue: e.target.value })} />
            </div>
          </>
        )}

        {nodeType === 'delay' && (
          <div className="flex gap-2">
            <div className="flex-1 space-y-2">
              <Label>Amount</Label>
              <Input type="number" min={1} value={nodeData.delayAmount || 1} onChange={(e) => updateNodeData(selectedNode.id, { delayAmount: parseInt(e.target.value) || 1 })} />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Unit</Label>
              <Select value={nodeData.delayUnit || 'hours'} onValueChange={(v) => updateNodeData(selectedNode.id, { delayUnit: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                  <SelectItem value="days">Days</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {nodeType === 'action' && (
          <div className="space-y-2">
            <Label>Action Type</Label>
            <Select value={nodeData.actionType || 'draft_email'} onValueChange={(v) => updateNodeData(selectedNode.id, { actionType: v, label: v.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft_email">Draft Email</SelectItem>
                <SelectItem value="send_email">Send Email</SelectItem>
                <SelectItem value="create_task">Create Task</SelectItem>
                <SelectItem value="update_field">Update Field</SelectItem>
                <SelectItem value="send_notification">Notification</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="pt-4 border-t">
          <Button variant="destructive" size="sm" className="w-full" onClick={() => { setNodeToDelete(selectedNode.id); setShowDeleteConfirm(true); }}>
            <Trash2 className="h-4 w-4 mr-2" />Delete Node
          </Button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-background">
        <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-semibold mb-2">Workflow not found</h2>
        <Button onClick={() => navigate('/workflows')}><ArrowLeft className="h-4 w-4 mr-2" />Back</Button>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-14 border-b bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/workflows')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="border-l pl-3">
            <h1 className="font-semibold text-foreground leading-tight">{workflow.name}</h1>
            <p className="text-xs text-muted-foreground">{workflow.description || 'No description'}</p>
          </div>
          <Badge variant={workflow.status === 'active' ? 'default' : 'secondary'} className={cn(workflow.status === 'active' && 'bg-green-500')}>
            {workflow.status}
          </Badge>
          {isDirty && <Badge variant="outline" className="text-amber-600 border-amber-400 bg-amber-50 dark:bg-amber-950/50">Unsaved</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowMagicBuild(true)} className="border-violet-300 text-violet-600 hover:bg-violet-50 dark:border-violet-700 dark:hover:bg-violet-950/50">
            <Wand2 className="h-4 w-4 mr-2" />Magic Build
          </Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
          <Button size="sm" variant={workflow.status === 'active' ? 'destructive' : 'default'} onClick={handleToggleStatus}>
            {workflow.status === 'active' ? <><Pause className="h-4 w-4 mr-2" />Pause</> : <><Play className="h-4 w-4 mr-2" />Activate</>}
          </Button>
        </div>
      </header>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Palette */}
        <NodePalette onDragStart={onDragStart} />

        {/* Canvas */}
        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onInit={setReactFlowInstance}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            fitView
            proOptions={{ hideAttribution: true }}
            className="!bg-muted/30"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} className="!bg-background" />
            <Controls className="!bg-card !border !shadow-md !rounded-lg" />
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'trigger': return '#10b981';
                  case 'ai_processor': return '#8b5cf6';
                  case 'action': return '#3b82f6';
                  case 'condition': return '#f59e0b';
                  case 'delay': return '#6b7280';
                  default: return '#9ca3af';
                }
              }}
              className="!bg-card !border !shadow-md !rounded-lg"
              maskColor="rgba(0,0,0,0.1)"
            />

            {nodes.length === 0 && (
              <Panel position="top-center" className="mt-32">
                <div className="text-center p-8 bg-card rounded-xl shadow-lg border max-w-md">
                  <div className="p-4 rounded-full bg-gradient-to-br from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 w-fit mx-auto mb-4">
                    <GripVertical className="h-8 w-8 text-violet-600" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">Start Building</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag nodes from the left palette or use Magic Build to generate a workflow.
                  </p>
                  <Button variant="gradient" onClick={() => setShowMagicBuild(true)}>
                    <Wand2 className="h-4 w-4 mr-2" />Try Magic Build
                  </Button>
                </div>
              </Panel>
            )}
          </ReactFlow>
        </div>

        {/* Config Sheet */}
        <Sheet open={showNodeConfig} onOpenChange={setShowNodeConfig}>
          <SheetContent className="w-[380px] sm:w-[420px]">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />Configure Node
              </SheetTitle>
            </SheetHeader>
            <div className="mt-6 overflow-y-auto max-h-[calc(100vh-120px)]">{renderNodeConfig()}</div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Magic Build Dialog */}
      <AlertDialog open={showMagicBuild} onOpenChange={setShowMagicBuild}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-violet-600" />Magic Build
            </AlertDialogTitle>
            <AlertDialogDescription>
              Describe your workflow in plain English and AI will generate the nodes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            value={magicPrompt}
            onChange={(e) => setMagicPrompt(e.target.value)}
            placeholder="e.g., When I receive an email, analyze if it's urgent, then draft a reply"
            rows={4}
            className="mt-2"
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button variant="gradient" onClick={handleMagicBuild} disabled={!magicPrompt.trim() || generatingMagic}>
              {generatingMagic ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
              Generate
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirm */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Node?</AlertDialogTitle>
            <AlertDialogDescription>This will remove the node and all connections.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => nodeToDelete && deleteNode(nodeToDelete)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function WorkflowEditor() {
  return (
    <ReactFlowProvider>
      <WorkflowEditorContent />
    </ReactFlowProvider>
  );
}

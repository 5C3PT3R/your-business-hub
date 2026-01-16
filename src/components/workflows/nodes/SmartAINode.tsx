/**
 * Smart AI Node - The "Prompt-in-Box" Experience
 *
 * Per PRD: "When a user drags a Smart Node onto the canvas,
 * the node expands to show a Textarea directly on the card."
 *
 * This is the core innovation - users type natural language prompts
 * directly in the node without opening configuration dialogs.
 */

import { memo, useState, useCallback } from 'react';
import { Handle, Position, NodeProps, useReactFlow } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Bot, Sparkles, Zap, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

interface SmartAINodeData {
  label: string;
  instruction?: string;
  model?: 'gpt-4o' | 'gpt-4o-mini';
  contextSource?: string;
  outputVariable?: string;
  isExpanded?: boolean;
}

const contextOptions = [
  { value: 'trigger_data', label: 'Full Trigger Data' },
  { value: 'email_body', label: 'Email Body' },
  { value: 'contact', label: 'Contact Info' },
  { value: 'deal', label: 'Deal Info' },
  { value: 'previous_output', label: 'Previous Output' },
];

function SmartAINodeComponent({ id, data, selected }: NodeProps) {
  const nodeData = data as SmartAINodeData;
  const { setNodes } = useReactFlow();
  const [isExpanded, setIsExpanded] = useState(nodeData.isExpanded ?? true);
  const model = nodeData.model || 'gpt-4o-mini';
  const isSmartModel = model === 'gpt-4o';

  // Update node data in ReactFlow state
  const updateData = useCallback(
    (updates: Partial<SmartAINodeData>) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id === id) {
            return {
              ...node,
              data: { ...node.data, ...updates },
            };
          }
          return node;
        })
      );
    },
    [id, setNodes]
  );

  return (
    <div
      className={cn(
        'rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg transition-all duration-200',
        'border-2',
        selected ? 'border-white ring-2 ring-white/50 ring-offset-2 ring-offset-violet-500' : 'border-violet-400/50',
        isExpanded ? 'min-w-[320px]' : 'min-w-[200px]'
      )}
    >
      {/* Input Handle */}
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-white !w-3 !h-3 !border-2 !border-violet-600"
      />

      {/* Header */}
      <div
        className="flex items-center justify-between p-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/20 rounded-lg relative">
            <Bot className="h-4 w-4" />
            {isSmartModel && (
              <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-yellow-300" />
            )}
          </div>
          <div>
            <p className="text-xs text-white/80 font-medium flex items-center gap-1">
              <Wand2 className="h-3 w-3" />
              AI SMART BLOCK
            </p>
            <p className="font-semibold text-sm">{nodeData.label || 'AI Processor'}</p>
          </div>
        </div>
        <button className="p-1 hover:bg-white/10 rounded">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Expanded Content - The "Prompt-in-Box" */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {/* Instruction Textarea - Direct on card */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/70 font-medium">
              What should this AI do?
            </label>
            <Textarea
              value={nodeData.instruction || ''}
              onChange={(e) => updateData({ instruction: e.target.value })}
              placeholder='e.g., "Check if the email sounds angry" or "Extract the budget from this conversation"'
              className={cn(
                'bg-white/10 border-white/20 text-white placeholder:text-white/40',
                'focus:border-white/40 focus:ring-white/20',
                'text-sm min-h-[80px] resize-none nodrag'
              )}
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Context Source */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/70 font-medium">
              Analyze data from
            </label>
            <Select
              value={nodeData.contextSource || 'trigger_data'}
              onValueChange={(v) => updateData({ contextSource: v })}
            >
              <SelectTrigger
                className={cn(
                  'bg-white/10 border-white/20 text-white text-sm h-8',
                  'focus:border-white/40 focus:ring-white/20 nodrag'
                )}
                onClick={(e) => e.stopPropagation()}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contextOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model Selection */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateData({ model: 'gpt-4o-mini' });
                }}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium transition-colors nodrag',
                  model === 'gpt-4o-mini'
                    ? 'bg-white/30 text-white'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                )}
              >
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3" />
                  Fast
                </div>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  updateData({ model: 'gpt-4o' });
                }}
                className={cn(
                  'px-2 py-1 rounded text-xs font-medium transition-colors nodrag',
                  model === 'gpt-4o'
                    ? 'bg-yellow-400/40 text-yellow-100'
                    : 'bg-white/10 text-white/60 hover:bg-white/20'
                )}
              >
                <div className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Smart
                </div>
              </button>
            </div>

            {/* Output indicator */}
            <Badge
              variant="outline"
              className="bg-white/10 border-white/30 text-white/80 text-[10px]"
            >
              → {`{${nodeData.outputVariable || 'result'}}`}
            </Badge>
          </div>
        </div>
      )}

      {/* Collapsed Preview */}
      {!isExpanded && nodeData.instruction && (
        <div className="px-3 pb-3">
          <p className="text-xs text-white/70 line-clamp-2 italic">
            "{nodeData.instruction}"
          </p>
        </div>
      )}

      {/* Output Handle */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-white !w-3 !h-3 !border-2 !border-violet-600"
      />
    </div>
  );
}

export const SmartAINode = memo(SmartAINodeComponent);

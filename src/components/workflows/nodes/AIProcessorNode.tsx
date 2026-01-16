import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Bot, Sparkles } from 'lucide-react';

function AIProcessorNodeComponent({ data, selected }: NodeProps) {
  const model = (data.model as string) || 'gpt-4o-mini';
  const isSmartModel = model === 'gpt-4o';

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg min-w-[200px]',
        selected && 'ring-2 ring-white ring-offset-2 ring-offset-violet-500'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-white !w-3 !h-3 !border-2 !border-violet-600"
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg relative">
          <Bot className="h-4 w-4" />
          {isSmartModel && (
            <Sparkles className="h-3 w-3 absolute -top-1 -right-1 text-yellow-300" />
          )}
        </div>
        <div className="flex-1">
          <p className="text-xs text-white/80 font-medium">AI PROCESSOR</p>
          <p className="font-semibold text-sm">{data.label as string}</p>
        </div>
      </div>
      {data.instruction && (
        <p className="mt-2 text-xs text-white/70 line-clamp-2 pl-11">
          {data.instruction as string}
        </p>
      )}
      <div className="mt-2 flex items-center gap-2 pl-11">
        <span className={cn(
          'text-[10px] px-2 py-0.5 rounded-full',
          isSmartModel ? 'bg-yellow-400/30 text-yellow-200' : 'bg-white/20'
        )}>
          {isSmartModel ? 'GPT-4o (Smart)' : 'GPT-4o-mini (Fast)'}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-white !w-3 !h-3 !border-2 !border-violet-600"
      />
    </div>
  );
}

export const AIProcessorNode = memo(AIProcessorNodeComponent);

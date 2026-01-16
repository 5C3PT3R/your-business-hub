import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

function DelayNodeComponent({ data, selected }: NodeProps) {
  const amount = (data.delayAmount as number) || 1;
  const unit = (data.delayUnit as string) || 'hours';

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl bg-gradient-to-br from-slate-500 to-gray-600 text-white shadow-lg min-w-[160px]',
        selected && 'ring-2 ring-white ring-offset-2 ring-offset-slate-500'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-white !w-3 !h-3 !border-2 !border-slate-600"
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-white/80 font-medium">DELAY</p>
          <p className="font-semibold text-sm">
            Wait {amount} {unit}
          </p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-white !w-3 !h-3 !border-2 !border-slate-600"
      />
    </div>
  );
}

export const DelayNode = memo(DelayNodeComponent);

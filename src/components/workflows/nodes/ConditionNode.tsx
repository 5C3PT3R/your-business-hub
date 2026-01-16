import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { GitBranch } from 'lucide-react';

function ConditionNodeComponent({ data, selected }: NodeProps) {
  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg min-w-[180px]',
        selected && 'ring-2 ring-white ring-offset-2 ring-offset-amber-500'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-white !w-3 !h-3 !border-2 !border-amber-600"
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <GitBranch className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-white/80 font-medium">CONDITION</p>
          <p className="font-semibold text-sm">{data.label as string}</p>
        </div>
      </div>
      {data.conditionField && (
        <p className="mt-2 text-xs text-white/70 pl-11">
          If {data.conditionField as string} {data.conditionOperator as string} {data.conditionValue as string || '...'}
        </p>
      )}
      <div className="flex justify-between mt-3 px-2">
        <Handle
          type="source"
          position={Position.Bottom}
          id="yes"
          className="!bg-green-400 !w-3 !h-3 !border-2 !border-white !relative !left-0 !translate-x-0"
          style={{ left: '25%' }}
        />
        <Handle
          type="source"
          position={Position.Bottom}
          id="no"
          className="!bg-red-400 !w-3 !h-3 !border-2 !border-white !relative !right-0 !translate-x-0"
          style={{ left: '75%' }}
        />
      </div>
      <div className="flex justify-between text-[10px] mt-1 px-4">
        <span className="text-green-200">Yes</span>
        <span className="text-red-200">No</span>
      </div>
    </div>
  );
}

export const ConditionNode = memo(ConditionNodeComponent);

import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Zap,
  Mail,
  UserPlus,
  Target,
  Calendar,
  CheckCircle,
} from 'lucide-react';

const triggerIcons: Record<string, any> = {
  contact_created: UserPlus,
  deal_stage_changed: Target,
  email_received: Mail,
  form_submitted: Zap,
  meeting_scheduled: Calendar,
  task_completed: CheckCircle,
};

function TriggerNodeComponent({ data, selected }: NodeProps) {
  const Icon = triggerIcons[data.triggerType as string] || Zap;

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg min-w-[180px]',
        selected && 'ring-2 ring-white ring-offset-2 ring-offset-emerald-500'
      )}
    >
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-white/80 font-medium">TRIGGER</p>
          <p className="font-semibold text-sm">{data.label as string}</p>
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-white !w-3 !h-3 !border-2 !border-emerald-600"
      />
    </div>
  );
}

export const TriggerNode = memo(TriggerNodeComponent);

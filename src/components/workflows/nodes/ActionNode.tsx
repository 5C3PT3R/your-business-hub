import { memo } from 'react';
import { Handle, Position, NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import {
  Mail,
  Send,
  Edit3,
  ListTodo,
  Target,
  Bell,
  Webhook,
} from 'lucide-react';

const actionIcons: Record<string, any> = {
  draft_email: Mail,
  send_email: Send,
  update_field: Edit3,
  create_task: ListTodo,
  create_deal: Target,
  send_notification: Bell,
  webhook: Webhook,
};

const actionColors: Record<string, { from: string; to: string; border: string }> = {
  draft_email: { from: 'from-blue-500', to: 'to-cyan-600', border: 'border-blue-600' },
  send_email: { from: 'from-blue-600', to: 'to-indigo-700', border: 'border-blue-700' },
  update_field: { from: 'from-orange-500', to: 'to-amber-600', border: 'border-orange-600' },
  create_task: { from: 'from-pink-500', to: 'to-rose-600', border: 'border-pink-600' },
  create_deal: { from: 'from-green-500', to: 'to-emerald-600', border: 'border-green-600' },
  send_notification: { from: 'from-yellow-500', to: 'to-orange-600', border: 'border-yellow-600' },
  webhook: { from: 'from-gray-600', to: 'to-slate-700', border: 'border-gray-700' },
};

function ActionNodeComponent({ data, selected }: NodeProps) {
  const actionType = (data.actionType as string) || 'draft_email';
  const Icon = actionIcons[actionType] || Mail;
  const colors = actionColors[actionType] || actionColors.draft_email;

  return (
    <div
      className={cn(
        'px-4 py-3 rounded-xl text-white shadow-lg min-w-[180px] bg-gradient-to-br',
        colors.from,
        colors.to,
        selected && 'ring-2 ring-white ring-offset-2'
      )}
    >
      <Handle
        type="target"
        position={Position.Top}
        className={cn('!bg-white !w-3 !h-3 !border-2', `!${colors.border}`)}
      />
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white/20 rounded-lg">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-white/80 font-medium">ACTION</p>
          <p className="font-semibold text-sm">{data.label as string}</p>
        </div>
      </div>
      {data.actionType === 'draft_email' && (
        <p className="mt-2 text-[10px] text-white/70 pl-11">
          Creates draft for review
        </p>
      )}
      <Handle
        type="source"
        position={Position.Bottom}
        className={cn('!bg-white !w-3 !h-3 !border-2', `!${colors.border}`)}
      />
    </div>
  );
}

export const ActionNode = memo(ActionNodeComponent);

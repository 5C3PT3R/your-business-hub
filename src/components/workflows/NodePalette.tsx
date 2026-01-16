import { NodePaletteItem } from '@/types/workflows';
import { cn } from '@/lib/utils';
import {
  Zap,
  Mail,
  UserPlus,
  Target,
  Calendar,
  CheckCircle,
  Bot,
  Send,
  Edit3,
  ListTodo,
  Bell,
  Webhook,
  GitBranch,
  Clock,
} from 'lucide-react';

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string, data: any) => void;
}

const paletteItems: (NodePaletteItem & { icon: any })[] = [
  // Triggers
  {
    type: 'trigger',
    label: 'New Contact',
    description: 'When a contact is created',
    icon: UserPlus,
    category: 'triggers',
    defaultData: { triggerType: 'contact_created', label: 'New Contact' },
  },
  {
    type: 'trigger',
    label: 'Deal Changed',
    description: 'When deal stage changes',
    icon: Target,
    category: 'triggers',
    defaultData: { triggerType: 'deal_stage_changed', label: 'Deal Stage Changed' },
  },
  {
    type: 'trigger',
    label: 'Email Received',
    description: 'When an email arrives',
    icon: Mail,
    category: 'triggers',
    defaultData: { triggerType: 'email_received', label: 'Email Received' },
  },
  {
    type: 'trigger',
    label: 'Form Submitted',
    description: 'When a form is submitted',
    icon: Zap,
    category: 'triggers',
    defaultData: { triggerType: 'form_submitted', label: 'Form Submitted' },
  },
  // AI
  {
    type: 'ai_processor',
    label: 'AI Analysis',
    description: 'Analyze with GPT-4o',
    icon: Bot,
    category: 'ai',
    defaultData: { label: 'AI Analysis', model: 'gpt-4o-mini', instruction: '' },
  },
  // Actions
  {
    type: 'action',
    label: 'Draft Email',
    description: 'Create email draft for review',
    icon: Mail,
    category: 'actions',
    defaultData: { actionType: 'draft_email', label: 'Draft Email' },
  },
  {
    type: 'action',
    label: 'Send Email',
    description: 'Send email immediately',
    icon: Send,
    category: 'actions',
    defaultData: { actionType: 'send_email', label: 'Send Email' },
  },
  {
    type: 'action',
    label: 'Update Field',
    description: 'Update a record field',
    icon: Edit3,
    category: 'actions',
    defaultData: { actionType: 'update_field', label: 'Update Field' },
  },
  {
    type: 'action',
    label: 'Create Task',
    description: 'Assign a task to user',
    icon: ListTodo,
    category: 'actions',
    defaultData: { actionType: 'create_task', label: 'Create Task' },
  },
  {
    type: 'action',
    label: 'Create Deal',
    description: 'Create a new deal',
    icon: Target,
    category: 'actions',
    defaultData: { actionType: 'create_deal', label: 'Create Deal' },
  },
  {
    type: 'action',
    label: 'Notification',
    description: 'Send internal notification',
    icon: Bell,
    category: 'actions',
    defaultData: { actionType: 'send_notification', label: 'Notification' },
  },
  // Logic
  {
    type: 'condition',
    label: 'Condition',
    description: 'Branch based on condition',
    icon: GitBranch,
    category: 'logic',
    defaultData: { label: 'If/Then', conditionOperator: 'equals' },
  },
  {
    type: 'delay',
    label: 'Delay',
    description: 'Wait before continuing',
    icon: Clock,
    category: 'logic',
    defaultData: { label: 'Wait', delayAmount: 1, delayUnit: 'hours' },
  },
];

const categories = [
  { id: 'triggers', label: 'Triggers', color: 'from-emerald-500 to-teal-600' },
  { id: 'ai', label: 'AI', color: 'from-violet-500 to-purple-600' },
  { id: 'actions', label: 'Actions', color: 'from-blue-500 to-cyan-600' },
  { id: 'logic', label: 'Logic', color: 'from-amber-500 to-orange-600' },
];

export function NodePalette({ onDragStart }: NodePaletteProps) {
  return (
    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900">Node Palette</h3>
        <p className="text-xs text-gray-500 mt-1">Drag nodes to the canvas</p>
      </div>

      {categories.map((category) => (
        <div key={category.id} className="p-3">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            {category.label}
          </h4>
          <div className="space-y-2">
            {paletteItems
              .filter((item) => item.category === category.id)
              .map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={`${item.type}-${item.label}`}
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type, item.defaultData)}
                    className={cn(
                      'flex items-center gap-3 p-2 rounded-lg cursor-grab active:cursor-grabbing',
                      'bg-gray-50 hover:bg-gray-100 transition-colors',
                      'border border-transparent hover:border-gray-200'
                    )}
                  >
                    <div className={cn(
                      'p-1.5 rounded-md bg-gradient-to-br text-white',
                      category.color
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {item.description}
                      </p>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

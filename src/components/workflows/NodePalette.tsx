import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import {
  Zap,
  Mail,
  UserPlus,
  Target,
  Calendar,
  Send,
  Edit3,
  ListTodo,
  Bell,
  Webhook,
  GitBranch,
  Clock,
  Search,
  FileText,
  Sparkles,
} from 'lucide-react';

interface NodePaletteProps {
  onDragStart: (event: React.DragEvent, nodeType: string, data: any) => void;
}

interface PaletteItem {
  type: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: 'triggers' | 'ai' | 'actions' | 'logic';
  defaultData: Record<string, any>;
}

const paletteItems: PaletteItem[] = [
  // Triggers (Yellow/Green per PRD - "Events that wake up the robot")
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
  {
    type: 'trigger',
    label: 'Meeting Scheduled',
    description: 'When a meeting is booked',
    icon: Calendar,
    category: 'triggers',
    defaultData: { triggerType: 'meeting_scheduled', label: 'Meeting Scheduled' },
  },
  // AI Smart Blocks (Purple per PRD - "The Core Feature")
  {
    type: 'ai_processor',
    label: 'The Analyst',
    description: 'Classify & analyze content',
    icon: Search,
    category: 'ai',
    defaultData: {
      label: 'AI Analyst',
      model: 'gpt-4o-mini',
      instruction: 'Analyze the content and classify the intent or sentiment.',
      contextSource: 'trigger_data',
      outputVariable: 'analysis_result'
    },
  },
  {
    type: 'ai_processor',
    label: 'The Extractor',
    description: 'Extract data from text',
    icon: FileText,
    category: 'ai',
    defaultData: {
      label: 'AI Extractor',
      model: 'gpt-4o-mini',
      instruction: 'Extract key information and return as structured data.',
      contextSource: 'trigger_data',
      outputVariable: 'extracted_data'
    },
  },
  {
    type: 'ai_processor',
    label: 'The Generator',
    description: 'Generate text & drafts',
    icon: Sparkles,
    category: 'ai',
    defaultData: {
      label: 'AI Generator',
      model: 'gpt-4o',
      instruction: 'Generate a professional response based on the context.',
      contextSource: 'trigger_data',
      outputVariable: 'generated_content'
    },
  },
  // Actions (Green/Blue per PRD - "The hands of the robot")
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
  {
    type: 'action',
    label: 'Webhook',
    description: 'Call external API',
    icon: Webhook,
    category: 'actions',
    defaultData: { actionType: 'webhook', label: 'Webhook' },
  },
  // Logic (Orange per PRD - Flow Control)
  {
    type: 'condition',
    label: 'If/Else',
    description: 'Branch based on condition',
    icon: GitBranch,
    category: 'logic',
    defaultData: { label: 'If/Else', conditionOperator: 'equals' },
  },
  {
    type: 'delay',
    label: 'Wait',
    description: 'Wait before continuing',
    icon: Clock,
    category: 'logic',
    defaultData: { label: 'Wait', delayAmount: 1, delayUnit: 'hours' },
  },
];

const categories = [
  { id: 'triggers', label: 'Triggers', color: 'from-emerald-500 to-teal-600', hint: 'Events that start the workflow' },
  { id: 'ai', label: 'AI Smart Blocks', color: 'from-violet-500 to-purple-600', hint: 'The brain - uses natural language' },
  { id: 'actions', label: 'Actions', color: 'from-blue-500 to-cyan-600', hint: 'The hands - do things' },
  { id: 'logic', label: 'Logic', color: 'from-amber-500 to-orange-600', hint: 'Control flow' },
];

export function NodePalette({ onDragStart }: NodePaletteProps) {
  return (
    <div className="w-64 bg-card border-r border-border overflow-y-auto flex-shrink-0">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold text-foreground">Node Palette</h3>
        <p className="text-xs text-muted-foreground mt-1">Drag nodes to the canvas</p>
      </div>

      {categories.map((category) => (
        <div key={category.id} className="p-3">
          <div className="mb-2">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {category.label}
            </h4>
            <p className="text-[10px] text-muted-foreground/70">{category.hint}</p>
          </div>
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
                      'bg-muted/50 hover:bg-muted transition-colors',
                      'border border-transparent hover:border-border',
                      // Purple border for AI blocks (per PRD)
                      category.id === 'ai' && 'hover:border-violet-300 dark:hover:border-violet-700'
                    )}
                  >
                    <div className={cn(
                      'p-1.5 rounded-md bg-gradient-to-br text-white shadow-sm',
                      category.color
                    )}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.label}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
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

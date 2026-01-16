import { WorkflowTemplate } from '@/types/workflows';

export const workflowTemplates: WorkflowTemplate[] = [
  {
    id: 'inbound-concierge',
    name: 'Inbound Concierge',
    description: 'Speed to Lead: Analyze new leads and draft personalized outreach',
    category: 'lead_management',
    icon: 'UserPlus',
    trigger_type: 'contact_created',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: {
          label: 'New Lead Created',
          triggerType: 'contact_created',
        },
      },
      {
        id: 'ai-1',
        type: 'ai_processor',
        position: { x: 250, y: 180 },
        data: {
          label: 'Analyze Lead',
          instruction: 'Analyze the lead\'s job title and industry. Generate a personalized hook that references their role and potential pain points. Keep it under 2 sentences.',
          model: 'gpt-4o-mini',
          contextSource: 'contact',
          outputVariable: 'personalized_hook',
        },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 250, y: 330 },
        data: {
          label: 'Draft Welcome Email',
          actionType: 'draft_email',
          actionConfig: {
            subject: 'Quick question about {{contact.company}}',
            body: 'Hi {{contact.first_name}},\n\n{{ai_node_1.output}}\n\nWould you have 15 minutes this week to chat?\n\nBest,\n{{user.name}}',
          },
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: 'trigger-1', target: 'ai-1' },
      { id: 'e2-3', source: 'ai-1', target: 'action-1' },
    ],
  },
  {
    id: 'meeting-prep',
    name: 'Meeting Prep Briefer',
    description: 'Get an AI-generated summary before every meeting',
    category: 'productivity',
    icon: 'Calendar',
    trigger_type: 'meeting_scheduled',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: {
          label: 'Meeting Scheduled',
          triggerType: 'meeting_scheduled',
          triggerConditions: { timeBeforeMeeting: 60 }, // 1 hour before
        },
      },
      {
        id: 'ai-1',
        type: 'ai_processor',
        position: { x: 250, y: 180 },
        data: {
          label: 'Generate Brief',
          instruction: 'Summarize the last 10 email interactions with this contact. Include their LinkedIn background if available. Highlight any objections or concerns raised. Format as bullet points.',
          model: 'gpt-4o',
          contextSource: 'meeting_participants',
          outputVariable: 'meeting_brief',
        },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 250, y: 330 },
        data: {
          label: 'Send Brief to Rep',
          actionType: 'send_notification',
          actionConfig: {
            title: 'Meeting Brief: {{meeting.title}}',
            body: '{{ai_node_1.output}}',
            channel: 'email',
          },
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: 'trigger-1', target: 'ai-1' },
      { id: 'e2-3', source: 'ai-1', target: 'action-1' },
    ],
  },
  {
    id: 'objection-handler',
    name: 'Objection Handler',
    description: 'Detect objections in emails and suggest responses',
    category: 'communication',
    icon: 'Mail',
    trigger_type: 'email_received',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: {
          label: 'Email Received',
          triggerType: 'email_received',
        },
      },
      {
        id: 'ai-1',
        type: 'ai_processor',
        position: { x: 250, y: 180 },
        data: {
          label: 'Classify Intent',
          instruction: 'Classify this email\'s intent. Categories: positive_interest, question, objection_price, objection_timing, objection_competitor, not_interested, other. Return JSON with {category, confidence, reasoning}.',
          model: 'gpt-4o-mini',
          contextSource: 'email_body',
          outputVariable: 'intent_classification',
        },
      },
      {
        id: 'condition-1',
        type: 'condition',
        position: { x: 250, y: 330 },
        data: {
          label: 'Is Objection?',
          conditionField: 'intent_classification.category',
          conditionOperator: 'contains',
          conditionValue: 'objection',
        },
      },
      {
        id: 'ai-2',
        type: 'ai_processor',
        position: { x: 100, y: 480 },
        data: {
          label: 'Generate Response',
          instruction: 'Based on the objection type, draft a professional counter-argument that addresses the concern while maintaining rapport. Use empathy first, then provide value.',
          model: 'gpt-4o',
          contextSource: 'email_body,intent_classification',
          outputVariable: 'counter_argument',
        },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 100, y: 630 },
        data: {
          label: 'Draft Response',
          actionType: 'draft_email',
          actionConfig: {
            inReplyTo: '{{email.id}}',
            body: '{{ai_node_2.output}}',
          },
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: 'trigger-1', target: 'ai-1' },
      { id: 'e2-3', source: 'ai-1', target: 'condition-1' },
      { id: 'e3-4', source: 'condition-1', target: 'ai-2', sourceHandle: 'yes' },
      { id: 'e4-5', source: 'ai-2', target: 'action-1' },
    ],
  },
  {
    id: 'post-demo-followup',
    name: 'Post-Demo Follow-Up',
    description: 'Auto-draft follow-up emails after demos with action items',
    category: 'deal_acceleration',
    icon: 'Target',
    trigger_type: 'deal_stage_changed',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        position: { x: 250, y: 50 },
        data: {
          label: 'Deal → Proposal',
          triggerType: 'deal_stage_changed',
          triggerConditions: { toStage: 'proposal' },
        },
      },
      {
        id: 'delay-1',
        type: 'delay',
        position: { x: 250, y: 180 },
        data: {
          label: 'Wait 2 Hours',
          delayAmount: 2,
          delayUnit: 'hours',
        },
      },
      {
        id: 'ai-1',
        type: 'ai_processor',
        position: { x: 250, y: 310 },
        data: {
          label: 'Extract Action Items',
          instruction: 'Read the call notes from the most recent meeting. Extract: 1) Key decisions made, 2) Action items for us, 3) Action items for the prospect, 4) Any concerns raised. Format as a professional follow-up email.',
          model: 'gpt-4o',
          contextSource: 'deal.call_notes',
          outputVariable: 'followup_email',
        },
      },
      {
        id: 'action-1',
        type: 'action',
        position: { x: 250, y: 460 },
        data: {
          label: 'Draft Follow-Up',
          actionType: 'draft_email',
          actionConfig: {
            subject: 'Great chat! Next steps for {{deal.company}}',
            body: '{{ai_node_1.output}}',
          },
        },
      },
      {
        id: 'action-2',
        type: 'action',
        position: { x: 250, y: 590 },
        data: {
          label: 'Create Task',
          actionType: 'create_task',
          actionConfig: {
            title: 'Review & send follow-up for {{deal.company}}',
            dueIn: 24, // hours
            priority: 'high',
          },
        },
      },
    ],
    edges: [
      { id: 'e1-2', source: 'trigger-1', target: 'delay-1' },
      { id: 'e2-3', source: 'delay-1', target: 'ai-1' },
      { id: 'e3-4', source: 'ai-1', target: 'action-1' },
      { id: 'e4-5', source: 'action-1', target: 'action-2' },
    ],
  },
];

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return workflowTemplates.find((t) => t.id === id);
}

export function getTemplatesByCategory(category: string): WorkflowTemplate[] {
  return workflowTemplates.filter((t) => t.category === category);
}

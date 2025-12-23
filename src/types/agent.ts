export interface PlannedAction {
  action: string;
  record_id?: string;
  record_type?: string;
  params?: Record<string, any>;
  confidence: number;
  requires_approval: boolean;
  reason?: string;
}

export interface AgentResponse {
  agent_message: string;
  planned_actions: PlannedAction[];
  summary: string;
}

export interface AgentRequest {
  instruction: string;
  workspaceId: string;
  industryType: string;
  context: {
    leads?: any[];
    contacts?: any[];
    deals?: any[];
    tasks?: any[];
    tickets?: any[];
    properties?: any[];
    clients?: any[];
  };
  allowedActions: string[];
}

export const industryActions: Record<string, string[]> = {
  sales: [
    'create_lead', 'update_lead', 'qualify_lead', 'delete_lead',
    'create_contact', 'update_contact', 'delete_contact',
    'create_deal', 'update_deal_stage', 'delete_deal',
    'create_task', 'complete_task', 'delete_task',
    'send_followup', 'schedule_call'
  ],
  real_estate: [
    'create_client', 'update_client', 'update_intent_level',
    'add_property', 'update_property_status',
    'schedule_site_visit', 'complete_site_visit',
    'create_booking', 'send_property_match'
  ],
  ecommerce: [
    'create_ticket', 'escalate_ticket', 'resolve_ticket', 'close_ticket',
    'update_order_status', 'process_refund',
    'create_customer', 'send_update', 'flag_priority'
  ],
  insurance: [
    'create_claim', 'update_claim_status', 'approve_claim', 'reject_claim',
    'schedule_renewal', 'create_policy', 'update_policyholder',
    'flag_fraud', 'send_reminder', 'escalate_case'
  ]
};

export const actionLabels: Record<string, string> = {
  create_lead: 'Create Lead',
  update_lead: 'Update Lead',
  qualify_lead: 'Qualify Lead',
  delete_lead: 'Delete Lead',
  create_contact: 'Create Contact',
  update_contact: 'Update Contact',
  delete_contact: 'Delete Contact',
  create_deal: 'Create Deal',
  update_deal_stage: 'Update Deal Stage',
  delete_deal: 'Delete Deal',
  create_task: 'Create Task',
  complete_task: 'Complete Task',
  delete_task: 'Delete Task',
  send_followup: 'Send Follow-up',
  schedule_call: 'Schedule Call',
  create_client: 'Create Client',
  update_client: 'Update Client',
  update_intent_level: 'Update Intent Level',
  add_property: 'Add Property',
  update_property_status: 'Update Property Status',
  schedule_site_visit: 'Schedule Site Visit',
  complete_site_visit: 'Complete Site Visit',
  create_booking: 'Create Booking',
  send_property_match: 'Send Property Match',
  create_ticket: 'Create Ticket',
  escalate_ticket: 'Escalate Ticket',
  resolve_ticket: 'Resolve Ticket',
  close_ticket: 'Close Ticket',
  update_order_status: 'Update Order Status',
  process_refund: 'Process Refund',
  create_customer: 'Create Customer',
  send_update: 'Send Update',
  flag_priority: 'Flag as Priority',
  create_claim: 'Create Claim',
  update_claim_status: 'Update Claim Status',
  approve_claim: 'Approve Claim',
  reject_claim: 'Reject Claim',
  schedule_renewal: 'Schedule Renewal',
  create_policy: 'Create Policy',
  update_policyholder: 'Update Policyholder',
  flag_fraud: 'Flag for Fraud',
  send_reminder: 'Send Reminder',
  escalate_case: 'Escalate Case'
};
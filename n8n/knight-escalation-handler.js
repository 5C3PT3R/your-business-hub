// ============================================
// KNIGHT — Escalation Handler (n8n Code Node)
// Runs after AI generates response.
// If escalation is needed, appends handoff info.
// ============================================

const input = $input.first().json;
const routerData = $('JSON Brain Router').first().json; // Reference the router node by name

const aiResponse = input.text || input.output || input.response || "";

if (routerData.needs_escalation && routerData.escalation_email) {
  // Append a human handoff note to the AI response
  const escalationNote = `\n\nI've flagged this to the team — someone from ${routerData.business_name} will reach out to you shortly at this number or via ${routerData.escalation_email}.`;

  return [{
    json: {
      ...routerData,
      ai_response: aiResponse + escalationNote,
      escalated: true,
    },
  }];
}

return [{
  json: {
    ...routerData,
    ai_response: aiResponse,
    escalated: false,
  },
}];

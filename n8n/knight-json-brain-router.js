// ============================================
// KNIGHT — JSON Brain Router (n8n Code Node)
// Receives Meta WhatsApp webhook, identifies
// the business, and injects config into output.
// ============================================

// ── THE JSON BRAIN ──────────────────────────
// Add/remove businesses here. That's it. No DB, no training.
const BRAIN = [
  {
    business_id: "regent_saas",
    business_name: "Regent",
    phone_number: "15551711673", // Meta test number — replace with real ones per business
    policy: [
      "Pricing: Solo $399/mo, Team $999/mo, Enterprise custom.",
      "Refunds within 7 days of purchase, no questions asked.",
      "Free trial is 14 days. No credit card required.",
      "Support hours: Mon-Fri 9am-6pm IST.",
      "Escalation email: support@hireregent.com",
    ].join(" "),
    tone: "Professional, concise, engineering-focused. No fluff. Answer directly.",
    agent_name: "Knight",
    handoff_email: "support@hireregent.com",
    escalation_triggers: ["refund", "cancel", "speak to human", "manager", "legal", "lawsuit"],
  },
  {
    business_id: "luna_bakery",
    business_name: "Luna's Bakery",
    phone_number: "15550002",
    policy: [
      "Custom cakes require 48 hours advance notice.",
      "No refunds on perishable food items.",
      "Store hours: 8 AM – 6 PM, closed Sundays.",
      "Delivery available within 5km for orders above ₹500.",
      "Menu and pricing: luna-bakery.com/menu",
    ].join(" "),
    tone: "Warm, friendly, enthusiastic about food. Use occasional 🍰 emojis. Keep it casual.",
    agent_name: "Luna",
    handoff_email: "orders@luna.com",
    escalation_triggers: ["refund", "allergic", "food poisoning", "sick", "complaint", "manager"],
  },
  {
    business_id: "apex_motors",
    business_name: "Apex Motors",
    phone_number: "15550003",
    policy: [
      "Test drives by appointment only — book at apexmotors.com/book.",
      "Service center open Mon-Sat 9am-7pm.",
      "Warranty: 3 years / 50,000 km on all new vehicles.",
      "EMI options available through partner banks.",
      "For insurance claims, contact claims@apexmotors.com.",
    ].join(" "),
    tone: "Professional but approachable. Knowledgeable about cars. Confident.",
    agent_name: "Alex",
    handoff_email: "sales@apexmotors.com",
    escalation_triggers: ["accident", "recall", "legal", "refund", "manager", "complaint"],
  },
];

// ── DEFAULT FALLBACK ────────────────────────
const DEFAULT_CONFIG = {
  business_id: "unknown",
  business_name: "Support",
  phone_number: "",
  policy: "You are a general customer support agent. Be helpful and polite. If you cannot help, ask the customer to email support for further assistance.",
  tone: "Friendly, professional, helpful.",
  agent_name: "Knight",
  handoff_email: "",
  escalation_triggers: ["manager", "human", "speak to someone"],
};

// ── EXTRACT FROM WEBHOOK ────────────────────
// Meta WhatsApp webhook structure:
// payload.entry[0].changes[0].value.metadata.display_phone_number
// payload.entry[0].changes[0].value.messages[0].from  (customer number)
// payload.entry[0].changes[0].value.messages[0].text.body  (message)
// payload.entry[0].changes[0].value.contacts[0].profile.name  (customer name)

const webhook = $input.first().json;

// Handle both direct body and nested structures
const entry = webhook.entry?.[0] || webhook;
const changes = entry.changes?.[0];
const value = changes?.value || webhook;
const metadata = value.metadata || {};
const messages = value.messages || [];
const contacts = value.contacts || [];

// If no messages, this is a status update — pass through
if (!messages.length) {
  return [{ json: { skip: true, reason: "No messages in payload (likely a status update)" } }];
}

const message = messages[0];
const incomingNumber = metadata.display_phone_number?.replace(/\D/g, "") || "";
const customerPhone = message.from || "";
const customerMessage = message.text?.body || message.caption || "[Media message]";
const customerName = contacts[0]?.profile?.name || "there";
const messageId = message.id || "";
const messageType = message.type || "text";
const phoneNumberId = metadata.phone_number_id || "";

// ── THE LOOKUP ──────────────────────────────
// Match business by phone number (strip non-digits for safe comparison)
const bizConfig = BRAIN.find(
  (b) => b.phone_number.replace(/\D/g, "") === incomingNumber
) || DEFAULT_CONFIG;

// ── ESCALATION CHECK ────────────────────────
const msgLower = customerMessage.toLowerCase();
const needsEscalation = bizConfig.escalation_triggers.some((trigger) =>
  msgLower.includes(trigger.toLowerCase())
);

// ── BUILD OUTPUT ────────────────────────────
return [{
  json: {
    // Routing info
    skip: false,
    business_id: bizConfig.business_id,
    business_name: bizConfig.business_name,
    matched: bizConfig.business_id !== "unknown",

    // Customer info
    customer_phone: customerPhone,
    customer_name: customerName,
    customer_message: customerMessage,
    message_id: messageId,
    message_type: messageType,

    // WhatsApp reply info (needed to send response back)
    phone_number_id: phoneNumberId,

    // Injected business config for the AI agent
    policy: bizConfig.policy,
    tone: bizConfig.tone,
    agent_name: bizConfig.agent_name,
    handoff_email: bizConfig.handoff_email,

    // Escalation
    needs_escalation: needsEscalation,
    escalation_email: needsEscalation ? bizConfig.handoff_email : null,
  },
}];

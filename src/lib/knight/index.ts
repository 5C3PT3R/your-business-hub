/**
 * The Knight - Omni-channel Customer Success Agent
 *
 * Export all Knight services for easy importing
 */

// AI Service - Sentiment analysis and response generation
export {
  analyzeSentiment,
  generateResponse,
  searchKnowledge,
  processMessage,
  getPersonaPrompt,
  formatConversationHistory,
  type SentimentAnalysis,
  type KnightResponse,
  type KnowledgeContext,
} from '../knight-ai-service';

// Ticket Service - Ticket CRUD and management
export {
  createTicket,
  addMessage,
  getTickets,
  getTicketDetail,
  updateTicketStatus,
  getKnightConfig,
  updateKnightConfig,
  getKnightStats,
  findOpenTicket,
  getMessageCount,
  subscribeToTickets,
  subscribeToMessages,
  type Ticket,
  type TicketMessage,
  type TicketDetail,
  type KnightConfig,
  type KnightStats,
  type CreateTicketParams,
} from '../knight-ticket-service';

// Channel Service - Multi-channel message routing
export {
  handleIncomingMessage,
  handleSocialMention,
  handleEmailMessage,
  handleWhatsAppMessage,
  parseSocialWebhook,
  parseOutlookWebhook,
  parseWhatsAppWebhook,
  getChannelInfo,
  type IncomingMessage,
  type ChannelResponse,
  type SocialWebhookPayload,
  type OutlookWebhookPayload,
  type WhatsAppWebhookPayload,
} from '../knight-channel-service';

// Knowledge Base Service - RAG support
export {
  addKnowledgeEntry,
  updateKnowledgeEntry,
  deleteKnowledgeEntry,
  getKnowledgeEntries,
  searchKnowledge as searchKnowledgeBase,
  bulkImportKnowledge,
  getKnowledgeStats,
  type KnowledgeEntry,
  type KnowledgeSearchResult,
  type CreateKnowledgeParams,
} from '../knight-knowledge-service';

// Vapi Voice Service - Voice escalation
export {
  initiateVoiceCall,
  getCallStatus,
  configureVapiAssistant,
  shouldEscalateToVoice,
  extractPhoneNumber,
  getDefaultVoiceConfig,
  type VapiCallParams,
  type VapiCallResult,
  type VapiAssistantConfig,
} from '../knight-vapi-service';

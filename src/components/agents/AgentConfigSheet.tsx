/**
 * Agent Configuration Sheet - Configure AI Agent settings
 * Includes Personality, Rules, Knowledge Base, and Test Sandbox
 */

import { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot,
  Settings,
  Sparkles,
  FileText,
  MessageSquare,
  Plus,
  Trash2,
  Save,
  Upload,
  Send,
  Loader2,
  User,
  Zap,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { Agent, AgentConfig, getAgentTypeLabel } from '@/types/agents';
import { cn } from '@/lib/utils';

// Trigger options
const triggerOptions = [
  { value: 'new_lead', label: 'New Lead Created' },
  { value: 'email_received', label: 'Email Received' },
  { value: 'deal_stage_changed', label: 'Deal Stage Changed' },
  { value: 'meeting_scheduled', label: 'Meeting Scheduled' },
  { value: 'lead_score_changed', label: 'Lead Score Changed' },
  { value: 'contact_inactive', label: 'Contact Inactive (7 days)' },
  { value: 'task_due', label: 'Task Due' },
  { value: 'form_submitted', label: 'Form Submitted' },
];

// Action options
const actionOptions = [
  { value: 'send_email', label: 'Send Email' },
  { value: 'create_task', label: 'Create Task' },
  { value: 'update_lead_status', label: 'Update Lead Status' },
  { value: 'book_meeting', label: 'Book Meeting' },
  { value: 'add_note', label: 'Add Note' },
  { value: 'assign_owner', label: 'Assign Owner' },
  { value: 'update_deal_stage', label: 'Update Deal Stage' },
  { value: 'send_slack', label: 'Send Slack Message' },
];

// Tone options
const toneOptions = [
  { value: 'professional', label: 'Professional', description: 'Formal and business-like' },
  { value: 'friendly', label: 'Friendly', description: 'Warm and approachable' },
  { value: 'casual', label: 'Casual', description: 'Relaxed and conversational' },
  { value: 'assertive', label: 'Assertive', description: 'Confident and direct' },
];

interface Rule {
  id: string;
  trigger: string;
  condition: string;
  action: string;
  enabled: boolean;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AgentConfigSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
  onSave: (config: Partial<AgentConfig> & { isActive?: boolean; triggers?: string[] }) => Promise<void>;
}

export function AgentConfigSheet({
  open,
  onOpenChange,
  agent,
  onSave,
}: AgentConfigSheetProps) {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('personality');

  // Personality state
  const [agentName, setAgentName] = useState('');
  const [tone, setTone] = useState('professional');
  const [greeting, setGreeting] = useState('');
  const [signature, setSignature] = useState('');
  const [isActive, setIsActive] = useState(false);

  // Rules state
  const [rules, setRules] = useState<Rule[]>([]);

  // Triggers state
  const [triggers, setTriggers] = useState<string[]>([]);

  // Knowledge base state (mock)
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  // Test sandbox state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [testInput, setTestInput] = useState('');
  const [isTestLoading, setIsTestLoading] = useState(false);

  // Load agent config when agent changes
  useEffect(() => {
    if (agent) {
      const config = agent.config as AgentConfig;
      setAgentName(config?.name || agent.name);
      setTone(config?.tone || 'professional');
      setGreeting(config?.greeting || '');
      setSignature(config?.signature || '');
      setIsActive(agent.status === 'active');
      setRules(config?.rules || []);
      setTriggers(config?.triggers || []);
      setUploadedFiles(config?.knowledgeBase || []);
      setChatMessages([]);
    }
  }, [agent]);

  // Add new rule
  const addRule = () => {
    setRules([
      ...rules,
      {
        id: Date.now().toString(),
        trigger: 'new_lead',
        condition: '',
        action: 'send_email',
        enabled: true,
      },
    ]);
  };

  // Update rule
  const updateRule = (id: string, updates: Partial<Rule>) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  };

  // Delete rule
  const deleteRule = (id: string) => {
    setRules(rules.filter((r) => r.id !== id));
  };

  // Toggle trigger
  const toggleTrigger = (trigger: string) => {
    if (triggers.includes(trigger)) {
      setTriggers(triggers.filter((t) => t !== trigger));
    } else {
      setTriggers([...triggers, trigger]);
    }
  };

  // Mock file upload
  const handleFileUpload = () => {
    const fileName = `document-${Date.now()}.pdf`;
    setUploadedFiles([...uploadedFiles, fileName]);
  };

  // Mock test chat
  const handleSendTest = async () => {
    if (!testInput.trim()) return;

    const userMessage = testInput.trim();
    setChatMessages([...chatMessages, { role: 'user', content: userMessage }]);
    setTestInput('');
    setIsTestLoading(true);

    // Simulate AI response
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const responses: Record<string, string> = {
      professional: `Thank you for your inquiry. I'd be happy to assist you with that. Based on your request, I recommend we schedule a brief call to discuss your specific needs and how our solutions can address them. Would you be available for a 15-minute call this week?`,
      friendly: `Hey there! Thanks for reaching out! 😊 That's a great question. Let me help you out with that - I think we've got exactly what you're looking for. Want to hop on a quick call to chat about it?`,
      casual: `Sure thing! So basically, what you're looking for is... yeah, we can totally do that. Let me know when works for you and we'll figure it out together.`,
      assertive: `I understand exactly what you need. Here's what I recommend: Let's schedule a demo call where I can show you precisely how this works. I have availability tomorrow at 2 PM or Thursday at 10 AM. Which works better for you?`,
    };

    setChatMessages((prev) => [
      ...prev,
      { role: 'assistant', content: responses[tone] || responses.professional },
    ]);
    setIsTestLoading(false);
  };

  // Save configuration
  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        name: agentName,
        tone,
        greeting,
        signature,
        rules,
        triggers,
        knowledgeBase: uploadedFiles,
        isActive,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  if (!agent) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-[600px] p-0 flex flex-col">
        <SheetHeader className="p-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            <div>
              <SheetTitle>{agent.name}</SheetTitle>
              <SheetDescription>{getAgentTypeLabel(agent.agent_type)}</SheetDescription>
            </div>
          </div>
          <div className="flex items-center justify-between pt-4">
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <span className="text-sm text-muted-foreground">
                {isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Changes
            </Button>
          </div>
        </SheetHeader>

        <Separator className="mt-6" />

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="mx-6 mt-4 grid grid-cols-4">
            <TabsTrigger value="personality" className="text-xs">
              <Settings className="h-3 w-3 mr-1" />
              Personality
            </TabsTrigger>
            <TabsTrigger value="rules" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Rules
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="text-xs">
              <FileText className="h-3 w-3 mr-1" />
              Knowledge
            </TabsTrigger>
            <TabsTrigger value="test" className="text-xs">
              <MessageSquare className="h-3 w-3 mr-1" />
              Test
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1">
            {/* Personality Tab */}
            <TabsContent value="personality" className="p-6 space-y-6">
              <div className="space-y-2">
                <Label htmlFor="agent-name">Display Name</Label>
                <Input
                  id="agent-name"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Enter agent name"
                />
              </div>

              <div className="space-y-2">
                <Label>Tone</Label>
                <div className="grid grid-cols-2 gap-3">
                  {toneOptions.map((option) => (
                    <div
                      key={option.value}
                      onClick={() => setTone(option.value)}
                      className={cn(
                        'p-3 rounded-lg border cursor-pointer transition-colors',
                        tone === option.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      )}
                    >
                      <p className="font-medium text-sm">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="greeting">Greeting Message</Label>
                <Textarea
                  id="greeting"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Hi! I'm here to help..."
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  This message is used when the agent initiates a conversation.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signature">Email Signature</Label>
                <Textarea
                  id="signature"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Best regards,&#10;[Agent Name]"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Active Triggers</Label>
                <div className="flex flex-wrap gap-2">
                  {triggerOptions.map((trigger) => (
                    <Badge
                      key={trigger.value}
                      variant={triggers.includes(trigger.value) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleTrigger(trigger.value)}
                    >
                      {trigger.label}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Select events that will activate this agent.
                </p>
              </div>
            </TabsContent>

            {/* Rules Tab */}
            <TabsContent value="rules" className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Automation Rules</h3>
                  <p className="text-sm text-muted-foreground">
                    Define "If This, Then That" logic
                  </p>
                </div>
                <Button size="sm" onClick={addRule}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Rule
                </Button>
              </div>

              {rules.length === 0 ? (
                <div className="text-center py-8 border-2 border-dashed rounded-lg">
                  <Zap className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-muted-foreground">No rules defined yet</p>
                  <Button size="sm" variant="outline" className="mt-2" onClick={addRule}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create First Rule
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {rules.map((rule, index) => (
                    <div
                      key={rule.id}
                      className={cn(
                        'p-4 rounded-lg border',
                        rule.enabled ? 'bg-card' : 'bg-muted/50 opacity-60'
                      )}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-medium">Rule {index + 1}</span>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={rule.enabled}
                            onCheckedChange={(v) => updateRule(rule.id, { enabled: v })}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => deleteRule(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-12">If</span>
                          <Select
                            value={rule.trigger}
                            onValueChange={(v) => updateRule(rule.id, { trigger: v })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {triggerOptions.map((t) => (
                                <SelectItem key={t.value} value={t.value}>
                                  {t.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-12">When</span>
                          <Input
                            placeholder="e.g., Lead Score > 80"
                            value={rule.condition}
                            onChange={(e) => updateRule(rule.id, { condition: e.target.value })}
                            className="flex-1"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground w-12">Then</span>
                          <Select
                            value={rule.action}
                            onValueChange={(v) => updateRule(rule.id, { action: v })}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {actionOptions.map((a) => (
                                <SelectItem key={a.value} value={a.value}>
                                  {a.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Knowledge Base Tab */}
            <TabsContent value="knowledge" className="p-6 space-y-4">
              <div>
                <h3 className="font-medium">Knowledge Base</h3>
                <p className="text-sm text-muted-foreground">
                  Upload documents to train this agent on your specific content.
                </p>
              </div>

              <div
                onClick={handleFileUpload}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Click to upload documents (PDF, DOCX, TXT)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Max 10MB per file
                </p>
              </div>

              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  <Label>Uploaded Files</Label>
                  <div className="space-y-2">
                    {uploadedFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-3 rounded-lg border"
                      >
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{file}</span>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() =>
                            setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))
                          }
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">
                  <strong>Note:</strong> In production, uploaded documents will be processed and
                  indexed to provide contextual responses. Currently showing UI preview only.
                </p>
              </div>
            </TabsContent>

            {/* Test Sandbox Tab */}
            <TabsContent value="test" className="flex flex-col h-[500px]">
              <div className="p-6 pb-3">
                <h3 className="font-medium">Test Sandbox</h3>
                <p className="text-sm text-muted-foreground">
                  Chat with your agent to test its configuration before activating.
                </p>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-auto px-6 space-y-4">
                {chatMessages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Start a test conversation to see how your agent responds.
                    </p>
                  </div>
                ) : (
                  chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={cn(
                        'flex',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg p-3',
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          {message.role === 'user' ? (
                            <User className="h-3 w-3" />
                          ) : (
                            <Bot className="h-3 w-3" />
                          )}
                          <span className="text-xs font-medium">
                            {message.role === 'user' ? 'You' : agentName}
                          </span>
                        </div>
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  ))
                )}
                {isTestLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-3">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="p-6 pt-3 border-t">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendTest();
                  }}
                  className="flex gap-2"
                >
                  <Input
                    value={testInput}
                    onChange={(e) => setTestInput(e.target.value)}
                    placeholder="Type a test message..."
                    disabled={isTestLoading}
                  />
                  <Button type="submit" disabled={!testInput.trim() || isTestLoading}>
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

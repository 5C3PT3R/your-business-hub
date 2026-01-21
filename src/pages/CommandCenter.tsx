/**
 * Regent Command Center (UI Alpha)
 * Mission-critical dashboard for reviewing, editing, and approving autonomous agent actions.
 * Royal Industrial theme - High Contrast Dark Mode
 */

import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Shield,
  Check,
  X,
  Crown,
  Target,
  Building,
  User,
  Clock,
  BarChart3,
  Edit3,
  Send,
  Sparkles,
  ChevronRight,
  Search,
  Zap,
  Brain,
  Lock,
  FileText,
  Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fetchPendingDrafts, updateDraftStatus, sendDraftEmail, markDraftAsSent, DraftDisplayInfo } from '../lib/regent-service';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

// ============================================
// TYPES AND UTILITIES
// ============================================

type AgentType = 'ENVOY' | 'STEWARD';

interface IntelligenceDraft {
  id: string;
  target_name: string;
  target_company: string;
  target_email: string | null;
  email_subject: string | null;
  agent_type: AgentType;
  confidence_score: number;
  context_brief: string;
  draft_content: string;
  timestamp: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  tags: string[];
}

// Map database fields to UI fields
const mapDraftToIntelligence = (draft: DraftDisplayInfo): IntelligenceDraft => {
  // Determine agent type based on context or other logic
  // For now, we'll use a simple heuristic based on email subject
  const agentType: AgentType = draft.email_subject?.toLowerCase().includes('hire') ||
                               draft.email_subject?.toLowerCase().includes('job') ||
                               draft.email_subject?.toLowerCase().includes('opportunity')
                               ? 'STEWARD' : 'ENVOY';
  
  // Determine priority based on confidence score
  const priority: 'HIGH' | 'MEDIUM' | 'LOW' =
    (draft.confidence || 0) >= 90 ? 'HIGH' :
    (draft.confidence || 0) >= 75 ? 'MEDIUM' : 'LOW';
  
  // Extract tags from context or generate them
  const tags: string[] = [];
  if (draft.company) tags.push(draft.company);
  if (draft.title) tags.push(draft.title);
  if (draft.confidence && draft.confidence >= 90) tags.push('High Confidence');
  
  return {
    id: draft.id,
    target_name: draft.lead_name || 'Unknown Lead',
    target_company: draft.company || 'Unknown Company',
    target_email: draft.target_email,
    email_subject: draft.email_subject,
    agent_type: agentType,
    confidence_score: draft.confidence || 50,
    context_brief: draft.context || 'No context provided.',
    draft_content: draft.email_body || 'No email content.',
    timestamp: draft.created_at,
    priority,
    tags
  };
};

// ============================================
// COMPONENT
// ============================================

export default function CommandCenter() {
  const { toast } = useToast();
  const [drafts, setDrafts] = useState<IntelligenceDraft[]>([]);
  const [selectedDraft, setSelectedDraft] = useState<IntelligenceDraft | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgent, setFilterAgent] = useState<AgentType | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false); // Loading state for email sending

  // Fetch pending drafts from database
  useEffect(() => {
    const loadDrafts = async () => {
      try {
        setLoading(true);
        const pendingDrafts = await fetchPendingDrafts();
        const intelligenceDrafts = pendingDrafts.map(mapDraftToIntelligence);
        setDrafts(intelligenceDrafts);
        if (intelligenceDrafts.length > 0) {
          setSelectedDraft(intelligenceDrafts[0]);
        }
      } catch (error) {
        console.error('Failed to fetch drafts:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDrafts();
  }, []);

  // Initialize edited content when draft is selected
  useEffect(() => {
    if (selectedDraft) {
      setEditedContent(selectedDraft.draft_content);
    }
  }, [selectedDraft]);

  // Filter drafts based on search and agent type
  const filteredDrafts = drafts.filter(draft => {
    const matchesSearch = searchQuery === '' || 
      draft.target_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      draft.target_company.toLowerCase().includes(searchQuery.toLowerCase()) ||
      draft.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesAgent = filterAgent === 'ALL' || draft.agent_type === filterAgent;
    
    return matchesSearch && matchesAgent;
  });

  // Handle approval - SEND EMAIL FIRST, then update status
  const handleApprove = useCallback(async (draftId: string) => {
    // Find the draft to get email details
    const draft = drafts.find(d => d.id === draftId);
    if (!draft) {
      toast({
        title: 'Deployment Failed',
        description: 'Draft not found',
        variant: 'destructive',
      });
      return;
    }

    // Check if we have a target email
    if (!draft.target_email) {
      toast({
        title: 'Deployment Failed',
        description: 'No target email address. Add email to lead/contact metadata.',
        variant: 'destructive',
      });
      return;
    }

    setDeploying(true);
    console.log(`[REGENT] Deploying unit to: ${draft.target_email}`);

    try {
      // Step 1: Send the email via Edge Function
      const emailResult = await sendDraftEmail({
        id: draft.id,
        lead_name: draft.target_name,
        company: draft.target_company,
        title: null,
        confidence: draft.confidence_score,
        context: draft.context_brief,
        email_subject: draft.email_subject,
        email_body: editedContent || draft.draft_content, // Use edited content if modified
        target_email: draft.target_email,
        status: 'PENDING',
        created_at: draft.timestamp,
      });

      if (!emailResult.success) {
        console.error('[REGENT] Email deployment failed:', emailResult.error);

        toast({
          title: 'Deployment Failed',
          description: emailResult.error || 'Failed to send email. Check console for details.',
          variant: 'destructive',
        });
        setDeploying(false);
        return;
      }

      // Step 2: Mark the draft as SENT in the database
      const statusResult = await markDraftAsSent(draftId);

      if (statusResult.error) {
        console.error('[REGENT] Failed to update draft status:', statusResult.error);
        // Email was sent but status update failed - still show success but log warning
        toast({
          title: 'Unit Deployed',
          description: `Email sent to ${draft.target_email}. Warning: Status update failed.`,
        });
      } else {
        toast({
          title: 'Unit Deployed Successfully',
          description: `Email sent to ${draft.target_email}`,
        });
      }

      // Remove from local state
      setDrafts(prev => prev.filter(d => d.id !== draftId));

      // Auto-select next item if available
      const remaining = drafts.filter(d => d.id !== draftId);
      if (remaining.length > 0) {
        setSelectedDraft(remaining[0]);
      } else {
        setSelectedDraft(null);
      }

      console.log('[REGENT] Draft deployed successfully');
    } catch (error) {
      console.error('[REGENT] Error deploying draft:', error);
      toast({
        title: 'Deployment Failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
    } finally {
      setDeploying(false);
    }
  }, [drafts, editedContent, toast]);

  // Handle rejection
  const handleReject = useCallback(async (draftId: string) => {
    try {
      console.log(`Rejecting ID: ${draftId}`);
      const result = await updateDraftStatus(draftId, 'REJECTED');
      
      if (result.error) {
        console.error('Failed to reject draft:', result.error);
        return;
      }
      
      // Remove from local state
      setDrafts(prev => prev.filter(d => d.id !== draftId));
      
      // Auto-select next item if available
      const remaining = drafts.filter(d => d.id !== draftId);
      if (remaining.length > 0) {
        setSelectedDraft(remaining[0]);
      } else {
        setSelectedDraft(null);
      }
      
      console.log('Draft rejected successfully');
    } catch (error) {
      console.error('Error rejecting draft:', error);
    }
  }, [drafts]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!selectedDraft) return;
      
      // Ctrl/Cmd + Enter for approval
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleApprove(selectedDraft.id);
      }
      
      // Escape for rejection
      if (e.key === 'Escape') {
        e.preventDefault();
        handleReject(selectedDraft.id);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDraft, handleApprove, handleReject]);

  // Get agent icon and color - Royal Industrial theme
  const getAgentConfig = (type: AgentType) => {
    switch (type) {
      case 'ENVOY':
        return {
          icon: <Crown className="h-4 w-4" />,
          color: 'text-[#D4AF37]', // Muted Gold
          bgColor: 'bg-[#D4AF37]/10',
          borderColor: 'border-[#D4AF37]/30',
          label: 'Envoy',
          className: 'regent-agent-envoy'
        };
      case 'STEWARD':
        return {
          icon: <Shield className="h-4 w-4" />,
          color: 'text-[#10B981]', // Signal Green
          bgColor: 'bg-[#10B981]/10',
          borderColor: 'border-[#10B981]/30',
          label: 'Steward',
          className: 'regent-agent-steward'
        };
    }
  };

  // Format confidence score color - Royal Industrial theme
  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'text-[#10B981]'; // Signal Green
    if (score >= 80) return 'text-[#D4AF37]'; // Muted Gold
    return 'text-[#991B1B]'; // Crimson
  };

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Get priority badge - Royal Industrial theme
  const getPriorityBadge = (priority: 'HIGH' | 'MEDIUM' | 'LOW') => {
    switch (priority) {
      case 'HIGH':
        return <span className="regent-priority-high px-2 py-0.5 text-xs rounded-full font-mono uppercase tracking-wider">HIGH</span>;
      case 'MEDIUM':
        return <span className="regent-priority-medium px-2 py-0.5 text-xs rounded-full font-mono uppercase tracking-wider">MEDIUM</span>;
      case 'LOW':
        return <span className="regent-priority-low px-2 py-0.5 text-xs rounded-full font-mono uppercase tracking-wider">LOW</span>;
    }
  };

  return (
    <MainLayout>
      <Header
        title={<span className="font-['Cinzel'] tracking-wider uppercase">Regent Command Center</span>}
        subtitle={<span className="font-mono text-[#C5C6C7]">{drafts.length} pending decree{drafts.length !== 1 ? 's' : ''} awaiting royal assent</span>}
        actions={
          <div className="flex items-center gap-2">
            <div className="regent-agent-envoy flex items-center gap-2 px-3 py-1.5 rounded-lg">
              <Crown className="h-4 w-4 text-[#D4AF37]" />
              <span className="text-sm font-medium text-[#D4AF37] font-['Cinzel'] tracking-wide uppercase">Royal Authority</span>
            </div>
            <div className="px-3 py-1.5 bg-[#1F2833] border border-[#D4AF37]/20 rounded-lg">
              <div className="flex items-center gap-2">
                <Lock className="h-3.5 w-3.5 text-[#C5C6C7]" />
                <span className="text-xs font-mono text-[#C5C6C7] tracking-wider">ALPHA v0.1</span>
              </div>
            </div>
          </div>
        }
      />

      <div className="flex-1 flex flex-col overflow-hidden bg-background relative">
        {/* Animated background gradients - Royal Industrial theme */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-amber-500/10 via-emerald-500/5 to-slate-500/5 dark:from-amber-500/20 dark:via-emerald-500/10 dark:to-slate-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-slate-500/10 via-amber-500/5 to-transparent dark:from-slate-500/15 dark:via-amber-500/10 rounded-full blur-3xl" />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-gradient-to-r from-emerald-500/5 to-amber-500/5 dark:from-emerald-500/10 dark:to-amber-500/10 rounded-full blur-2xl" />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden relative z-10">
          {/* Left Sidebar - The Queue */}
          <div className="w-[380px] lg:w-[420px] flex-shrink-0 border-r border-border flex flex-col">
            {/* Queue Header */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 font-['Cinzel'] tracking-wide uppercase">
                  <Target className="h-5 w-5 text-[#D4AF37]" />
                  Queue
                </h2>
                <div className="flex items-center gap-1 bg-background/50 border border-border rounded-lg p-1">
                  <Button
                    variant={filterAgent === 'ALL' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn("h-7 px-2 text-xs", filterAgent === 'ALL' && "bg-muted")}
                    onClick={() => setFilterAgent('ALL')}
                  >
                    All
                  </Button>
                  <Button
                    variant={filterAgent === 'ENVOY' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn("h-7 px-2 text-xs flex items-center gap-1",
                      filterAgent === 'ENVOY' && "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30")}
                    onClick={() => setFilterAgent('ENVOY')}
                  >
                    <Crown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant={filterAgent === 'STEWARD' ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn("h-7 px-2 text-xs flex items-center gap-1",
                      filterAgent === 'STEWARD' && "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30")}
                    onClick={() => setFilterAgent('STEWARD')}
                  >
                    <Shield className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  type="search"
                  placeholder="Search targets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 bg-background/50 border-border"
                />
              </div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-card/50 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total</span>
                    <span className="text-lg font-bold text-foreground">{drafts.length}</span>
                  </div>
                </div>
                <div className="bg-card/50 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Avg Confidence</span>
                    <span className="text-lg font-bold text-emerald-500">
                      {drafts.length > 0
                        ? Math.round(drafts.reduce((acc, d) => acc + d.confidence_score, 0) / drafts.length)
                        : 0}%
                    </span>
                  </div>
                </div>
                <div className="bg-card/50 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">High Priority</span>
                    <span className="text-lg font-bold text-amber-500">
                      {drafts.filter(d => d.priority === 'HIGH').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Queue List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <div className="h-12 w-12 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin mb-4"></div>
                  <p className="text-foreground font-medium">Loading intelligence...</p>
                  <p className="text-sm text-muted-foreground mt-1">Fetching pending drafts from database</p>
                </div>
              ) : filteredDrafts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                  <Target className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-foreground font-medium">No pending drafts</p>
                  <p className="text-sm text-muted-foreground mt-1">All intelligence has been reviewed</p>
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  {filteredDrafts.map((draft) => {
                    const agentConfig = getAgentConfig(draft.agent_type);
                    const isSelected = selectedDraft?.id === draft.id;
                    
                    return (
                      <div
                        key={draft.id}
                        className={cn(
                          "p-4 rounded-lg border cursor-pointer transition-all duration-200 group",
                          isSelected
                            ? "bg-card border-amber-500/30 border-l-4 border-l-amber-500 shadow-sm"
                            : "bg-card/50 border-border hover:bg-card hover:border-muted-foreground/30"
                        )}
                        onClick={() => setSelectedDraft(draft)}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              {agentConfig.icon}
                              <span className={cn("text-sm font-medium", agentConfig.color)}>
                                {agentConfig.label}
                              </span>
                              {getPriorityBadge(draft.priority)}
                            </div>
                            <h3 className="text-foreground font-semibold truncate">{draft.target_name}</h3>
                            <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                              <Building className="h-3 w-3" />
                              {draft.target_company}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <div className={cn("text-lg font-bold", getConfidenceColor(draft.confidence_score))}>
                              {draft.confidence_score}%
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {formatTimestamp(draft.timestamp)}
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {draft.tags.slice(0, 2).map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 text-xs bg-muted text-muted-foreground rounded">
                              {tag}
                            </span>
                          ))}
                          {draft.tags.length > 2 && (
                            <span className="px-2 py-0.5 text-xs bg-muted text-muted-foreground/70 rounded">
                              +{draft.tags.length - 2}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1">
                              <Circle className={cn("h-2 w-2", getConfidenceColor(draft.confidence_score))} />
                              <span className="text-xs text-muted-foreground">Confidence</span>
                            </div>
                          </div>
                          <ChevronRight className={cn(
                            "h-4 w-4 transition-transform",
                            isSelected ? "text-amber-500" : "text-muted-foreground group-hover:text-foreground"
                          )} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - The Decree */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {selectedDraft ? (
              <>
                {/* Intelligence Header */}
                <div className="p-6 border-b border-border">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-foreground flex items-center gap-2 font-['Cinzel'] tracking-wide uppercase">
                        <Brain className="h-5 w-5 text-[#D4AF37]" />
                        Intelligence Brief
                      </h2>
                      <p className="text-sm text-muted-foreground mt-1">Context for human review</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {getPriorityBadge(selectedDraft.priority)}
                      <div className={cn(
                        "px-3 py-1.5 rounded-lg flex items-center gap-2",
                        getAgentConfig(selectedDraft.agent_type).bgColor,
                        getAgentConfig(selectedDraft.agent_type).borderColor,
                        "border"
                      )}>
                        {getAgentConfig(selectedDraft.agent_type).icon}
                        <span className={cn("text-sm font-medium", getAgentConfig(selectedDraft.agent_type).color)}>
                          {getAgentConfig(selectedDraft.agent_type).label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Target Email Card */}
                  {selectedDraft.target_email && (
                    <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4 text-[#10B981]" />
                        <span className="text-sm text-muted-foreground">Sending to:</span>
                        <span className="text-sm font-medium text-[#10B981]">{selectedDraft.target_email}</span>
                      </div>
                    </div>
                  )}

                  {/* Email Subject */}
                  {selectedDraft.email_subject && (
                    <div className="bg-card/50 border border-border rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-[#D4AF37]" />
                        <span className="text-sm text-muted-foreground">Subject:</span>
                        <span className="text-sm font-medium text-foreground">{selectedDraft.email_subject}</span>
                      </div>
                    </div>
                  )}

                  <div className="bg-card/50 border border-border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                      </div>
                      <div>
                        <p className="text-foreground text-sm leading-relaxed">{selectedDraft.context_brief}</p>
                        <div className="flex flex-wrap items-center gap-4 mt-3">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{selectedDraft.target_name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Building className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{selectedDraft.target_company}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            <span className={cn("text-sm font-medium", getConfidenceColor(selectedDraft.confidence_score))}>
                              {selectedDraft.confidence_score}% confidence
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* The Editor */}
                <div className="flex-1 flex flex-col p-6 overflow-hidden">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-2 font-['Cinzel'] tracking-wide uppercase">
                      <Edit3 className="h-5 w-5 text-[#10B981]" />
                      Email Body
                    </h2>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                      <span>Editable</span>
                      <span className="mx-2">|</span>
                      <span>{editedContent.length} characters</span>
                    </div>
                  </div>
                  <div className="flex-1 bg-card/50 border border-border rounded-lg overflow-hidden min-h-0">
                    <textarea
                      className="w-full h-full bg-transparent text-foreground text-sm p-4 resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      value={editedContent}
                      onChange={(e) => setEditedContent(e.target.value)}
                      spellCheck={true}
                      placeholder="Email body will appear here..."
                    />
                  </div>
                </div>

                {/* Action Bar */}
                <div className="border-t border-border p-4 bg-background/80 backdrop-blur-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-[#C5C6C7] flex items-center gap-2">
                        <Zap className="h-4 w-4 text-[#D4AF37]" />
                        <span className="font-mono">Keyboard shortcuts:</span>
                        <kbd className="regent-kbd">Ctrl/Cmd + Enter</kbd>
                        <span className="text-[#10B981]">to approve</span>
                        <kbd className="regent-kbd">Esc</kbd>
                        <span className="text-[#991B1B]">to discard</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button
                        size="lg"
                        className="regent-discard gap-2 px-6 py-3 bg-[#991B1B] hover:bg-[#7F1D1D] text-white disabled:opacity-50"
                        onClick={() => selectedDraft && handleReject(selectedDraft.id)}
                        disabled={deploying}
                      >
                        <X className="h-5 w-5" />
                        DISCARD
                      </Button>
                      <Button
                        size="lg"
                        className="regent-assent gap-2 px-6 py-3 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white disabled:opacity-50"
                        onClick={() => selectedDraft && handleApprove(selectedDraft.id)}
                        disabled={deploying}
                      >
                        {deploying ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            DEPLOYING UNIT...
                          </>
                        ) : (
                          <>
                            <Check className="h-5 w-5" />
                            GRANT ASSENT
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                <div className="h-24 w-24 rounded-full bg-card border border-border flex items-center justify-center mb-6">
                  <Crown className="h-12 w-12 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2 font-['Cinzel'] tracking-wide uppercase">No Selection</h3>
                <p className="text-muted-foreground max-w-md">
                  Select an intelligence draft from the queue to begin review. Each item represents an autonomous agent action awaiting your royal assent.
                </p>
                <div className="mt-6 p-4 bg-card/50 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                      <Crown className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Envoy Agent</p>
                      <p className="text-xs text-muted-foreground">Sales & outreach intelligence</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                      <Shield className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Steward Agent</p>
                      <p className="text-xs text-muted-foreground">Hiring & talent intelligence</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

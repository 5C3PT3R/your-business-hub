/**
 * V1 MODE: Single Sales CRM, conversation-first.
 * Deal detail shows only essential fields.
 * Activity = Conversation in user-facing UI.
 * AI insights displayed with summary, key points, and stage change evidence.
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building, DollarSign, Loader2, Save, MessageSquare, Plus, Brain, Sparkles, TrendingUp, Copy, Check, AlertTriangle, Clock, TrendingDown, Minus } from 'lucide-react';
import { useDeals, Deal, DealStage } from '@/hooks/useDeals';
import { useActivities, parseAISummary, AIAnalysis } from '@/hooks/useActivities';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

// V1: Stages are locked - not editable
const stages: { id: DealStage; name: string }[] = [
  { id: 'lead', name: 'Lead' },
  { id: 'qualified', name: 'Qualified' },
  { id: 'proposal', name: 'Proposal' },
  { id: 'closed', name: 'Closed' },
];

const intentColors = {
  low: 'bg-muted text-muted-foreground',
  medium: 'bg-warning/20 text-warning-foreground border-warning/50',
  high: 'bg-success/20 text-success-foreground border-success/50',
};

// Health score color coding
const getHealthScoreColor = (score: number = 50) => {
  if (score >= 80) return 'text-green-600 bg-green-50 border-green-200';
  if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
  return 'text-red-600 bg-red-50 border-red-200';
};

function AIInsightsCard({ analysis, stageChanged }: { analysis: AIAnalysis; stageChanged?: boolean }) {
  const confidencePercent = Math.round(analysis.confidence * 100);
  const [copied, setCopied] = useState(false);

  const handleCopyFollowUp = async () => {
    if (analysis.follow_up_message) {
      await navigator.clipboard.writeText(analysis.follow_up_message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  return (
    <div className="mt-3 space-y-3">
      {/* AI Summary */}
      <div className="p-3 rounded-md bg-primary/5 border border-primary/10">
        <div className="flex items-center gap-2 mb-2">
          <Brain className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-primary">AI Summary</span>
          <Badge variant="outline" className={intentColors[analysis.intent_level]}>
            {analysis.intent_level} intent
          </Badge>
        </div>
        <p className="text-sm text-foreground">{analysis.summary}</p>
      </div>

      {/* Stage Change Notice - Agent 8: Explainability */}
      {stageChanged && analysis.confidence >= 0.7 && analysis.recommended_stage !== 'closed' && (
        <div className="p-3 rounded-md bg-success/10 border border-success/30">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-success">
              AI updated deal stage → {analysis.recommended_stage.charAt(0).toUpperCase() + analysis.recommended_stage.slice(1)}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mb-2">
            Why AI did this:
          </div>
          {analysis.evidence_quote && (
            <blockquote className="text-sm text-foreground italic border-l-2 border-success/50 pl-3">
              "{analysis.evidence_quote}"
            </blockquote>
          )}
          <div className="mt-2 flex items-center gap-2">
            <TrendingUp className="h-3 w-3 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              Confidence: {confidencePercent}%
            </span>
          </div>
        </div>
      )}

      {/* Agent 4: Suggested Follow-Up Message */}
      {analysis.follow_up_message && (
        <div className="p-3 rounded-md bg-primary/5 border border-primary/20">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">Suggested Follow-Up</span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleCopyFollowUp}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              <span className="ml-1 text-xs">{copied ? 'Copied' : 'Copy'}</span>
            </Button>
          </div>
          <p className="text-sm text-foreground italic">"{analysis.follow_up_message}"</p>
        </div>
      )}

      {/* Key Points */}
      {analysis.key_points && analysis.key_points.length > 0 && (
        <div className="p-3 rounded-md bg-muted/50">
          <p className="text-xs font-medium text-muted-foreground mb-2">Key Points</p>
          <ul className="list-disc list-inside space-y-1">
            {analysis.key_points.map((point, idx) => (
              <li key={idx} className="text-sm text-foreground">{point}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Next Actions */}
      {analysis.next_actions && analysis.next_actions.length > 0 && (
        <div className="p-3 rounded-md bg-muted/50">
          <p className="text-xs font-medium text-muted-foreground mb-2">Suggested Next Actions</p>
          <ul className="space-y-1">
            {analysis.next_actions.map((action, idx) => (
              <li key={idx} className="text-sm text-foreground flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {action.action}
                {action.due_in_days > 0 && (
                  <span className="text-xs text-muted-foreground">
                    (in {action.due_in_days} days)
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDealById, updateDeal } = useDeals();
  const { activities, loading: activitiesLoading, addActivity, fetchActivities } = useActivities(id);
  const { toast } = useToast();
  
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConversation, setSavingConversation] = useState(false);
  
  // V1: Simplified form - only essential fields
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    value: '',
    stage: 'lead' as DealStage,
  });

  const [conversationText, setConversationText] = useState('');
  const [conversationError, setConversationError] = useState('');

  useEffect(() => {
    const loadDeal = async () => {
      if (!id) return;
      setLoading(true);
      const data = await getDealById(id);
      if (data) {
        setDeal(data);
        setFormData({
          title: data.title,
          company: data.company || '',
          value: data.value.toString(),
          stage: data.stage,
        });
      }
      setLoading(false);
    };
    loadDeal();
  }, [id]);

  // Refresh activities periodically to catch AI updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Only refresh if there are unprocessed activities
      const hasUnprocessed = activities.some(a => !a.ai_processed);
      if (hasUnprocessed) {
        fetchActivities();
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [activities, fetchActivities]);

  const handleSave = async () => {
    if (!id || !formData.title) return;
    
    setSaving(true);
    const result = await updateDeal(id, {
      title: formData.title,
      company: formData.company || null,
      value: parseFloat(formData.value) || 0,
      stage: formData.stage,
    });
    setSaving(false);
    
    if (result) {
      toast({
        title: "Deal updated",
        description: "Your changes have been saved.",
      });
    }
  };

  const handleSaveConversation = async () => {
    const trimmedText = conversationText.trim();
    if (!trimmedText) {
      setConversationError('Conversation text cannot be empty.');
      return;
    }

    if (!id) {
      setConversationError('No deal selected.');
      return;
    }

    setConversationError('');
    setSavingConversation(true);

    const result = await addActivity({
      type: 'conversation',
      description: 'Conversation added',
      raw_text: trimmedText,
      related_deal_id: id,
    });

    setSavingConversation(false);

    if (result) {
      setConversationText('');
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!deal) {
    return (
      <MainLayout>
        <div className="p-6">
          <Button variant="ghost" onClick={() => navigate('/deals')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pipeline
          </Button>
          <div className="flex flex-col items-center justify-center h-[50vh] text-center">
            <h2 className="text-xl font-semibold text-foreground mb-2">Deal not found</h2>
            <p className="text-muted-foreground">This deal may have been deleted or doesn't exist.</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6 relative overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Animated background gradients */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-500/20 via-purple-500/15 to-pink-500/10 dark:from-blue-500/30 dark:via-purple-500/20 dark:to-pink-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/15 via-blue-500/10 to-transparent dark:from-cyan-500/20 dark:via-blue-500/15 rounded-full blur-3xl" />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-gradient-to-r from-violet-500/10 to-fuchsia-500/5 dark:from-violet-500/15 dark:to-fuchsia-500/10 rounded-full blur-2xl" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-in">
          <Button variant="ghost" size="sm" onClick={() => navigate('/deals')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Pipeline
          </Button>
        </div>

        {/* Deal Header */}
        <div className="animate-slide-up">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-semibold text-foreground">{deal.title}</h1>
              <p className="text-muted-foreground">{deal.company || 'No company'}</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Deal Value</p>
                <p className="text-2xl font-bold text-foreground">${deal.value.toLocaleString()}</p>
              </div>
              <Badge variant="outline" className={cn('text-lg px-4 py-2 font-bold border-2', getHealthScoreColor(deal.health_score ?? 50))}>
                {deal.health_score ?? 50}
              </Badge>
            </div>
          </div>
        </div>

        {/* AI Health Analysis Card */}
        <Card className="animate-slide-up" style={{ animationDelay: '50ms' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Health Analysis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Key Metrics Grid */}
            <div className="grid grid-cols-3 gap-4">
              {/* Days in Stage */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Days in Stage</span>
                </div>
                <p className="text-2xl font-semibold text-foreground mb-1">{deal.days_in_stage ?? 0}</p>
                {(deal.days_in_stage ?? 0) > 14 && (
                  <Badge variant="destructive" className="text-xs">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Stagnant
                  </Badge>
                )}
              </div>

              {/* Sentiment */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  {deal.sentiment_trend === 'positive' ? <TrendingUp className="h-4 w-4 text-green-600" /> :
                   deal.sentiment_trend === 'negative' ? <TrendingDown className="h-4 w-4 text-red-600" /> :
                   <Minus className="h-4 w-4 text-muted-foreground" />}
                  <span className="text-sm text-muted-foreground">Sentiment</span>
                </div>
                <p className="text-lg font-semibold capitalize text-foreground">
                  {deal.sentiment_trend || 'neutral'}
                </p>
              </div>

              {/* Last Activity */}
              <div className="p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Last Activity</span>
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {deal.last_activity_at
                    ? format(new Date(deal.last_activity_at), 'MMM d, yyyy')
                    : 'No activity yet'}
                </p>
              </div>
            </div>

            {/* Risk Factors */}
            {deal.ai_risk_factors && deal.ai_risk_factors.length > 0 && (
              <div className="p-4 rounded-lg border-2 border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="font-semibold text-destructive">Risk Factors</span>
                </div>
                <ul className="space-y-2">
                  {deal.ai_risk_factors.map((risk, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive mt-2 flex-shrink-0" />
                      <span className="text-sm text-foreground">{risk}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Next Actions */}
            {deal.ai_next_actions && deal.ai_next_actions.length > 0 && (
              <div className="p-4 rounded-lg border-2 border-primary/30 bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-semibold text-primary">Suggested Next Actions</span>
                </div>
                <ul className="space-y-2">
                  {deal.ai_next_actions.map((action, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span className="text-sm text-foreground">{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* V1: Simplified Edit Form - essential fields only */}
        <Card className="animate-slide-up" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <CardTitle className="text-lg">Deal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Deal title"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="Company name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="stage">Stage</Label>
                <Select 
                  value={formData.stage} 
                  onValueChange={(value) => setFormData({ ...formData, stage: value as DealStage })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select stage" />
                  </SelectTrigger>
                  <SelectContent>
                    {stages.map((stage) => (
                      <SelectItem key={stage.id} value={stage.id}>
                        {stage.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="value">Deal Value ($)</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="value"
                    type="number"
                    value={formData.value}
                    onChange={(e) => setFormData({ ...formData, value: e.target.value })}
                    placeholder="0"
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Add Conversation */}
        <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Conversation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Textarea
                value={conversationText}
                onChange={(e) => {
                  setConversationText(e.target.value);
                  if (conversationError) setConversationError('');
                }}
                placeholder="Paste call transcript, meeting notes, or chat here…"
                className="min-h-[150px] resize-y"
              />
              {conversationError && (
                <p className="text-sm text-destructive">{conversationError}</p>
              )}
            </div>
            <div className="flex justify-end">
              <Button 
                onClick={handleSaveConversation} 
                disabled={savingConversation}
              >
                {savingConversation ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="mr-2 h-4 w-4" />
                )}
                Save Conversation
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Conversations */}
        <Card className="animate-slide-up" style={{ animationDelay: '250ms' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activitiesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No conversations yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a conversation above to start tracking.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => {
                  const aiAnalysis = parseAISummary(activity.ai_summary);
                  const isProcessing = !activity.ai_processed && activity.raw_text;
                  
                  return (
                    <div
                      key={activity.id}
                      className="rounded-lg border border-border bg-card p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <MessageSquare className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground">
                            Conversation
                          </span>
                          {isProcessing && (
                            <Badge variant="outline" className="text-xs">
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              AI analyzing...
                            </Badge>
                          )}
                          {activity.ai_processed && aiAnalysis && (
                            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                              <Brain className="h-3 w-3 mr-1" />
                              AI analyzed
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                        </span>
                      </div>
                      
                      {activity.raw_text && (
                        <div className="mt-3 p-3 rounded-md bg-muted/50 text-sm text-foreground whitespace-pre-wrap max-h-48 overflow-y-auto">
                          {activity.raw_text}
                        </div>
                      )}
                      
                      {/* AI Insights */}
                      {aiAnalysis && activity.ai_processed && (
                        <AIInsightsCard 
                          analysis={aiAnalysis} 
                          stageChanged={aiAnalysis.confidence >= 0.7 && aiAnalysis.recommended_stage !== 'closed'}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Building, DollarSign, Loader2, Save, Clock, MessageSquare, Plus } from 'lucide-react';
import { useDeals, Deal, DealStage } from '@/hooks/useDeals';
import { useActivities } from '@/hooks/useActivities';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

const stages: { id: DealStage; name: string }[] = [
  { id: 'lead', name: 'Lead' },
  { id: 'qualified', name: 'Qualified' },
  { id: 'proposal', name: 'Proposal' },
  { id: 'closed', name: 'Closed' },
];

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getDealById, updateDeal } = useDeals();
  const { activities, loading: activitiesLoading, addActivity } = useActivities(id);
  const { toast } = useToast();
  
  const [deal, setDeal] = useState<Deal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConversation, setSavingConversation] = useState(false);
  
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
    // Validation
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
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
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
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{deal.title}</h1>
              <p className="text-muted-foreground">{deal.company || 'No company'}</p>
            </div>
          </div>
        </div>

        {/* Edit Form */}
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
        <Card className="animate-slide-up" style={{ animationDelay: '150ms' }}>
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

        {/* Activity Timeline */}
        <Card className="animate-slide-up" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Activity Timeline
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
                  <Clock className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No activities yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Add a conversation above to start tracking activity.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((activity) => (
                  <div
                    key={activity.id}
                    className="rounded-lg border border-border bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-primary" />
                        <span className="font-medium text-foreground capitalize">
                          {activity.type}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    {activity.raw_text && (
                      <div className="mt-3 p-3 rounded-md bg-muted/50 text-sm text-foreground whitespace-pre-wrap">
                        {activity.raw_text}
                      </div>
                    )}
                    {activity.ai_summary && (
                      <div className="mt-3 p-3 rounded-md bg-primary/5 border border-primary/10">
                        <p className="text-xs font-medium text-primary mb-1">AI Summary</p>
                        <p className="text-sm text-foreground">{activity.ai_summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

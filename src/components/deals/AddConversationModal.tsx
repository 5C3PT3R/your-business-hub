import { useState } from 'react';
import { Deal, DealStage } from '@/hooks/useDeals';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, MessageSquare } from 'lucide-react';

interface AddConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  deals: Deal[];
  onAddConversation: (dealId: string, rawText: string) => Promise<boolean>;
  onCreateDealWithConversation: (dealTitle: string, company: string, rawText: string) => Promise<boolean>;
}

export function AddConversationModal({
  open,
  onOpenChange,
  deals,
  onAddConversation,
  onCreateDealWithConversation,
}: AddConversationModalProps) {
  const [conversationText, setConversationText] = useState('');
  const [selectedDealId, setSelectedDealId] = useState<string>('');
  const [createNewDeal, setCreateNewDeal] = useState(false);
  const [newDealTitle, setNewDealTitle] = useState('');
  const [newDealCompany, setNewDealCompany] = useState('');
  const [saving, setSaving] = useState(false);
  
  const [errors, setErrors] = useState({
    conversationText: '',
    dealSelection: '',
    newDealTitle: '',
  });

  const resetForm = () => {
    setConversationText('');
    setSelectedDealId('');
    setCreateNewDeal(false);
    setNewDealTitle('');
    setNewDealCompany('');
    setErrors({ conversationText: '', dealSelection: '', newDealTitle: '' });
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validate = (): boolean => {
    const newErrors = {
      conversationText: '',
      dealSelection: '',
      newDealTitle: '',
    };

    const trimmedText = conversationText.trim();
    if (!trimmedText) {
      newErrors.conversationText = 'Conversation text cannot be empty.';
    }

    if (createNewDeal) {
      if (!newDealTitle.trim()) {
        newErrors.newDealTitle = 'Deal title is required when creating a new deal.';
      }
    } else if (!selectedDealId) {
      newErrors.dealSelection = 'Please select a deal or choose to create a new one.';
    }

    setErrors(newErrors);
    return !newErrors.conversationText && !newErrors.dealSelection && !newErrors.newDealTitle;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSaving(true);
    let success = false;

    if (createNewDeal) {
      success = await onCreateDealWithConversation(
        newDealTitle.trim(),
        newDealCompany.trim(),
        conversationText.trim()
      );
    } else {
      success = await onAddConversation(selectedDealId, conversationText.trim());
    }

    setSaving(false);

    if (success) {
      handleClose();
    }
  };

  const handleDealChange = (value: string) => {
    if (value === 'create_new') {
      setCreateNewDeal(true);
      setSelectedDealId('');
    } else {
      setCreateNewDeal(false);
      setSelectedDealId(value);
    }
    setErrors(prev => ({ ...prev, dealSelection: '', newDealTitle: '' }));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Add Conversation
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* Conversation Text */}
          <div className="space-y-2">
            <Label htmlFor="conversation-text">Conversation *</Label>
            <Textarea
              id="conversation-text"
              value={conversationText}
              onChange={(e) => {
                setConversationText(e.target.value);
                if (errors.conversationText) {
                  setErrors(prev => ({ ...prev, conversationText: '' }));
                }
              }}
              placeholder="Paste call transcript, meeting notes, or chat here…"
              className="min-h-[150px] resize-y"
            />
            {errors.conversationText && (
              <p className="text-sm text-destructive">{errors.conversationText}</p>
            )}
          </div>

          {/* Deal Selection */}
          <div className="space-y-2">
            <Label htmlFor="deal-select">Link to Deal *</Label>
            <Select 
              value={createNewDeal ? 'create_new' : selectedDealId} 
              onValueChange={handleDealChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a deal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="create_new" className="font-medium text-primary">
                  + Create new deal from this conversation
                </SelectItem>
                {deals.map((deal) => (
                  <SelectItem key={deal.id} value={deal.id}>
                    {deal.title} {deal.company ? `(${deal.company})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.dealSelection && (
              <p className="text-sm text-destructive">{errors.dealSelection}</p>
            )}
          </div>

          {/* New Deal Fields */}
          {createNewDeal && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/50 border border-border">
              <div className="space-y-2">
                <Label htmlFor="new-deal-title">Deal Title *</Label>
                <Input
                  id="new-deal-title"
                  value={newDealTitle}
                  onChange={(e) => {
                    setNewDealTitle(e.target.value);
                    if (errors.newDealTitle) {
                      setErrors(prev => ({ ...prev, newDealTitle: '' }));
                    }
                  }}
                  placeholder="Enter deal title"
                />
                {errors.newDealTitle && (
                  <p className="text-sm text-destructive">{errors.newDealTitle}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-deal-company">Company (optional)</Label>
                <Input
                  id="new-deal-company"
                  value={newDealCompany}
                  onChange={(e) => setNewDealCompany(e.target.value)}
                  placeholder="Enter company name"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-2">
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <MessageSquare className="mr-2 h-4 w-4" />
              )}
              Save Conversation
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

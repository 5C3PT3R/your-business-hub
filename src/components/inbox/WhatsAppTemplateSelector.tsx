import { useState } from 'react';
import { WhatsAppTemplate } from '@/types/inbox';
import { useWhatsAppTemplates } from '@/hooks/useSocialConnections';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  MessageCircle,
  FileText,
  Image,
  Video,
  File,
  Send,
  AlertCircle,
  Clock,
} from 'lucide-react';

interface WhatsAppTemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connectionId: string;
  recipientName?: string;
  onSendTemplate: (template: WhatsAppTemplate, variables: Record<string, string>) => void;
}

const headerTypeIcons = {
  text: FileText,
  image: Image,
  video: Video,
  document: File,
};

const categoryColors = {
  utility: 'bg-blue-100 text-blue-700',
  marketing: 'bg-purple-100 text-purple-700',
  authentication: 'bg-green-100 text-green-700',
};

export function WhatsAppTemplateSelector({
  open,
  onOpenChange,
  connectionId,
  recipientName,
  onSendTemplate,
}: WhatsAppTemplateSelectorProps) {
  const { templates, loading } = useWhatsAppTemplates(connectionId);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'select' | 'fill'>('select');

  const handleSelectTemplate = (template: WhatsAppTemplate) => {
    setSelectedTemplate(template);
    // Initialize variables with empty strings
    const initialVars: Record<string, string> = {};
    template.variables.forEach((v) => {
      initialVars[v.name] = '';
    });
    setVariables(initialVars);
    if (template.variables.length > 0) {
      setStep('fill');
    } else {
      // No variables, can send directly
      onSendTemplate(template, {});
      handleClose();
    }
  };

  const handleSend = () => {
    if (!selectedTemplate) return;
    onSendTemplate(selectedTemplate, variables);
    handleClose();
  };

  const handleClose = () => {
    setSelectedTemplate(null);
    setVariables({});
    setStep('select');
    onOpenChange(false);
  };

  const previewBody = () => {
    if (!selectedTemplate) return '';
    let body = selectedTemplate.bodyText;
    Object.entries(variables).forEach(([key, value]) => {
      body = body.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`);
    });
    return body;
  };

  const allVariablesFilled = selectedTemplate?.variables.every(
    (v) => variables[v.name]?.trim()
  ) ?? true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            {step === 'select' ? 'Select a Template' : 'Fill in Variables'}
          </DialogTitle>
          <DialogDescription>
            {step === 'select' ? (
              <>The 24-hour messaging window has expired. Select an approved template to start a new conversation.</>
            ) : (
              <>Fill in the template variables to personalize your message.</>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Session Expired Warning */}
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800">
          <Clock className="h-4 w-4" />
          <span className="text-sm">
            WhatsApp requires using a pre-approved template when the 24-hour session has expired.
          </span>
        </div>

        {step === 'select' ? (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 rounded-full border-2 border-green-600 border-t-transparent animate-spin" />
              </div>
            ) : templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                <p>No approved templates available.</p>
                <p className="text-sm">Create templates in your WhatsApp Business Manager.</p>
              </div>
            ) : (
              templates.map((template) => {
                const HeaderIcon = template.headerType
                  ? headerTypeIcons[template.headerType]
                  : null;

                return (
                  <div
                    key={template.id}
                    onClick={() => handleSelectTemplate(template)}
                    className={cn(
                      'p-4 rounded-lg border-2 cursor-pointer transition-all',
                      selectedTemplate?.id === template.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-border hover:border-green-300 hover:bg-green-50/50'
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {HeaderIcon && <HeaderIcon className="h-4 w-4 text-muted-foreground" />}
                        <h4 className="font-medium">{template.name}</h4>
                      </div>
                      <Badge className={cn('text-xs', categoryColors[template.category])}>
                        {template.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.bodyText}
                    </p>
                    {template.variables.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {template.variables.map((v) => (
                          <span
                            key={v.name}
                            className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground"
                          >
                            {`{{${v.name}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Variable inputs */}
            <div className="space-y-3">
              {selectedTemplate?.variables.map((variable) => (
                <div key={variable.name} className="space-y-1">
                  <Label htmlFor={variable.name} className="text-sm">
                    {variable.name}
                    <span className="text-xs text-muted-foreground ml-2">
                      (e.g., {variable.example})
                    </span>
                  </Label>
                  <Input
                    id={variable.name}
                    value={variables[variable.name] || ''}
                    onChange={(e) =>
                      setVariables({ ...variables, [variable.name]: e.target.value })
                    }
                    placeholder={variable.example}
                  />
                </div>
              ))}
            </div>

            {/* Preview */}
            <div className="p-4 bg-muted/50 rounded-lg">
              <p className="text-xs font-medium text-muted-foreground mb-2">Preview:</p>
              <div className="bg-green-100 rounded-lg p-3 max-w-[80%]">
                {selectedTemplate?.headerText && (
                  <p className="font-medium text-sm mb-1">{selectedTemplate.headerText}</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{previewBody()}</p>
                {selectedTemplate?.footerText && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedTemplate.footerText}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-4 border-t">
          {step === 'fill' && (
            <Button variant="ghost" onClick={() => setStep('select')}>
              Back
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {step === 'fill' && (
              <Button
                onClick={handleSend}
                disabled={!allVariablesFilled}
                className="bg-green-600 hover:bg-green-700"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Template
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Inline session warning component for the message composer
interface SessionExpiredBannerProps {
  onOpenTemplates: () => void;
}

export function SessionExpiredBanner({ onOpenTemplates }: SessionExpiredBannerProps) {
  return (
    <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
      <div className="flex items-center gap-2 text-amber-800">
        <Clock className="h-4 w-4" />
        <span className="text-sm">
          24-hour session expired. Use a template to continue the conversation.
        </span>
      </div>
      <Button
        size="sm"
        onClick={onOpenTemplates}
        className="bg-green-600 hover:bg-green-700"
      >
        <MessageCircle className="h-4 w-4 mr-2" />
        Start New Conversation
      </Button>
    </div>
  );
}

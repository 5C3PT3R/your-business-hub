import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, User, Target, GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AGENT_PERSONAS, getPersona } from '@/lib/agent-personas';
import { supabase } from '@/integrations/supabase/client';

interface RunScoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedLeadIds: string[];
  workspaceId: string;
  userId: string;
}

type PersonaKey = 'FRIENDLY_FOUNDER' | 'DIRECT_SALES' | 'HELPFUL_TEACHER';

const PERSONA_ICONS: Record<PersonaKey, React.ReactNode> = {
  FRIENDLY_FOUNDER: <User className="h-5 w-5" />,
  DIRECT_SALES: <Target className="h-5 w-5" />,
  HELPFUL_TEACHER: <GraduationCap className="h-5 w-5" />,
};

const PERSONA_DISPLAY_NAMES: Record<PersonaKey, string> = {
  FRIENDLY_FOUNDER: 'Friendly Founder',
  DIRECT_SALES: 'Direct Sales',
  HELPFUL_TEACHER: 'Helpful Teacher',
};

export function RunScoutModal({
  open,
  onOpenChange,
  selectedLeadIds,
  workspaceId,
  userId,
}: RunScoutModalProps) {
  const [selectedPersona, setSelectedPersona] = useState<PersonaKey>('FRIENDLY_FOUNDER');
  const [context, setContext] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Load saved context from localStorage on mount
  useEffect(() => {
    const savedContext = localStorage.getItem('scout_context');
    if (savedContext) {
      setContext(savedContext);
    }
  }, []);

  // Save context to localStorage whenever it changes
  useEffect(() => {
    if (context.trim()) {
      localStorage.setItem('scout_context', context);
    }
  }, [context]);

  const handleLaunchScout = async () => {
    if (selectedLeadIds.length === 0) {
      toast({
        title: 'No leads selected',
        description: 'Please select at least one lead to run the scout.',
        variant: 'destructive',
      });
      return;
    }

    if (!context.trim()) {
      toast({
        title: 'Context required',
        description: 'Please provide context about what you are offering.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      // Call the SDR Agent Brain Edge Function
      const { data, error } = await supabase.functions.invoke('sdr-agent-brain', {
        body: {
          leadIds: selectedLeadIds,
          personaKey: selectedPersona,
          userContext: context,
          workspaceId,
          userId,
        },
      });

      if (error) {
        throw new Error(error.message || 'Failed to invoke scout agent');
      }

      if (!data.success) {
        throw new Error(data.error || 'Scout agent failed to generate drafts');
      }

      toast({
        title: 'Scout launched successfully!',
        description: `Scout is drafting ${data.drafts?.length || selectedLeadIds.length} emails... Check the Approvals tab.`,
      });

      // Close the modal
      onOpenChange(false);
    } catch (error) {
      console.error('Error launching scout:', error);
      toast({
        title: 'Failed to launch scout',
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const personaKeys: PersonaKey[] = ['FRIENDLY_FOUNDER', 'DIRECT_SALES', 'HELPFUL_TEACHER'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Run AI Scout
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Persona Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Step 1: Choose AI Persona</Label>
            <div className="grid grid-cols-3 gap-3">
              {personaKeys.map((personaKey) => {
                const persona = getPersona(personaKey);
                const isSelected = selectedPersona === personaKey;
                
                return (
                  <Card
                    key={personaKey}
                    variant={isSelected ? 'glow' : 'default'}
                    className={cn(
                      'cursor-pointer transition-all duration-200 p-4',
                      isSelected
                        ? 'border-primary ring-2 ring-primary/20'
                        : 'hover:border-primary/50 hover:shadow-md'
                    )}
                    onClick={() => setSelectedPersona(personaKey)}
                  >
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className={cn(
                        'p-2 rounded-full',
                        isSelected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      )}>
                        {PERSONA_ICONS[personaKey]}
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">{PERSONA_DISPLAY_NAMES[personaKey]}</h4>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {persona.description.split('.')[0]}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Step 2: Context */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="context" className="text-sm font-medium">
                Step 2: What are you offering?
              </Label>
              <span className="text-xs text-muted-foreground">
                Saved to localStorage
              </span>
            </div>
            <Textarea
              id="context"
              placeholder="Example: We help SaaS companies automate their customer onboarding with AI-powered workflows. Our platform reduces manual work by 80% and improves customer satisfaction scores..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="min-h-[120px] resize-none"
            />
            <p className="text-xs text-muted-foreground">
              This context will be used by the AI to personalize emails for each lead.
            </p>
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-muted/50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Ready to launch</p>
                <p className="text-sm text-muted-foreground">
                  {selectedLeadIds.length} selected lead{selectedLeadIds.length !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{PERSONA_DISPLAY_NAMES[selectedPersona]}</p>
                <p className="text-xs text-muted-foreground">AI Persona</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="gradient"
            onClick={handleLaunchScout}
            disabled={isLoading || selectedLeadIds.length === 0}
            className="gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Launching Scout...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Launch Scout
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
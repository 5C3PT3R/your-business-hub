import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Bot, 
  Send, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Sparkles,
  RotateCcw
} from 'lucide-react';
import { useAgent } from '@/hooks/useAgent';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ActionCard } from './ActionCard';
import { PlannedAction } from '@/types/agent';
import { cn } from '@/lib/utils';

interface AgentPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentPopup({ open, onOpenChange }: AgentPopupProps) {
  const [instruction, setInstruction] = useState('');
  const [rejectedActions, setRejectedActions] = useState<string[]>([]);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  
  const { workspace, template } = useWorkspace();
  const { 
    isLoading, 
    response, 
    executedActions, 
    sendInstruction, 
    executeAction,
    executeAllApproved,
    clearResponse 
  } = useAgent();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isLoading) return;
    
    setRejectedActions([]);
    await sendInstruction(instruction);
  };

  const handleApprove = async (action: PlannedAction) => {
    setExecutingAction(action.action);
    await executeAction(action);
    setExecutingAction(null);
  };

  const handleReject = (action: PlannedAction) => {
    setRejectedActions(prev => [...prev, action.action]);
  };

  const handleExecuteAll = async () => {
    if (!response) return;
    const actionsToExecute = response.planned_actions.filter(
      a => !rejectedActions.includes(a.action) && !executedActions.includes(a.action)
    );
    for (const action of actionsToExecute) {
      await handleApprove(action);
    }
  };

  const handleReset = () => {
    setInstruction('');
    setRejectedActions([]);
    clearResponse();
  };

  const pendingActions = response?.planned_actions.filter(
    a => !rejectedActions.includes(a.action) && !executedActions.includes(a.action)
  ) || [];

  const hasHighConfidenceActions = pendingActions.some(a => a.confidence >= 0.85);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Bot className="h-5 w-5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg">AI Ops Agent</DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-xs">
                    {template?.name || 'CRM'}
                  </Badge>
                  <span className={cn(
                    "h-2 w-2 rounded-full",
                    isLoading ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
                  )} />
                  <span className="text-xs text-muted-foreground">
                    {isLoading ? 'Processing...' : 'Ready'}
                  </span>
                </div>
              </div>
            </div>
            {response && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          {!response && !isLoading && (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 mx-auto text-primary/50 mb-4" />
              <h3 className="font-medium mb-2">What can I help you with?</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Describe what you want to do and I'll suggest the right actions to take.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {template?.id === 'sales' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Follow up with all qualified leads')}>
                      Follow up leads
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Move stale deals forward')}>
                      Update deals
                    </Button>
                  </>
                )}
                {template?.id === 'real_estate' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Schedule site visits for hot clients')}>
                      Schedule visits
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Match properties to clients')}>
                      Match properties
                    </Button>
                  </>
                )}
                {template?.id === 'ecommerce' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Escalate tickets near SLA breach')}>
                      Handle SLA
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Process pending refunds')}>
                      Process refunds
                    </Button>
                  </>
                )}
                {template?.id === 'insurance' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Flag suspicious claims for review')}>
                      Review claims
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Send renewal reminders')}>
                      Renewals
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">Analyzing your request...</p>
            </div>
          )}

          {response && (
            <div className="space-y-4">
              {/* Agent Message */}
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm">{response.agent_message}</p>
                {response.summary && (
                  <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                    {response.summary}
                  </p>
                )}
              </div>

              {/* Actions */}
              {response.planned_actions.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium">Planned Actions</h4>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {executedActions.length}
                        <XCircle className="h-3 w-3 text-rose-500 ml-1" />
                        {rejectedActions.length}
                      </div>
                    </div>
                    
                    {response.planned_actions.map((action, index) => (
                      <ActionCard
                        key={`${action.action}-${index}`}
                        action={action}
                        onApprove={() => handleApprove(action)}
                        onReject={() => handleReject(action)}
                        isExecuted={executedActions.includes(action.action)}
                        isExecuting={executingAction === action.action}
                      />
                    ))}
                  </div>
                </>
              )}

              {response.planned_actions.length === 0 && (
                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No actions suggested.</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="border-t px-6 py-4 space-y-3">
          {pendingActions.length > 0 && (
            <Button 
              className="w-full" 
              onClick={handleExecuteAll}
              disabled={isLoading || executingAction !== null}
            >
              {executingAction ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Execute {pendingActions.length} Action{pendingActions.length > 1 ? 's' : ''}
                  {hasHighConfidenceActions && ' (Auto-approved)'}
                </>
              )}
            </Button>
          )}
          
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              placeholder="Tell me what to do..."
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !instruction.trim()}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
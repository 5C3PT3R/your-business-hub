/**
 * Feedback/Support Widget
 * Floating button that opens a feedback form
 * Captures bug reports, feature requests, and questions
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MessageCircleQuestion,
  Bug,
  Lightbulb,
  HelpCircle,
  Send,
  Loader2,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

type FeedbackType = 'bug' | 'feature' | 'question';

interface ConsoleError {
  message: string;
  timestamp: Date;
}

// Store last 5 console errors for debugging - captured on mount
const consoleErrors: ConsoleError[] = [];
let isErrorCapturingEnabled = false;
let originalConsoleError: typeof console.error | null = null;

// Enable error capturing (called on component mount)
function enableErrorCapturing() {
  if (isErrorCapturingEnabled) return;

  originalConsoleError = console.error;
  console.error = (...args) => {
    consoleErrors.push({
      message: args.map(a => String(a)).join(' '),
      timestamp: new Date(),
    });
    if (consoleErrors.length > 5) consoleErrors.shift();
    originalConsoleError?.apply(console, args);
  };
  isErrorCapturingEnabled = true;
}

// Disable error capturing (called on component unmount)
function disableErrorCapturing() {
  if (!isErrorCapturingEnabled || !originalConsoleError) return;

  console.error = originalConsoleError;
  originalConsoleError = null;
  isErrorCapturingEnabled = false;
}

const feedbackTypes: { value: FeedbackType; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'text-red-500' },
  { value: 'feature', label: 'Feature Request', icon: Lightbulb, color: 'text-yellow-500' },
  { value: 'question', label: 'Question', icon: HelpCircle, color: 'text-blue-500' },
];

export function FeedbackWidget() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('bug');
  const [message, setMessage] = useState('');
  const [includeDebugInfo, setIncludeDebugInfo] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Enable/disable error capturing on mount/unmount
  useEffect(() => {
    enableErrorCapturing();
    return () => disableErrorCapturing();
  }, []);

  // Reset success state when popover closes
  useEffect(() => {
    if (!isOpen) {
      setTimeout(() => {
        setIsSuccess(false);
        setMessage('');
      }, 300);
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      toast({
        title: 'Message required',
        description: 'Please describe your feedback.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Gather debug info if opted in
      let debugInfo = null;
      if (includeDebugInfo) {
        debugInfo = {
          url: window.location.href,
          userAgent: navigator.userAgent,
          screenSize: `${window.innerWidth}x${window.innerHeight}`,
          timestamp: new Date().toISOString(),
          consoleErrors: consoleErrors.slice(-5).map(e => ({
            message: e.message.substring(0, 500),
            timestamp: e.timestamp.toISOString(),
          })),
        };
      }

      // Save to database
      const db = supabase as any;
      const { error } = await db
        .from('feedback')
        .insert({
          user_id: user?.id,
          type: feedbackType,
          message: message.trim(),
          debug_info: debugInfo,
          status: 'new',
          created_at: new Date().toISOString(),
        });

      if (error) {
        // If table doesn't exist, just log to console
        if (error.code === '42P01') {
          console.log('Feedback (table not created):', {
            type: feedbackType,
            message: message.trim(),
            debugInfo,
          });
        } else {
          throw error;
        }
      }

      // Optional: Send to Slack webhook
      const slackWebhook = import.meta.env.VITE_SLACK_WEBHOOK_URL;
      if (slackWebhook) {
        try {
          await fetch(slackWebhook, {
            method: 'POST',
            body: JSON.stringify({
              text: `*New ${feedbackType}* from ${user?.email || 'Anonymous'}`,
              blocks: [
                {
                  type: 'section',
                  text: {
                    type: 'mrkdwn',
                    text: `*New ${feedbackType.toUpperCase()}*\n${message.trim()}`,
                  },
                },
                {
                  type: 'context',
                  elements: [
                    {
                      type: 'mrkdwn',
                      text: `User: ${user?.email || 'Anonymous'} | URL: ${window.location.href}`,
                    },
                  ],
                },
              ],
            }),
          });
        } catch (slackError) {
          console.warn('Failed to send to Slack:', slackError);
        }
      }

      setIsSuccess(true);
      toast({
        title: 'Feedback submitted',
        description: 'Thank you! We\'ll review your feedback soon.',
      });

      setTimeout(() => {
        setIsOpen(false);
      }, 1500);

    } catch (error) {
      console.error('Failed to submit feedback:', error);
      toast({
        title: 'Submission failed',
        description: 'Unable to submit feedback. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const SelectedIcon = feedbackTypes.find(t => t.value === feedbackType)?.icon || Bug;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          className={cn(
            'fixed bottom-20 md:bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg',
            'bg-primary hover:bg-primary/90',
            'transition-all hover:scale-105'
          )}
        >
          <MessageCircleQuestion className="h-5 w-5" />
          <span className="sr-only">Send Feedback</span>
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="top"
        align="end"
        className="w-80 p-0"
        sideOffset={8}
      >
        {isSuccess ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="font-semibold">Thank you!</h3>
            <p className="text-sm text-muted-foreground">Your feedback has been submitted.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-semibold">Send Feedback</h3>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-4">
              {/* Type selector */}
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={feedbackType} onValueChange={(v) => setFeedbackType(v as FeedbackType)}>
                  <SelectTrigger>
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        <SelectedIcon className={cn('h-4 w-4', feedbackTypes.find(t => t.value === feedbackType)?.color)} />
                        {feedbackTypes.find(t => t.value === feedbackType)?.label}
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {feedbackTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <SelectItem key={type.value} value={type.value}>
                          <div className="flex items-center gap-2">
                            <Icon className={cn('h-4 w-4', type.color)} />
                            {type.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label>What happened?</Label>
                <Textarea
                  placeholder={
                    feedbackType === 'bug'
                      ? 'Describe the bug and steps to reproduce...'
                      : feedbackType === 'feature'
                      ? 'Describe the feature you\'d like...'
                      : 'What would you like to know?'
                  }
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="min-h-[100px] resize-none"
                />
              </div>

              {/* Debug info checkbox */}
              <div className="flex items-center gap-2">
                <Checkbox
                  id="debug-info"
                  checked={includeDebugInfo}
                  onCheckedChange={(checked) => setIncludeDebugInfo(!!checked)}
                />
                <Label htmlFor="debug-info" className="text-sm text-muted-foreground cursor-pointer">
                  Include URL and console logs
                </Label>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t bg-muted/30">
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={isSubmitting || !message.trim()}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit Feedback
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default FeedbackWidget;

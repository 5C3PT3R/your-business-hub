import React, { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Square, X, Phone, PhoneCall, Loader2, CheckCircle2, Calendar, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CallAnalysis {
  summary: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  followUps: Array<{
    description: string;
    suggestedDate: string | null;
    suggestedTime: string | null;
    rawText: string;
  }>;
  actionItems: string[];
  keyTopics: string[];
  nextSteps: string;
}

interface DialerRecorderProps {
  leadId: string;
  leadName?: string;
  leadCompany?: string;
  leadPhone?: string;
  onCallComplete: (transcription: string, analysis: CallAnalysis, durationSeconds: number) => void;
  onScheduleFollowUp?: (followUp: { description: string; suggestedDate: string | null; suggestedTime: string | null }) => void;
  className?: string;
}

export function DialerRecorder({ 
  leadId,
  leadName, 
  leadCompany, 
  leadPhone,
  onCallComplete, 
  onScheduleFollowUp,
  className 
}: DialerRecorderProps) {
  const {
    isRecording,
    isTranscribing,
    isAnalyzing,
    formattedDuration,
    recordingDuration,
    lastAnalysis,
    startRecording,
    stopRecording,
    cancelRecording
  } = useVoiceRecorder();

  const { toast } = useToast();
  const [followUpToSchedule, setFollowUpToSchedule] = useState<any>(null);
  const [callState, setCallState] = useState<'idle' | 'connecting' | 'ringing' | 'connected' | 'ended'>('idle');
  const [twilioCallSid, setTwilioCallSid] = useState<string | null>(null);
  const callStatusIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (callStatusIntervalRef.current) {
        clearInterval(callStatusIntervalRef.current);
      }
    };
  }, []);

  // Initiate Twilio call when component mounts
  useEffect(() => {
    if (callState === 'idle' && leadPhone) {
      initiateCall();
    }
  }, []);

  const checkCallStatus = async (callSid: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('twilio-status', {
        body: { callSid },
      });

      if (error) {
        console.error('Error checking call status:', error);
        return;
      }

      console.log('Call status:', data?.status);

      if (data?.status === 'in-progress' && callState !== 'connected') {
        // Call is now connected - start recording
        setCallState('connected');
        if (!isRecording) {
          startRecording();
        }
        toast({
          title: 'Call Connected',
          description: `Connected to ${leadName || leadPhone}`,
        });
      } else if (data?.status === 'ringing' && callState !== 'ringing') {
        setCallState('ringing');
      } else if (['completed', 'busy', 'no-answer', 'canceled', 'failed'].includes(data?.status)) {
        // Call ended - stop recording
        if (callStatusIntervalRef.current) {
          clearInterval(callStatusIntervalRef.current);
        }
        if (isRecording) {
          handleEndCall();
        } else {
          setCallState('ended');
          toast({
            title: 'Call Ended',
            description: `Call status: ${data?.status}`,
          });
        }
      }
    } catch (error) {
      console.error('Error checking call status:', error);
    }
  };

  const initiateCall = async () => {
    if (!leadPhone) {
      toast({
        title: 'No Phone Number',
        description: 'This lead does not have a phone number.',
        variant: 'destructive',
      });
      return;
    }

    setCallState('connecting');

    try {
      // Call Twilio edge function to initiate the call
      const { data, error } = await supabase.functions.invoke('twilio-call', {
        body: {
          to: leadPhone,
          leadName,
          leadId,
        },
      });

      if (error) throw error;

      if (data?.callId) {
        setTwilioCallSid(data.callId);
        setCallState('ringing');
        
        // Start polling for call status
        callStatusIntervalRef.current = setInterval(() => {
          checkCallStatus(data.callId);
        }, 2000);
        
        toast({
          title: 'Calling...',
          description: `Dialing ${leadName || leadPhone}`,
        });
      } else {
        throw new Error(data?.error || 'Failed to initiate call');
      }
    } catch (error) {
      console.error('Error initiating call:', error);
      setCallState('idle');
      toast({
        title: 'Call Failed',
        description: error instanceof Error ? error.message : 'Could not connect the call',
        variant: 'destructive',
      });
    }
  };

  const handleEndCall = async () => {
    // Stop polling
    if (callStatusIntervalRef.current) {
      clearInterval(callStatusIntervalRef.current);
    }
    
    const duration = recordingDuration;
    const result = await stopRecording(leadName, leadCompany);
    setCallState('ended');
    
    if (result.transcription && result.analysis) {
      onCallComplete(result.transcription, result.analysis, duration);
      
      // If there are follow-ups, prompt user to schedule
      if (result.analysis.followUps?.length > 0) {
        setFollowUpToSchedule(result.analysis.followUps[0]);
      }
    }
  };

  const handleCancelCall = async () => {
    // Stop polling
    if (callStatusIntervalRef.current) {
      clearInterval(callStatusIntervalRef.current);
    }
    cancelRecording();
    setCallState('idle');
  };

  const handleScheduleFollowUp = () => {
    if (followUpToSchedule && onScheduleFollowUp) {
      onScheduleFollowUp(followUpToSchedule);
    }
    setFollowUpToSchedule(null);
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <ThumbsUp className="h-4 w-4 text-success" />;
      case 'negative': return <ThumbsDown className="h-4 w-4 text-destructive" />;
      default: return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'bg-success/10 text-success border-success/20';
      case 'negative': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  // Analyzing state
  if (isAnalyzing) {
    return (
      <div className={cn("flex flex-col items-center gap-4 p-6", className)}>
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Analyzing your call...</p>
        <p className="text-xs text-muted-foreground">Detecting sentiment & follow-ups</p>
      </div>
    );
  }

  // Transcribing state
  if (isTranscribing) {
    return (
      <div className={cn("flex flex-col items-center gap-4 p-6", className)}>
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Transcribing your call...</p>
        <p className="text-xs text-muted-foreground">Hindi + English auto-detect</p>
      </div>
    );
  }

  // Show analysis results if available
  if (lastAnalysis && callState === 'ended') {
    return (
      <div className={cn("flex flex-col gap-4 p-4", className)}>
        <Card>
          <CardContent className="pt-4 space-y-4">
            {/* Summary */}
            <div>
              <h4 className="text-sm font-medium mb-1">Call Summary</h4>
              <p className="text-sm text-muted-foreground">{lastAnalysis.summary}</p>
            </div>

            {/* Sentiment */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Sentiment:</span>
              <Badge variant="outline" className={getSentimentColor(lastAnalysis.sentiment)}>
                {getSentimentIcon(lastAnalysis.sentiment)}
                <span className="ml-1 capitalize">{lastAnalysis.sentiment}</span>
              </Badge>
            </div>

            {/* Follow-ups */}
            {lastAnalysis.followUps?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Follow-ups Detected
                </h4>
                <div className="space-y-2">
                  {lastAnalysis.followUps.map((followUp: any, i: number) => (
                    <div key={i} className="text-sm p-2 rounded bg-muted/50">
                      <p>{followUp.description}</p>
                      <p className="text-xs text-muted-foreground italic">"{followUp.rawText}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {lastAnalysis.actionItems?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Action Items</h4>
                <ul className="text-sm space-y-1">
                  {lastAnalysis.actionItems.map((item: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 mt-1 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="pt-2 text-xs text-muted-foreground text-center">
              Call saved to lead history
            </div>
          </CardContent>
        </Card>

        {/* Follow-up scheduling dialog */}
        <AlertDialog open={!!followUpToSchedule} onOpenChange={() => setFollowUpToSchedule(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Schedule Follow-up?
              </AlertDialogTitle>
              <AlertDialogDescription>
                {leadName && `${leadName} mentioned: `}"{followUpToSchedule?.rawText}"
                <br /><br />
                Would you like to schedule this as a task?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Skip</AlertDialogCancel>
              <AlertDialogAction onClick={handleScheduleFollowUp}>
                Schedule Task
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // Connected/Recording state - active call UI
  if (callState === 'connected' && isRecording) {
    return (
      <div className={cn("flex flex-col items-center gap-4 p-4", className)}>
        {/* Active Call Animation */}
        <div className="relative">
          {/* Pulse rings */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-32 w-32 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-28 w-28 rounded-full bg-emerald-500/30 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.5s' }} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-24 w-24 rounded-full bg-emerald-500/40 animate-ping" style={{ animationDuration: '1s', animationDelay: '0.25s' }} />
          </div>
          
          {/* Main button */}
          <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <PhoneCall className="h-8 w-8 text-white animate-pulse" />
          </div>
        </div>

        {/* Duration */}
        <div className="text-center">
          <p className="text-2xl font-mono font-bold text-emerald-500">{formattedDuration}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {leadName ? `On call with ${leadName}` : 'Call in progress...'}
          </p>
          {leadPhone && (
            <p className="text-xs text-muted-foreground">{leadPhone}</p>
          )}
        </div>

        {/* Recording indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span>Recording</span>
        </div>

        {/* Controls */}
        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            size="lg"
            onClick={handleCancelCall}
            className="rounded-full h-14 w-14 p-0 border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <X className="h-6 w-6" />
          </Button>
          <Button
            size="lg"
            onClick={handleEndCall}
            className="rounded-full h-14 w-14 p-0 bg-red-500 hover:bg-red-600"
          >
            <Square className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">End Call</p>
      </div>
    );
  }

  // Ringing state
  if (callState === 'ringing') {
    return (
      <div className={cn("flex flex-col items-center gap-4 p-6", className)}>
        <div className="relative">
          {/* Ringing animation */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-28 w-28 rounded-full bg-amber-500/20 animate-ping" style={{ animationDuration: '1s' }} />
          </div>
          <div className="h-24 w-24 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Phone className="h-12 w-12 text-amber-500 animate-[shake_0.5s_ease-in-out_infinite]" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-medium">{leadName || 'Calling...'}</p>
          {leadPhone && <p className="text-sm text-muted-foreground">{leadPhone}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg">📞</span>
          <p className="text-sm text-amber-600 font-medium">Ringing...</p>
        </div>
        <Button variant="outline" onClick={handleCancelCall} className="mt-2 border-destructive text-destructive hover:bg-destructive/10">
          Cancel Call
        </Button>
      </div>
    );
  }

  // Connecting state
  if (callState === 'connecting') {
    return (
      <div className={cn("flex flex-col items-center gap-4 p-6", className)}>
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <Phone className="h-12 w-12 text-emerald-500 animate-bounce" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-medium">{leadName || 'Calling...'}</p>
          {leadPhone && <p className="text-sm text-muted-foreground">{leadPhone}</p>}
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Initiating call...</p>
        </div>
        <Button variant="outline" onClick={handleCancelCall} className="mt-2">
          Cancel
        </Button>
      </div>
    );
  }

  // Idle state - show call button
  return (
    <div className={cn("flex flex-col items-center gap-4 p-6", className)}>
      <div className="text-center mb-2">
        <p className="font-medium">{leadName || 'Unknown'}</p>
        {leadPhone ? (
          <p className="text-sm text-muted-foreground">{leadPhone}</p>
        ) : (
          <p className="text-sm text-destructive">No phone number</p>
        )}
      </div>

      <button
        onClick={initiateCall}
        disabled={!leadPhone}
        className={cn(
          "h-20 w-20 rounded-full flex items-center justify-center shadow-lg transition-all",
          leadPhone 
            ? "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 shadow-emerald-500/30 hover:scale-105 active:scale-95"
            : "bg-muted cursor-not-allowed"
        )}
      >
        <Phone className={cn("h-8 w-8", leadPhone ? "text-white" : "text-muted-foreground")} />
      </button>
      <p className="text-xs text-muted-foreground">
        {leadPhone ? "Tap to call" : "Add phone number to call"}
      </p>
    </div>
  );
}

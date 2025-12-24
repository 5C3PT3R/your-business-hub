import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Square, X, Phone, PhoneCall, Loader2, CheckCircle2, AlertCircle, Calendar, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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

interface DialerRecorderProps {
  leadName?: string;
  leadCompany?: string;
  leadPhone?: string;
  onTranscriptionComplete: (text: string, analysis: any) => void;
  onScheduleFollowUp?: (followUp: { description: string; suggestedDate: string | null; suggestedTime: string | null }) => void;
  className?: string;
}

export function DialerRecorder({ 
  leadName, 
  leadCompany, 
  leadPhone,
  onTranscriptionComplete, 
  onScheduleFollowUp,
  className 
}: DialerRecorderProps) {
  const {
    isRecording,
    isTranscribing,
    isAnalyzing,
    formattedDuration,
    lastAnalysis,
    startRecording,
    stopRecording,
    cancelRecording
  } = useVoiceRecorder();

  const [followUpToSchedule, setFollowUpToSchedule] = useState<any>(null);

  const handleStop = async () => {
    const result = await stopRecording(leadName, leadCompany);
    if (result.transcription && result.analysis) {
      onTranscriptionComplete(result.transcription, result.analysis);
      
      // If there are follow-ups, prompt user to schedule
      if (result.analysis.followUps?.length > 0) {
        setFollowUpToSchedule(result.analysis.followUps[0]);
      }
    }
  };

  const handleScheduleFollowUp = () => {
    if (followUpToSchedule && onScheduleFollowUp) {
      onScheduleFollowUp(followUpToSchedule);
    }
    setFollowUpToSchedule(null);
  };

  const dialerButtons = [
    { digit: '1', letters: '' },
    { digit: '2', letters: 'ABC' },
    { digit: '3', letters: 'DEF' },
    { digit: '4', letters: 'GHI' },
    { digit: '5', letters: 'JKL' },
    { digit: '6', letters: 'MNO' },
    { digit: '7', letters: 'PQRS' },
    { digit: '8', letters: 'TUV' },
    { digit: '9', letters: 'WXYZ' },
    { digit: '*', letters: '' },
    { digit: '0', letters: '+' },
    { digit: '#', letters: '' },
  ];

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
  if (lastAnalysis) {
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
                  {lastAnalysis.followUps.map((followUp, i) => (
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
                  {lastAnalysis.actionItems.map((item, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 mt-1 text-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={() => window.location.reload()} variant="outline" className="w-full">
          Make Another Call
        </Button>

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

  // Recording state
  if (isRecording) {
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
            {leadName ? `On call with ${leadName}` : 'Recording call...'}
          </p>
        </div>

        {/* Auto-detect indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>Auto-detecting Hindi + English</span>
        </div>

        {/* Controls */}
        <div className="flex gap-3 mt-2">
          <Button
            variant="outline"
            size="lg"
            onClick={cancelRecording}
            className="rounded-full h-14 w-14 p-0 border-destructive/50 text-destructive hover:bg-destructive/10"
          >
            <X className="h-6 w-6" />
          </Button>
          <Button
            size="lg"
            onClick={handleStop}
            className="rounded-full h-14 w-14 p-0 bg-red-500 hover:bg-red-600"
          >
            <Square className="h-5 w-5" />
          </Button>
        </div>
      </div>
    );
  }

  // Default state - dialer
  return (
    <div className={cn("flex flex-col items-center gap-4 p-4", className)}>
      {/* Lead info */}
      {leadName && (
        <div className="text-center mb-2">
          <p className="font-medium">{leadName}</p>
          {leadPhone && <p className="text-sm text-muted-foreground">{leadPhone}</p>}
        </div>
      )}

      {/* Dialer Grid */}
      <div className="grid grid-cols-3 gap-2 w-full max-w-[240px]">
        {dialerButtons.map(({ digit, letters }) => (
          <button
            key={digit}
            className="h-14 rounded-full bg-muted/50 hover:bg-muted transition-colors flex flex-col items-center justify-center"
            disabled
          >
            <span className="text-lg font-medium">{digit}</span>
            {letters && <span className="text-[10px] text-muted-foreground tracking-widest">{letters}</span>}
          </button>
        ))}
      </div>

      {/* Call Button */}
      <button
        onClick={startRecording}
        className="mt-2 h-16 w-16 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-all hover:scale-105 active:scale-95"
      >
        <Phone className="h-7 w-7 text-white" />
      </button>
      <p className="text-xs text-muted-foreground">Tap to start recording</p>
      <p className="text-xs text-muted-foreground/70">Auto-detects Hindi + English</p>
    </div>
  );
}

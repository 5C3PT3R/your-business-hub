import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Mic, Square, X, Phone, PhoneCall, Languages } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useVoiceRecorder, TranscriptionLanguage } from '@/hooks/useVoiceRecorder';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';

interface DialerRecorderProps {
  onTranscriptionComplete: (text: string) => void;
  className?: string;
}

export function DialerRecorder({ onTranscriptionComplete, className }: DialerRecorderProps) {
  const {
    isRecording,
    isTranscribing,
    formattedDuration,
    language,
    setLanguage,
    startRecording,
    stopRecording,
    cancelRecording
  } = useVoiceRecorder();

  const handleStop = async () => {
    const transcription = await stopRecording();
    if (transcription) {
      onTranscriptionComplete(transcription);
    }
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

  if (isTranscribing) {
    return (
      <div className={cn("flex flex-col items-center gap-4 p-6", className)}>
        <div className="relative">
          <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
          </div>
        </div>
        <p className="text-sm text-muted-foreground">Transcribing your call...</p>
      </div>
    );
  }

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
          <p className="text-sm text-muted-foreground mt-1">Recording call...</p>
        </div>

        {/* Language indicator */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Languages className="h-3 w-3" />
          <span>{language === 'hi' ? 'Hindi' : language === 'en' ? 'English' : 'Auto-detect'}</span>
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

  return (
    <div className={cn("flex flex-col items-center gap-4 p-4", className)}>
      {/* Language Selector */}
      <div className="flex items-center gap-2 w-full max-w-[200px]">
        <Languages className="h-4 w-4 text-muted-foreground" />
        <Select value={language} onValueChange={(v) => setLanguage(v as TranscriptionLanguage)}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto Detect</SelectItem>
            <SelectItem value="en">English</SelectItem>
            <SelectItem value="hi">हिंदी (Hindi)</SelectItem>
          </SelectContent>
        </Select>
      </div>

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
      <p className="text-xs text-muted-foreground">Tap to record call</p>
    </div>
  );
}
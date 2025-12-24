import { useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

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

export const useVoiceRecorder = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [lastAnalysis, setLastAnalysis] = useState<CallAnalysis | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      setRecordingDuration(0);
      setLastAnalysis(null);
      
      timerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
      toast({
        title: 'Microphone Error',
        description: 'Could not access microphone. Please check permissions.',
        variant: 'destructive'
      });
    }
  }, []);

  const stopRecording = useCallback(async (leadName?: string, leadCompany?: string): Promise<{ transcription: string | null; analysis: CallAnalysis | null }> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve({ transcription: null, analysis: null });
        return;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      const mediaRecorder = mediaRecorderRef.current;
      
      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsTranscribing(true);
        
        try {
          mediaRecorder.stream.getTracks().forEach(track => track.stop());
          
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          const reader = new FileReader();
          reader.readAsDataURL(audioBlob);
          
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            
            try {
              // Step 1: Transcribe (auto-detect Hindi/English)
              const { data: transcribeData, error: transcribeError } = await supabase.functions.invoke('transcribe-audio', {
                body: { audio: base64Audio }
              });
              
              if (transcribeError) throw transcribeError;
              
              if (!transcribeData?.text) {
                throw new Error('No transcription returned');
              }

              const transcription = transcribeData.text;
              setIsTranscribing(false);
              setIsAnalyzing(true);

              // Step 2: Analyze the transcription
              const { data: analysisData, error: analysisError } = await supabase.functions.invoke('analyze-call', {
                body: { 
                  transcription,
                  leadName,
                  leadCompany
                }
              });

              if (analysisError) throw analysisError;

              const analysis = analysisData as CallAnalysis;
              setLastAnalysis(analysis);

              toast({
                title: 'Call Analysis Complete',
                description: `Sentiment: ${analysis.sentiment}. ${analysis.followUps.length} follow-up(s) detected.`
              });

              resolve({ transcription, analysis });
            } catch (error) {
              console.error('Processing error:', error);
              toast({
                title: 'Processing Failed',
                description: 'Could not process audio. Please try again.',
                variant: 'destructive'
              });
              resolve({ transcription: null, analysis: null });
            } finally {
              setIsTranscribing(false);
              setIsAnalyzing(false);
            }
          };
        } catch (error) {
          console.error('Error processing audio:', error);
          setIsTranscribing(false);
          setIsAnalyzing(false);
          resolve({ transcription: null, analysis: null });
        }
      };
      
      mediaRecorder.stop();
    });
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      mediaRecorderRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return {
    isRecording,
    isTranscribing,
    isAnalyzing,
    recordingDuration,
    formattedDuration: formatDuration(recordingDuration),
    lastAnalysis,
    startRecording,
    stopRecording,
    cancelRecording
  };
};

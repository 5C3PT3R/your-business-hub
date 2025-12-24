import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
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
  RotateCcw,
  FileSpreadsheet,
  X,
  Upload,
  Mic,
  Square,
  Phone
} from 'lucide-react';
import { useAgent, ParsedFileData } from '@/hooks/useAgent';
import { useWorkspace } from '@/hooks/useWorkspace';
import { ActionCard } from './ActionCard';
import { PlannedAction } from '@/types/agent';
import { cn } from '@/lib/utils';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';

interface AgentPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AgentPopup({ open, onOpenChange }: AgentPopupProps) {
  const [instruction, setInstruction] = useState('');
  const [rejectedActions, setRejectedActions] = useState<string[]>([]);
  const [executingAction, setExecutingAction] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<ParsedFileData | null>(null);
  const [isParsingFile, setIsParsingFile] = useState(false);
  const [voiceTranscription, setVoiceTranscription] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { workspace, template } = useWorkspace();
  const { toast } = useToast();
  const { 
    isLoading, 
    response, 
    executedActions, 
    sendInstruction, 
    executeAction,
    executeAllApproved,
    clearResponse 
  } = useAgent();

  const {
    isRecording,
    isTranscribing,
    formattedDuration,
    startRecording,
    stopRecording,
    cancelRecording
  } = useVoiceRecorder();

  const handleVoiceRecordStop = async () => {
    const result = await stopRecording();
    if (result.transcription) {
      setVoiceTranscription(result.transcription);
      // Automatically send the transcription to the AI agent
      setInstruction(`Voice call transcription: "${result.transcription}". Please analyze this conversation and suggest appropriate CRM actions like creating contacts, leads, deals, or tasks based on the discussion.`);
    }
  };

  const parseFile = async (file: File): Promise<ParsedFileData | null> => {
    const fileName = file.name.toLowerCase();
    
    try {
      if (fileName.endsWith('.csv')) {
        // Parse CSV
        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length === 0) return null;
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const rows = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
          const row: Record<string, string> = {};
          headers.forEach((header, i) => {
            row[header] = values[i] || '';
          });
          return row;
        });
        
        return {
          fileName: file.name,
          headers,
          rows: rows.slice(0, 100), // Limit to 100 rows
          totalRows: rows.length,
        };
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        // Parse Excel
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet);
        
        if (jsonData.length === 0) return null;
        
        const headers = Object.keys(jsonData[0]);
        const rows = jsonData.slice(0, 100).map(row => {
          const cleanRow: Record<string, string> = {};
          headers.forEach(h => {
            cleanRow[h] = String(row[h] ?? '');
          });
          return cleanRow;
        });
        
        return {
          fileName: file.name,
          headers,
          rows,
          totalRows: jsonData.length,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error parsing file:', error);
      return null;
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const validTypes = ['.csv', '.xlsx', '.xls'];
    const isValid = validTypes.some(type => file.name.toLowerCase().endsWith(type));
    
    if (!isValid) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV, Excel (.xlsx), or Excel (.xls) file.",
        variant: "destructive",
      });
      return;
    }
    
    setIsParsingFile(true);
    const parsed = await parseFile(file);
    setIsParsingFile(false);
    
    if (parsed) {
      setUploadedFile(parsed);
      toast({
        title: "File uploaded",
        description: `Loaded ${parsed.totalRows} rows from ${parsed.fileName}`,
      });
    } else {
      toast({
        title: "Failed to parse file",
        description: "Could not read the file. Please check the format.",
        variant: "destructive",
      });
    }
    
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || isLoading) return;
    
    setRejectedActions([]);
    await sendInstruction(instruction, uploadedFile || undefined);
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
    setUploadedFile(null);
    setVoiceTranscription(null);
    cancelRecording();
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
                <DialogDescription className="sr-only">
                  AI assistant to help manage your CRM operations
                </DialogDescription>
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
            {(response || uploadedFile) && (
              <Button variant="ghost" size="sm" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Content */}
        <ScrollArea className="flex-1 px-6 py-4">
          {/* Voice Transcription Badge */}
          {voiceTranscription && (
            <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-emerald-500" />
                  <span className="text-sm font-medium">Call Transcription</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    setVoiceTranscription(null);
                    setInstruction('');
                  }}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                "{voiceTranscription}"
              </p>
            </div>
          )}

          {/* Uploaded File Badge */}
          {uploadedFile && (
            <div className="mb-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{uploadedFile.fileName}</span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 w-6 p-0"
                  onClick={() => setUploadedFile(null)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {uploadedFile.totalRows} rows • {uploadedFile.headers.length} columns
              </p>
              <div className="flex flex-wrap gap-1 mt-2">
                {uploadedFile.headers.slice(0, 5).map(header => (
                  <Badge key={header} variant="outline" className="text-xs">
                    {header}
                  </Badge>
                ))}
                {uploadedFile.headers.length > 5 && (
                  <Badge variant="outline" className="text-xs">
                    +{uploadedFile.headers.length - 5} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {!response && !isLoading && (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 mx-auto text-primary/50 mb-4" />
              <h3 className="font-medium mb-2">What can I help you with?</h3>
              <p className="text-sm text-muted-foreground max-w-xs mx-auto">
                Describe what you want to do and I'll suggest the right actions to take.
              </p>
              
              {/* Voice Recording Section */}
              <div className="mt-6 p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                {isRecording ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                        <Mic className="h-8 w-8 text-red-500" />
                      </div>
                      <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                        {formattedDuration}
                      </div>
                    </div>
                    <span className="text-sm font-medium text-red-500">Recording...</span>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={cancelRecording}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleVoiceRecordStop}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        <Square className="h-4 w-4 mr-1" />
                        Stop & Transcribe
                      </Button>
                    </div>
                  </div>
                ) : isTranscribing ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <span className="text-sm text-muted-foreground">Transcribing audio...</span>
                  </div>
                ) : (
                  <button 
                    onClick={startRecording}
                    className="w-full flex flex-col items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity"
                  >
                    <Phone className="h-8 w-8 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Record a call
                    </span>
                    <span className="text-xs text-muted-foreground/75">
                      Audio will be transcribed and analyzed
                    </span>
                  </button>
                )}
              </div>

              {/* File Upload Section */}
              <div className="mt-4 p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="file-upload"
                />
                <label 
                  htmlFor="file-upload" 
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  {isParsingFile ? (
                    <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
                  ) : (
                    <Upload className="h-8 w-8 text-muted-foreground" />
                  )}
                  <span className="text-sm text-muted-foreground">
                    {isParsingFile ? 'Parsing file...' : 'Upload CSV or Excel file'}
                  </span>
                  <span className="text-xs text-muted-foreground/75">
                    Supports .csv, .xlsx, .xls
                  </span>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                {template?.id === 'sales' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Follow up with all qualified leads')}>
                      Follow up leads
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setInstruction('Move stale deals forward')}>
                      Update deals
                    </Button>
                    {uploadedFile && (
                      <Button variant="outline" size="sm" onClick={() => setInstruction('Import contacts from the uploaded file')}>
                        Import from file
                      </Button>
                    )}
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
                    {uploadedFile && (
                      <Button variant="outline" size="sm" onClick={() => setInstruction('Import clients from the uploaded file')}>
                        Import from file
                      </Button>
                    )}
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
                    {uploadedFile && (
                      <Button variant="outline" size="sm" onClick={() => setInstruction('Import customers from the uploaded file')}>
                        Import from file
                      </Button>
                    )}
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
                    {uploadedFile && (
                      <Button variant="outline" size="sm" onClick={() => setInstruction('Import policyholders from the uploaded file')}>
                        Import from file
                      </Button>
                    )}
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
              placeholder={uploadedFile ? "What should I do with the data?" : "Tell me what to do..."}
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

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Send, Inbox, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface ContactEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: {
    id: string;
    name: string;
    email: string | null;
  };
}

interface EmailMessage {
  id: string;
  subject: string;
  body: string;
  from: string;
  to: string;
  received_at: string;
  is_unread: boolean;
}

export function ContactEmailDialog({ open, onOpenChange, contact }: ContactEmailDialogProps) {
  const { toast } = useToast();
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);

  const [composeForm, setComposeForm] = useState({
    to: contact.email || '',
    subject: '',
    body: '',
  });

  useEffect(() => {
    if (open && contact.email) {
      fetchEmails();
    }
  }, [open, contact.email]);

  const fetchEmails = async () => {
    if (!contact.email) return;

    setLoading(true);
    try {
      // Fetch emails from conversations table where the contact's email is involved
      const { data, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`from_email.eq.${contact.email},to_emails.cs.{${contact.email}}`)
        .order('sent_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      setEmails((data as any[])?.map(msg => ({
        id: msg.id,
        subject: msg.subject || '(No subject)',
        body: msg.plain_text || msg.body || '',
        from: msg.from_email || msg.from_name || '',
        to: Array.isArray(msg.to_emails) ? msg.to_emails.join(', ') : (msg.to_emails || ''),
        received_at: msg.sent_at || msg.created_at,
        is_unread: !msg.is_read,
      })) || []);
    } catch (error: any) {
      console.error('[ContactEmailDialog] Error fetching emails:', error);
      toast({
        title: 'Error loading emails',
        description: error.message || 'Failed to load emails',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSendEmail = async () => {
    if (!composeForm.to || !composeForm.subject || !composeForm.body) {
      toast({
        title: 'Missing fields',
        description: 'Please fill in all fields before sending.',
        variant: 'destructive',
      });
      return;
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('You must be logged in to send emails');
      }

      // Add to email send queue for human approval
      const { error } = await supabase
        .from('email_send_queue')
        .insert({
          user_id: user.id,
          to_address: composeForm.to,
          subject: composeForm.subject,
          body_html: composeForm.body,
          body_text: composeForm.body,
          status: 'pending',
          draft_source: 'user',
          metadata: {
            contact_id: contact.id,
            contact_name: contact.name,
          },
        });

      if (error) throw error;

      toast({
        title: 'Email queued',
        description: 'Your email has been queued for sending. It will be sent pending approval.',
      });

      setComposeForm({ to: contact.email || '', subject: '', body: '' });
      setComposing(false);
    } catch (error: any) {
      console.error('[ContactEmailDialog] Error queueing email:', error);
      toast({
        title: 'Error sending email',
        description: error.message || 'Failed to queue email',
        variant: 'destructive',
      });
    }
  };

  if (!contact.email) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Email - {contact.name}</DialogTitle>
            <DialogDescription>Contact email information</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium">No email address</p>
            <p className="text-sm text-muted-foreground mt-2">
              {contact.name} doesn't have an email address on file.
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email - {contact.name}
          </DialogTitle>
          <DialogDescription>View inbox and compose emails</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="inbox" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="inbox" className="flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Inbox ({emails.length})
            </TabsTrigger>
            <TabsTrigger value="compose" className="flex items-center gap-2" onClick={() => setComposing(true)}>
              <Send className="h-4 w-4" />
              Compose
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inbox" className="mt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground">Loading emails...</p>
              </div>
            ) : emails.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium">No emails found</p>
                <p className="text-sm text-muted-foreground mt-2">
                  No email conversations with {contact.name} yet.
                </p>
                <Button
                  variant="gradient"
                  className="mt-4"
                  onClick={() => setComposing(true)}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Send first email
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-3">
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      className="p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <p className="font-semibold text-sm truncate">{email.subject}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            From: {email.from}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                          {format(new Date(email.received_at), 'MMM d, h:mm a')}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {email.body}
                      </p>
                      {email.is_unread && (
                        <div className="mt-2">
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            Unread
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          <TabsContent value="compose" className="mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-to">To</Label>
                <Input
                  id="email-to"
                  type="email"
                  value={composeForm.to}
                  onChange={(e) => setComposeForm({ ...composeForm, to: e.target.value })}
                  placeholder="recipient@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-subject">Subject</Label>
                <Input
                  id="email-subject"
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({ ...composeForm, subject: e.target.value })}
                  placeholder="Email subject"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-body">Message</Label>
                <Textarea
                  id="email-body"
                  value={composeForm.body}
                  onChange={(e) => setComposeForm({ ...composeForm, body: e.target.value })}
                  placeholder="Type your message here..."
                  className="min-h-[200px]"
                />
              </div>

              <div className="flex items-center gap-3">
                <Button variant="gradient" onClick={handleSendEmail} className="flex-1">
                  <Send className="h-4 w-4 mr-2" />
                  Send Email
                </Button>
                <Button variant="outline" onClick={() => setComposing(false)}>
                  Cancel
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Note: Emails are queued for human approval before sending for safety.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

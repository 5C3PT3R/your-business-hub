import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useLeads, LeadStatus, Lead } from '@/hooks/useLeads';
import { useTasks } from '@/hooks/useTasks';
import { useAgent } from '@/hooks/useAgent';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  ArrowLeft, 
  Phone, 
  Mail, 
  Building2, 
  Calendar, 
  DollarSign,
  Edit2,
  Plus,
  CheckCircle2,
  Clock,
  FileText,
  Activity,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DialerRecorder } from '@/components/voice/DialerRecorder';

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-info/10 text-info border-info/20',
  contacted: 'bg-warning/10 text-warning border-warning/20',
  qualified: 'bg-success/10 text-success border-success/20',
  lost: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function LeadProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { leads, loading: leadsLoading, updateLead } = useLeads();
  const { tasks, addTask, updateTask } = useTasks();
  const { sendInstruction, isLoading: agentLoading } = useAgent();
  
  const [lead, setLead] = useState<Lead | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Lead>>({});
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: '', description: '', due_date: '', priority: 'medium' as 'low' | 'medium' | 'high' });

  const handleCallTranscription = async (transcription: string) => {
    setIsCallDialogOpen(false);
    if (lead) {
      // Send to AI agent to analyze the call
      await sendInstruction(
        `Call transcription with ${lead.name} (${lead.company || 'No company'}): "${transcription}". 
        Please analyze this conversation and suggest appropriate CRM actions like updating lead status, creating tasks, or adding notes.`
      );
    }
  };

  useEffect(() => {
    if (leads.length > 0 && id) {
      const foundLead = leads.find(l => l.id === id);
      if (foundLead) {
        setLead(foundLead);
        setEditForm(foundLead);
      }
    }
  }, [leads, id]);

  const leadTasks = tasks.filter(t => t.related_lead_id === id);

  const handleSaveEdit = async () => {
    if (!lead) return;
    await updateLead(lead.id, editForm);
    setIsEditing(false);
  };

  const handleAddTask = async () => {
    if (!newTask.title || !lead) return;
    await addTask({
      title: newTask.title,
      description: newTask.description || null,
      due_date: newTask.due_date || null,
      priority: newTask.priority,
      status: 'pending',
      related_lead_id: lead.id,
      related_contact_id: null,
      related_deal_id: null,
    });
    setNewTask({ title: '', description: '', due_date: '', priority: 'medium' });
    setIsAddingTask(false);
  };

  if (leadsLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!lead) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center min-h-screen gap-4">
          <p className="text-muted-foreground">Lead not found</p>
          <Button onClick={() => navigate('/leads')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Leads
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header
        title={lead.name}
        subtitle="Lead Profile"
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Back Button */}
        <Button variant="ghost" onClick={() => navigate('/leads')} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Leads
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Profile Card */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Profile</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(!isEditing)}>
                  <Edit2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Avatar */}
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground text-xl font-bold">
                  {lead.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{lead.name}</h3>
                  <Badge variant="outline" className={statusColors[lead.status]}>
                    {lead.status}
                  </Badge>
                </div>
              </div>

              {isEditing ? (
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input 
                      value={editForm.name || ''} 
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input 
                      value={editForm.email || ''} 
                      onChange={(e) => setEditForm({...editForm, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Phone</Label>
                    <Input 
                      value={editForm.phone || ''} 
                      onChange={(e) => setEditForm({...editForm, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Company</Label>
                    <Input 
                      value={editForm.company || ''} 
                      onChange={(e) => setEditForm({...editForm, company: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Value</Label>
                    <Input 
                      type="number"
                      value={editForm.value || 0} 
                      onChange={(e) => setEditForm({...editForm, value: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select 
                      value={editForm.status} 
                      onValueChange={(v) => setEditForm({...editForm, status: v as LeadStatus})}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="contacted">Contacted</SelectItem>
                        <SelectItem value="qualified">Qualified</SelectItem>
                        <SelectItem value="lost">Lost</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleSaveEdit} className="flex-1">Save</Button>
                    <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-4">
                  <div className="flex items-center gap-3 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.email || 'No email'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.phone || 'No phone'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.company || 'No company'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>${lead.value.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Created {format(new Date(lead.created_at), 'MMM d, yyyy')}</span>
                  </div>
                  {lead.source && (
                    <div className="flex items-center gap-3 text-sm">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="capitalize">{lead.source.replace('_', ' ')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Quick Actions */}
              <div className="pt-4 border-t space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2" asChild>
                  <a href={`mailto:${lead.email}`}>
                    <Mail className="h-4 w-4" />
                    Send Email
                  </a>
                </Button>
                <Dialog open={isCallDialogOpen} onOpenChange={setIsCallDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      <Phone className="h-4 w-4" />
                      Record Call
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                      <DialogTitle>Call {lead.name}</DialogTitle>
                    </DialogHeader>
                    <DialerRecorder onTranscriptionComplete={handleCallTranscription} />
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Tabs Section */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="tasks" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="tasks" className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Tasks
                </TabsTrigger>
                <TabsTrigger value="activity" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Activity
                </TabsTrigger>
                <TabsTrigger value="notes" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Notes
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tasks" className="mt-4">
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Lead Tasks</CardTitle>
                      <Dialog open={isAddingTask} onOpenChange={setIsAddingTask}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1">
                            <Plus className="h-4 w-4" />
                            Add Task
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Task for {lead.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Title</Label>
                              <Input 
                                value={newTask.title}
                                onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                                placeholder="Follow up call"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea 
                                value={newTask.description}
                                onChange={(e) => setNewTask({...newTask, description: e.target.value})}
                                placeholder="Details..."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Due Date</Label>
                              <Input 
                                type="date"
                                value={newTask.due_date}
                                onChange={(e) => setNewTask({...newTask, due_date: e.target.value})}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Priority</Label>
                              <Select value={newTask.priority} onValueChange={(v) => setNewTask({...newTask, priority: v as 'low' | 'medium' | 'high'})}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="low">Low</SelectItem>
                                  <SelectItem value="medium">Medium</SelectItem>
                                  <SelectItem value="high">High</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <Button onClick={handleAddTask} className="w-full">Add Task</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {leadTasks.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p>No tasks for this lead</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {leadTasks.map((task) => (
                          <div 
                            key={task.id}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg border",
                              task.status === 'completed' && "opacity-60"
                            )}
                          >
                            <button
                              onClick={() => updateTask(task.id, { 
                                status: task.status === 'completed' ? 'pending' : 'completed' 
                              })}
                              className={cn(
                                "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors",
                                task.status === 'completed' 
                                  ? "bg-success border-success text-success-foreground" 
                                  : "border-muted-foreground/30 hover:border-primary"
                              )}
                            >
                              {task.status === 'completed' && <CheckCircle2 className="h-3 w-3" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={cn(
                                "font-medium",
                                task.status === 'completed' && "line-through"
                              )}>
                                {task.title}
                              </p>
                              {task.description && (
                                <p className="text-sm text-muted-foreground mt-1">{task.description}</p>
                              )}
                              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                {task.due_date && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {format(new Date(task.due_date), 'MMM d')}
                                  </span>
                                )}
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-xs",
                                    task.priority === 'high' && "border-destructive/50 text-destructive",
                                    task.priority === 'medium' && "border-warning/50 text-warning",
                                    task.priority === 'low' && "border-muted-foreground/50"
                                  )}
                                >
                                  {task.priority}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="activity" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Recent Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Activity timeline coming soon</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-8 text-muted-foreground">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Notes feature coming soon</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
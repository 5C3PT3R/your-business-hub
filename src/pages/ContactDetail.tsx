import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useContacts, Contact } from '@/hooks/useContacts';
import { useActivities } from '@/hooks/useActivities';
import { useDeals } from '@/hooks/useDeals';
import { useTasks } from '@/hooks/useTasks';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  Phone,
  Mail,
  Building2,
  Edit2,
  Briefcase,
  Loader2,
  Activity as ActivityIcon,
  CheckCircle2,
  Linkedin,
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { DialerRecorder } from '@/components/voice/DialerRecorder';

const lifecycleStageColors: Record<string, string> = {
  lead: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  mql: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  sql: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  opportunity: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  customer: 'bg-green-500/10 text-green-600 border-green-500/20',
  churned: 'bg-red-500/10 text-red-600 border-red-500/20',
};

export default function ContactDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getContactById, updateContact } = useContacts();
  const { activities, loading: activitiesLoading } = useActivities();
  const { deals, loading: dealsLoading, addDeal } = useDeals();
  const { tasks, loading: tasksLoading } = useTasks();
  const { toast } = useToast();

  const [contact, setContact] = useState<Contact | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [isCallDialogOpen, setIsCallDialogOpen] = useState(false);

  useEffect(() => {
    const loadContact = async () => {
      if (!id) return;

      setIsLoading(true);
      const data = await getContactById(id);

      if (!data) {
        toast({
          title: 'Contact not found',
          description: 'The contact you are looking for does not exist.',
          variant: 'destructive',
        });
        navigate('/contacts');
        return;
      }

      setContact(data);
      setEditForm(data);
      setIsLoading(false);
    };

    loadContact();
  }, [id]);

  const handleSave = async () => {
    if (!contact) return;

    const result = await updateContact(contact.id, editForm);

    if (result) {
      setContact(result);
      setIsEditing(false);
      toast({
        title: 'Contact updated',
        description: 'Contact information has been saved.',
      });
    }
  };

  const handleCallComplete = async (transcription: string, analysis: any) => {
    toast({
      title: 'Call logged',
      description: 'Call has been logged to contact activity.',
    });
  };

  const handleConvertToDeal = async () => {
    if (!contact) return;

    // Create a new deal linked to this contact
    const deal = await addDeal({
      title: `${contact.company || contact.name} - Opportunity`,
      value: 0,
      stage: 'lead',
      company: contact.company || null,
      contact_id: contact.id,
      expected_close_date: null,
      probability: 50,
    });

    if (deal) {
      // Update contact lifecycle stage to 'opportunity'
      await updateContact(contact.id, { lifecycle_stage: 'opportunity' });

      toast({
        title: 'Converted to Deal',
        description: `A new deal has been created for ${contact.name}.`,
      });

      // Navigate to the new deal
      navigate(`/deal/${deal.id}`);
    }
  };

  if (isLoading) {
    return (
      <MainLayout header={<Header />}>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!contact) {
    return (
      <MainLayout header={<Header />}>
        <div className="p-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-2">Contact Not Found</h2>
            <p className="text-muted-foreground mb-4">
              The contact you are looking for does not exist.
            </p>
            <Button onClick={() => navigate('/contacts')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Contacts
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  const contactActivities = activities.filter(
    (a) => a.related_contact_id === contact.id
  );

  const contactDeals = deals.filter((d) => d.contact_id === contact.id);

  const contactTasks = tasks.filter((t) => t.related_contact_id === contact.id);

  const displayName =
    contact.first_name && contact.last_name
      ? `${contact.first_name} ${contact.last_name}`
      : contact.name;

  const initials =
    contact.first_name && contact.last_name
      ? `${contact.first_name[0]}${contact.last_name[0]}`
      : contact.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase();

  return (
    <MainLayout header={<Header />}>
      <div className="p-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          onClick={() => navigate('/contacts')}
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Contacts
        </Button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Sidebar - Contact Info */}
          <div className="lg:col-span-1">
            <Card>
              <CardContent className="pt-6">
                {/* Avatar */}
                <div className="flex flex-col items-center mb-6">
                  {contact.avatar_url ? (
                    <img
                      src={contact.avatar_url}
                      alt={displayName}
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                      <span className="text-2xl font-semibold text-primary">
                        {initials}
                      </span>
                    </div>
                  )}

                  <h2 className="text-2xl font-bold mt-4">{displayName}</h2>
                  {contact.position && (
                    <p className="text-muted-foreground">{contact.position}</p>
                  )}
                  {contact.company && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <Building2 className="h-3 w-3" />
                      {contact.company}
                    </p>
                  )}

                  {/* Lifecycle Stage Badge */}
                  {contact.lifecycle_stage && (
                    <Badge
                      className={cn(
                        'mt-3',
                        lifecycleStageColors[contact.lifecycle_stage]
                      )}
                    >
                      {contact.lifecycle_stage.toUpperCase()}
                    </Badge>
                  )}
                </div>

                {/* Lead Score */}
                {contact.lead_score !== undefined && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">Lead Score</Label>
                      <span className="text-sm font-bold">{contact.lead_score}/100</span>
                    </div>
                    <Progress value={contact.lead_score} className="h-2" />
                  </div>
                )}

                {/* Data Completeness */}
                {contact.data_completeness !== undefined && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-sm font-medium">
                        Profile Completeness
                      </Label>
                      <span className="text-sm font-bold">
                        {contact.data_completeness}%
                      </span>
                    </div>
                    <Progress value={contact.data_completeness} className="h-2" />
                  </div>
                )}

                {/* Edit Button */}
                <Button
                  variant={isEditing ? 'default' : 'outline'}
                  className="w-full mb-4"
                  onClick={() => {
                    if (isEditing) {
                      handleSave();
                    } else {
                      setIsEditing(true);
                    }
                  }}
                >
                  {isEditing ? (
                    <>
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  ) : (
                    <>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit Contact
                    </>
                  )}
                </Button>

                {isEditing && (
                  <Button
                    variant="ghost"
                    className="w-full mb-4"
                    onClick={() => {
                      setIsEditing(false);
                      setEditForm(contact);
                    }}
                  >
                    Cancel
                  </Button>
                )}

                {/* Contact Info */}
                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        value={editForm.first_name || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, first_name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        value={editForm.last_name || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, last_name: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={editForm.email || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, email: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={editForm.phone || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, phone: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Company</Label>
                      <Input
                        id="company"
                        value={editForm.company || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, company: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="position">Position</Label>
                      <Input
                        id="position"
                        value={editForm.position || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, position: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="linkedin_url">LinkedIn URL</Label>
                      <Input
                        id="linkedin_url"
                        value={editForm.linkedin_url || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, linkedin_url: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label htmlFor="lifecycle_stage">Lifecycle Stage</Label>
                      <Select
                        value={editForm.lifecycle_stage || ''}
                        onValueChange={(value) =>
                          setEditForm({ ...editForm, lifecycle_stage: value as any })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="lead">Lead</SelectItem>
                          <SelectItem value="mql">MQL</SelectItem>
                          <SelectItem value="sql">SQL</SelectItem>
                          <SelectItem value="opportunity">Opportunity</SelectItem>
                          <SelectItem value="customer">Customer</SelectItem>
                          <SelectItem value="churned">Churned</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="notes">Notes</Label>
                      <Textarea
                        id="notes"
                        value={editForm.notes || ''}
                        onChange={(e) =>
                          setEditForm({ ...editForm, notes: e.target.value })
                        }
                        rows={4}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Email */}
                    {contact.email && (
                      <div className="flex items-center gap-3">
                        <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-sm hover:underline truncate"
                        >
                          {contact.email}
                        </a>
                      </div>
                    )}

                    {/* Phone */}
                    {contact.phone && (
                      <div className="flex items-center gap-3">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a
                          href={`tel:${contact.phone}`}
                          className="text-sm hover:underline truncate"
                        >
                          {contact.phone}
                        </a>
                      </div>
                    )}

                    {/* LinkedIn */}
                    {contact.linkedin_url && (
                      <div className="flex items-center gap-3">
                        <Linkedin className="h-4 w-4 text-muted-foreground shrink-0" />
                        <a
                          href={contact.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm hover:underline truncate"
                        >
                          LinkedIn Profile
                        </a>
                      </div>
                    )}

                    {/* Notes */}
                    {contact.notes && (
                      <div className="mt-4 p-3 bg-muted rounded-lg">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          NOTES
                        </p>
                        <p className="text-sm whitespace-pre-wrap">{contact.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick Actions */}
                <div className="mt-6 space-y-2">
                  {/* Convert to Deal button - only show for leads */}
                  {contact.lifecycle_stage && ['lead', 'mql', 'sql'].includes(contact.lifecycle_stage) && (
                    <Button
                      onClick={handleConvertToDeal}
                      className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    >
                      <Briefcase className="mr-2 h-4 w-4" />
                      Convert to Deal
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCallDialogOpen(true)}
                      disabled={!contact.phone}
                    >
                      <Phone className="mr-2 h-4 w-4" />
                      Call
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => window.open(`mailto:${contact.email}`)}
                      disabled={!contact.email}
                    >
                      <Mail className="mr-2 h-4 w-4" />
                      Email
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            {contact.tags && contact.tags.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-sm">Tags</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {contact.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Section - Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="activities">
                  <ActivityIcon className="h-4 w-4 mr-2" />
                  Activities
                  {contactActivities.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {contactActivities.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="deals">
                  <Briefcase className="h-4 w-4 mr-2" />
                  Deals
                  {contactDeals.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {contactDeals.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="tasks">
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Tasks
                  {contactTasks.length > 0 && (
                    <Badge variant="secondary" className="ml-2">
                      {contactTasks.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          First Name
                        </Label>
                        <p className="text-sm font-medium">
                          {contact.first_name || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Last Name
                        </Label>
                        <p className="text-sm font-medium">
                          {contact.last_name || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <p className="text-sm font-medium">
                          {contact.email || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Phone</Label>
                        <p className="text-sm font-medium">
                          {contact.phone || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Company</Label>
                        <p className="text-sm font-medium">
                          {contact.company || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Position
                        </Label>
                        <p className="text-sm font-medium">
                          {contact.position || 'N/A'}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Created At
                        </Label>
                        <p className="text-sm font-medium">
                          {format(new Date(contact.created_at), 'MMM d, yyyy')}
                        </p>
                      </div>
                      {contact.last_activity_at && (
                        <div>
                          <Label className="text-xs text-muted-foreground">
                            Last Activity
                          </Label>
                          <p className="text-sm font-medium">
                            {format(new Date(contact.last_activity_at), 'MMM d, yyyy')}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Activities Tab */}
              <TabsContent value="activities" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Activity Timeline</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {activitiesLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : contactActivities.length > 0 ? (
                      <div className="space-y-4">
                        {contactActivities.map((activity) => (
                          <div
                            key={activity.id}
                            className="border-l-2 border-primary/20 pl-4 pb-4"
                          >
                            <p className="text-sm font-medium">{activity.type}</p>
                            {activity.description && (
                              <p className="text-sm text-muted-foreground">
                                {activity.description}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(activity.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No activities yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Deals Tab */}
              <TabsContent value="deals" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Associated Deals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {dealsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : contactDeals.length > 0 ? (
                      <div className="space-y-3">
                        {contactDeals.map((deal) => (
                          <div
                            key={deal.id}
                            className="p-4 border rounded-lg hover:bg-accent cursor-pointer"
                            onClick={() => navigate(`/deal/${deal.id}`)}
                          >
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-medium">{deal.title}</h4>
                                {deal.company && (
                                  <p className="text-sm text-muted-foreground">
                                    {deal.company}
                                  </p>
                                )}
                              </div>
                              <Badge>{deal.stage}</Badge>
                            </div>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>${deal.value?.toLocaleString() || 0}</span>
                              {deal.expected_close_date && (
                                <span>
                                  Close: {format(new Date(deal.expected_close_date), 'MMM d')}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No deals associated</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tasks Tab */}
              <TabsContent value="tasks" className="mt-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Related Tasks</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tasksLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : contactTasks.length > 0 ? (
                      <div className="space-y-2">
                        {contactTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-center gap-3 p-3 border rounded-lg"
                          >
                            <CheckCircle2
                              className={cn(
                                'h-5 w-5',
                                task.status === 'completed'
                                  ? 'text-green-600'
                                  : 'text-muted-foreground'
                              )}
                            />
                            <div className="flex-1">
                              <p
                                className={cn(
                                  'text-sm font-medium',
                                  task.status === 'completed' && 'line-through'
                                )}
                              >
                                {task.title}
                              </p>
                              {task.due_date && (
                                <p className="text-xs text-muted-foreground">
                                  Due: {format(new Date(task.due_date), 'MMM d, yyyy')}
                                </p>
                              )}
                            </div>
                            <Badge
                              variant={
                                task.priority === 'high'
                                  ? 'destructive'
                                  : task.priority === 'medium'
                                  ? 'default'
                                  : 'secondary'
                              }
                            >
                              {task.priority}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No tasks assigned</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* Call Dialog */}
        {contact.phone && (
          <DialerRecorder
            open={isCallDialogOpen}
            onOpenChange={setIsCallDialogOpen}
            phoneNumber={contact.phone}
            contactName={displayName}
            onCallComplete={handleCallComplete}
          />
        )}
      </div>
    </MainLayout>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { useLeads, LeadStatus } from '@/hooks/useLeads';
import { Button } from '@/components/ui/button';
import { useWorkspace } from '@/hooks/useWorkspace';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Search, Plus, Loader2, Trash2, MoreHorizontal, Undo2, Sparkles, TrendingUp, Users, Swords, Mail } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<LeadStatus, string> = {
  new: 'bg-info/10 text-info border-info/20',
  contacted: 'bg-warning/10 text-warning border-warning/20',
  qualified: 'bg-success/10 text-success border-success/20',
  lost: 'bg-destructive/10 text-destructive border-destructive/20',
};

const countryCodes = [
  { code: '+1', country: 'US/CA' },
  { code: '+44', country: 'UK' },
  { code: '+91', country: 'IN' },
  { code: '+86', country: 'CN' },
  { code: '+81', country: 'JP' },
  { code: '+49', country: 'DE' },
  { code: '+33', country: 'FR' },
  { code: '+61', country: 'AU' },
  { code: '+55', country: 'BR' },
  { code: '+971', country: 'UAE' },
];

export default function Leads() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const { leads, loading, addLead, updateLead, deleteLead } = useLeads();
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const { toast } = useToast();

  // Debug logging
  useEffect(() => {
    console.log('[Leads Page] Render - workspace:', workspace?.id, 'leads:', leads.length, 'loading:', loading);
  }, [workspace?.id, leads.length, loading]);

  const [newLead, setNewLead] = useState({
    name: '',
    email: '',
    countryCode: '+1',
    phone: '',
    company: '',
    source: '',
    value: '',
  });

  const [deletedLead, setDeletedLead] = useState<{
    id: string;
    data: any;
  } | null>(null);

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.company?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false) ||
      (lead.email?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleAddLead = async () => {
    if (!newLead.name) return;
    
    const fullPhone = newLead.phone ? `${newLead.countryCode}${newLead.phone.replace(/\s/g, '')}` : null;
    const valueNum = newLead.value ? parseFloat(newLead.value) : 0;

    await addLead({
      name: newLead.name,
      email: newLead.email || null,
      phone: fullPhone,
      company: newLead.company || null,
      source: newLead.source || null,
      status: 'new',
      value: valueNum,
      bishop_status: 'INTRO_SENT',
    });
    
    setNewLead({ name: '', email: '', countryCode: '+1', phone: '', company: '', source: '', value: '' });
    setIsAddDialogOpen(false);
  };

  const handleStatusChange = async (id: string, status: LeadStatus) => {
    await updateLead(id, { status });
  };

  const handleDelete = async (lead: any) => {
    const leadData = { ...lead };
    const success = await deleteLead(lead.id);
    
    if (success) {
      setDeletedLead({ id: lead.id, data: leadData });
      toast({
        title: "Lead deleted",
        description: "The lead has been removed.",
        action: (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleUndo(leadData)}
            className="gap-1"
          >
            <Undo2 className="h-3 w-3" />
            Undo
          </Button>
        ),
      });
    }
  };

  const handleUndo = async (leadData: any) => {
    await addLead({
      name: leadData.name,
      email: leadData.email,
      phone: leadData.phone,
      company: leadData.company,
      source: leadData.source,
      status: leadData.status,
      value: leadData.value,
    });
    setDeletedLead(null);
    toast({
      title: "Lead restored",
      description: "The lead has been restored.",
    });
  };

  // Toggle lead selection
  const toggleLeadSelection = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle all leads selection
  const toggleAllLeads = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  // Generate outreach drafts for selected leads
  const handleGenerateOutreach = async () => {
    if (!user || !workspace) return;

    const selectedList = leads.filter(l => selectedLeads.has(l.id));
    if (selectedList.length === 0) return;

    setIsGenerating(true);
    let successCount = 0;
    let failCount = 0;

    for (const lead of selectedList) {
      if (!lead.email) {
        failCount++;
        continue;
      }

      // Generate a simple outreach email template
      // In production, this would use AI/LLM to generate personalized content
      const subject = `Quick question for ${lead.name}`;
      const body = `Hi ${lead.name},

I noticed ${lead.company ? `${lead.company} and` : ''} wanted to reach out briefly.

I'd love to learn more about your current priorities and see if there might be a fit for what we're building.

Would you be open to a quick 15-minute call this week?

Best regards`;

      try {
        const { error } = await supabase
          .from('ai_drafts')
          .insert({
            lead_id: lead.id,
            subject: subject,
            body: body,
            plain_text: body,
            persona_used: 'Bishop Outreach',
            is_ai_draft: true,
            status: 'PENDING_APPROVAL',
            user_id: user.id,
            metadata: {
              lead_name: lead.name,
              company: lead.company,
              target_email: lead.email,
              confidence: 85,
              context: `Initial outreach to ${lead.name}${lead.company ? ` at ${lead.company}` : ''}`,
              source: lead.source || 'Pawn Scout',
            },
          });

        if (error) {
          console.error('Error creating draft:', error);
          failCount++;
        } else {
          successCount++;
        }
      } catch (err) {
        console.error('Error creating draft:', err);
        failCount++;
      }
    }

    setIsGenerating(false);
    setSelectedLeads(new Set());

    if (successCount > 0) {
      toast({
        title: 'Drafts Generated',
        description: `${successCount} outreach draft${successCount === 1 ? '' : 's'} sent to Command Center for approval.`,
      });
    }

    if (failCount > 0) {
      toast({
        title: 'Some drafts failed',
        description: `${failCount} lead${failCount === 1 ? '' : 's'} could not be processed (missing email or error).`,
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout>
      <Header
        title="Leads"
        subtitle="Manage and track your sales leads"
      />

      <div className="p-4 md:p-6 space-y-6 relative overflow-hidden min-h-[calc(100vh-4rem)]">
        {/* Dramatic animated background - React Bits style */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-gradient-to-br from-blue-500/30 via-purple-500/20 to-pink-500/10 rounded-full blur-3xl animate-pulse-glow" />
          <div className="absolute bottom-[-30%] left-[-15%] w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/20 via-blue-500/15 to-transparent rounded-full blur-3xl animate-float" />
          <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] bg-gradient-to-r from-violet-500/15 to-fuchsia-500/10 rounded-full blur-2xl animate-bounce-subtle" />
        </div>

        {/* Stats Cards - Yutori glass style */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-4 animate-fade-in-up">
          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-blue-500/10 via-card/80 to-card/60 backdrop-blur-xl p-5 transition-all duration-500 hover:border-blue-500/30 hover:shadow-[0_0_40px_rgba(59,130,246,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500/20 text-blue-400 ring-1 ring-blue-500/30">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Leads</p>
                <p className="text-2xl font-bold text-foreground">{leads.length}</p>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-card/80 to-card/60 backdrop-blur-xl p-5 transition-all duration-500 hover:border-emerald-500/30 hover:shadow-[0_0_40px_rgba(16,185,129,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30">
                <TrendingUp className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Qualified</p>
                <p className="text-2xl font-bold text-foreground">{leads.filter(l => l.status === 'qualified').length}</p>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 via-card/80 to-card/60 backdrop-blur-xl p-5 transition-all duration-500 hover:border-violet-500/30 hover:shadow-[0_0_40px_rgba(139,92,246,0.15)]">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30">
                <Sparkles className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pipeline Value</p>
                <p className="text-2xl font-bold text-foreground">${leads.reduce((sum, l) => sum + l.value, 0).toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Filters - Glass morphism */}
        <div className="relative flex flex-col gap-3 animate-fade-in delay-100">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search leads..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11 bg-card/60 backdrop-blur-xl border-white/10 rounded-xl focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44 h-11 bg-card/60 backdrop-blur-xl border-white/10 rounded-xl">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 flex-wrap">
            {/* Generate Outreach Button - Shows when leads are selected */}
            {selectedLeads.size > 0 && (
              <Button
                onClick={handleGenerateOutreach}
                disabled={isGenerating}
                className="gap-2 h-11 px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium rounded-xl shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40 transition-all duration-300 hover:-translate-y-0.5"
              >
                {isGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Swords className="h-4 w-4" />
                )}
                {isGenerating ? 'Generating...' : `Generate Outreach (${selectedLeads.size})`}
              </Button>
            )}

            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button className="w-fit gap-2 h-11 px-6 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300 hover:-translate-y-0.5">
                  <Plus className="h-4 w-4" />
                  Add Lead
                </Button>
              </DialogTrigger>
            <DialogContent className="bg-card/95 backdrop-blur-2xl border-white/10 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">Add New Lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="lead-name">Name *</Label>
                  <Input
                    id="lead-name"
                    value={newLead.name}
                    onChange={(e) => setNewLead({ ...newLead, name: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-email">Email</Label>
                  <Input
                    id="lead-email"
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-phone">Phone</Label>
                  <div className="flex gap-2">
                    <Select value={newLead.countryCode} onValueChange={(value) => setNewLead({ ...newLead, countryCode: value })}>
                      <SelectTrigger className="w-28">
                        <SelectValue placeholder="Code" />
                      </SelectTrigger>
                      <SelectContent>
                        {countryCodes.map((cc) => (
                          <SelectItem key={cc.code} value={cc.code}>
                            {cc.code} ({cc.country})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      id="lead-phone"
                      value={newLead.phone}
                      onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                      placeholder="555 123-4567"
                      className="flex-1"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-company">Company</Label>
                  <Input
                    id="lead-company"
                    value={newLead.company}
                    onChange={(e) => setNewLead({ ...newLead, company: e.target.value })}
                    placeholder="Acme Inc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-source">Source</Label>
                  <Select value={newLead.source} onValueChange={(value) => setNewLead({ ...newLead, source: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="linkedin">LinkedIn</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="cold_call">Cold Call</SelectItem>
                      <SelectItem value="event">Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lead-value">Estimated Value ($)</Label>
                  <Input
                    id="lead-value"
                    type="number"
                    value={newLead.value}
                    onChange={(e) => setNewLead({ ...newLead, value: e.target.value })}
                    placeholder="10000"
                    min="0"
                    step="100"
                  />
                </div>
                <Button
                  className="w-full h-11 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 hover:from-blue-600 hover:via-purple-600 hover:to-pink-600 text-white font-medium rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-300"
                  onClick={handleAddLead}
                >
                  Add Lead
                </Button>
              </div>
            </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Table - Premium glass design */}
        {!loading && (
          <div className="relative animate-fade-in-up delay-200">
            {/* Gradient border effect */}
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-blue-500/20 via-purple-500/20 to-pink-500/20 blur-sm" />
            <div className="relative rounded-2xl border border-white/10 bg-card/70 backdrop-blur-2xl overflow-hidden shadow-2xl shadow-purple-500/5">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 border-b border-white/10">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={filteredLeads.length > 0 && selectedLeads.size === filteredLeads.length}
                        onCheckedChange={toggleAllLeads}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableHead>
                    <TableHead className="min-w-[120px] text-foreground/80 font-semibold">Name</TableHead>
                    <TableHead className="hidden md:table-cell text-foreground/80 font-semibold">Company</TableHead>
                    <TableHead className="hidden lg:table-cell text-foreground/80 font-semibold">Email</TableHead>
                    <TableHead className="hidden sm:table-cell text-foreground/80 font-semibold">Source</TableHead>
                    <TableHead className="text-foreground/80 font-semibold">Value</TableHead>
                    <TableHead className="text-foreground/80 font-semibold">Status</TableHead>
                    <TableHead className="hidden md:table-cell text-foreground/80 font-semibold">Created</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead, index) => (
                    <TableRow
                      key={lead.id}
                      className="group relative hover:bg-gradient-to-r hover:from-blue-500/5 hover:via-purple-500/5 hover:to-transparent cursor-pointer transition-all duration-300 border-b border-white/5"
                      onClick={() => navigate(`/leads/${lead.id}`)}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLeads.has(lead.id)}
                          onCheckedChange={() => toggleLeadSelection(lead.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <span className="group-hover:text-blue-400 transition-colors">{lead.name}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground">{lead.company || '-'}</TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">{lead.email || '-'}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground capitalize">{lead.source?.replace('_', ' ') || '-'}</TableCell>
                      <TableCell className="font-semibold text-emerald-400">${lead.value.toLocaleString()}</TableCell>
                      <TableCell>
                        <Select
                          value={lead.status}
                          onValueChange={(value) => handleStatusChange(lead.id, value as LeadStatus)}
                        >
                          <SelectTrigger className="h-7 w-28 border-0 p-0 bg-transparent" onClick={(e) => e.stopPropagation()}>
                            <Badge variant="outline" className={`${statusColors[lead.status]} rounded-full px-3 py-0.5 text-xs font-medium`}>
                              {lead.status}
                            </Badge>
                          </SelectTrigger>
                          <SelectContent className="bg-card/95 backdrop-blur-xl border-white/10">
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="qualified">Qualified</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                        {format(new Date(lead.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-card/95 backdrop-blur-xl border-white/10">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => handleDelete(lead)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-16">
                        <div className="flex flex-col items-center gap-4">
                          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
                            <Users className="h-8 w-8 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-lg font-medium text-foreground">
                              {searchQuery || statusFilter !== 'all' ? 'No leads found' : 'No leads yet'}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {searchQuery || statusFilter !== 'all'
                                ? 'Try adjusting your filters'
                                : 'Add your first lead to get started'}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

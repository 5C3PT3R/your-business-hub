import React, { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Building2,
  Plus,
  Search,
  Users,
  Mail,
  MessageSquare,
  RefreshCw,
  MoreVertical,
  ChevronRight,
  TrendingUp,
  Shield,
  Zap,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useWorkspace } from '@/hooks/useWorkspace';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

// ─── Types ────────────────────────────────────────────────
interface Client {
  id: string;
  name: string;
  industry: string | null;
  contact_name: string | null;
  contact_email: string | null;
  website: string | null;
  status: 'pilot' | 'active' | 'paused' | 'churned';
  plan: 'pilot' | 'starter' | 'growth' | 'enterprise';
  pilot_start_date: string | null;
  pilot_end_date: string | null;
  bishop_enabled: boolean;
  bishop_value_prop: string | null;
  bishop_tone: string;
  bishop_sender_name: string | null;
  bishop_sender_email: string | null;
  bishop_follow_up_days: number;
  bishop_daily_limit: number;
  knight_enabled: boolean;
  knight_tone: string;
  knight_policies: string | null;
  knight_handoff_email: string | null;
  knight_whatsapp_number: string | null;
  rook_enabled: boolean;
  rook_crm_type: string | null;
  rook_crm_creds: Record<string, string> | null;
  slack_webhook_url: string | null;
  created_at: string;
}

const EMPTY_CLIENT: Omit<Client, 'id' | 'created_at'> = {
  name: '',
  industry: '',
  contact_name: '',
  contact_email: '',
  website: '',
  status: 'pilot',
  plan: 'pilot',
  pilot_start_date: null,
  pilot_end_date: null,
  bishop_enabled: false,
  bishop_value_prop: '',
  bishop_tone: 'professional',
  bishop_sender_name: '',
  bishop_sender_email: '',
  bishop_follow_up_days: 3,
  bishop_daily_limit: 50,
  knight_enabled: false,
  knight_tone: 'friendly',
  knight_policies: '',
  knight_handoff_email: '',
  knight_whatsapp_number: '',
  rook_enabled: false,
  rook_crm_type: null,
  rook_crm_creds: null,
  slack_webhook_url: '',
};

// ─── Status helpers ───────────────────────────────────────
const statusColor: Record<string, string> = {
  pilot:   'text-yellow-500 border-yellow-500/30 bg-yellow-500/10',
  active:  'text-green-500  border-green-500/30  bg-green-500/10',
  paused:  'text-gray-400   border-gray-400/30   bg-gray-400/10',
  churned: 'text-red-500    border-red-500/30    bg-red-500/10',
};

const planColor: Record<string, string> = {
  pilot:      'text-blue-400   border-blue-400/30',
  starter:    'text-purple-400 border-purple-400/30',
  growth:     'text-orange-400 border-orange-400/30',
  enterprise: 'text-gold-400   border-yellow-400/30',
};

// ─── Main component ───────────────────────────────────────
export default function Clients() {
  const { workspace } = useWorkspace();
  const { toast } = useToast();

  const [clients, setClients]   = useState<Client[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm]         = useState<typeof EMPTY_CLIENT>(EMPTY_CLIENT);
  const [saving, setSaving]     = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // ── Load clients ─────────────────────────────────────────
  useEffect(() => {
    if (workspace?.id) loadClients();
  }, [workspace?.id]);

  const loadClients = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error loading clients', description: error.message, variant: 'destructive' });
    } else {
      setClients(data || []);
    }
    setLoading(false);
  };

  // ── Open modal ────────────────────────────────────────────
  const openNew = () => {
    setEditingClient(null);
    setForm(EMPTY_CLIENT);
    setActiveTab('overview');
    setModalOpen(true);
  };

  const openEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name:                  client.name,
      industry:              client.industry || '',
      contact_name:          client.contact_name || '',
      contact_email:         client.contact_email || '',
      website:               client.website || '',
      status:                client.status,
      plan:                  client.plan,
      pilot_start_date:      client.pilot_start_date,
      pilot_end_date:        client.pilot_end_date,
      bishop_enabled:        client.bishop_enabled,
      bishop_value_prop:     client.bishop_value_prop || '',
      bishop_tone:           client.bishop_tone,
      bishop_sender_name:    client.bishop_sender_name || '',
      bishop_sender_email:   client.bishop_sender_email || '',
      bishop_follow_up_days: client.bishop_follow_up_days,
      bishop_daily_limit:    client.bishop_daily_limit,
      knight_enabled:        client.knight_enabled,
      knight_tone:           client.knight_tone,
      knight_policies:       client.knight_policies || '',
      knight_handoff_email:  client.knight_handoff_email || '',
      knight_whatsapp_number: client.knight_whatsapp_number || '',
      rook_enabled:          client.rook_enabled,
      rook_crm_type:         client.rook_crm_type,
      rook_crm_creds:        client.rook_crm_creds || null,
      slack_webhook_url:     client.slack_webhook_url || '',
    });
    setActiveTab('overview');
    setModalOpen(true);
  };

  // ── Validation helpers ────────────────────────────────────
  const isValidEmail = (v: string) => /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(v);
  const isValidUrl   = (v: string) => { try { new URL(v); return true; } catch { return false; } };

  // ── Save ──────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Client name is required', variant: 'destructive' });
      return;
    }

    // Validate optional email fields
    if (form.contact_email && !isValidEmail(form.contact_email)) {
      toast({ title: 'Invalid contact email', variant: 'destructive' });
      return;
    }
    if (form.bishop_sender_email && !isValidEmail(form.bishop_sender_email)) {
      toast({ title: 'Invalid Bishop sender email', variant: 'destructive' });
      return;
    }
    if (form.knight_handoff_email && !isValidEmail(form.knight_handoff_email)) {
      toast({ title: 'Invalid Knight handoff email', variant: 'destructive' });
      return;
    }

    // Validate optional URL fields
    if (form.website && !isValidUrl(form.website)) {
      toast({ title: 'Invalid website URL (include https://)', variant: 'destructive' });
      return;
    }
    if (form.slack_webhook_url && !isValidUrl(form.slack_webhook_url)) {
      toast({ title: 'Invalid Slack webhook URL', variant: 'destructive' });
      return;
    }

    // Validate numeric ranges
    if (!Number.isInteger(form.bishop_daily_limit) || form.bishop_daily_limit < 1 || form.bishop_daily_limit > 500) {
      toast({ title: 'Bishop daily limit must be between 1 and 500', variant: 'destructive' });
      return;
    }
    if (!Number.isInteger(form.bishop_follow_up_days) || form.bishop_follow_up_days < 1 || form.bishop_follow_up_days > 30) {
      toast({ title: 'Bishop follow-up days must be between 1 and 30', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        regent_workspace_id: workspace?.id,
      };

      if (editingClient) {
        const { error } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', editingClient.id);
        if (error) throw error;
        toast({ title: 'Client updated' });
      } else {
        const { error } = await supabase.from('clients').insert([payload]);
        if (error) throw error;
        toast({ title: 'Client added' });
      }

      setModalOpen(false);
      loadClients();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Filter ────────────────────────────────────────────────
  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.contact_email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.industry || '').toLowerCase().includes(search.toLowerCase())
  );

  // ── Stats ─────────────────────────────────────────────────
  const stats = {
    total:  clients.length,
    pilot:  clients.filter((c) => c.status === 'pilot').length,
    active: clients.filter((c) => c.status === 'active').length,
    bishop: clients.filter((c) => c.bishop_enabled).length,
    knight: clients.filter((c) => c.knight_enabled).length,
    rook:   clients.filter((c) => c.rook_enabled).length,
  };

  // ─────────────────────────────────────────────────────────
  return (
    <MainLayout>
      <Header title="Clients" subtitle="Manage your BPO client roster" />

      <div className="p-6 space-y-6">

        {/* ── Stat bar ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: 'Total',   value: stats.total,  icon: Building2,    color: 'text-foreground' },
            { label: 'Pilot',   value: stats.pilot,  icon: TrendingUp,   color: 'text-yellow-500' },
            { label: 'Active',  value: stats.active, icon: Zap,          color: 'text-green-500' },
            { label: 'Bishop',  value: stats.bishop, icon: Mail,         color: 'text-blue-400' },
            { label: 'Knight',  value: stats.knight, icon: MessageSquare, color: 'text-purple-400' },
            { label: 'Rook',    value: stats.rook,   icon: RefreshCw,    color: 'text-orange-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="p-4 flex items-center gap-3">
              <Icon className={cn('w-4 h-4 shrink-0', color)} />
              <div>
                <div className="text-xl font-bold">{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            </Card>
          ))}
        </div>

        {/* ── Toolbar ──────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Client
          </Button>
        </div>

        {/* ── Client list ──────────────────────────────────── */}
        {loading ? (
          <div className="text-center py-16 text-muted-foreground">Loading clients…</div>
        ) : filtered.length === 0 ? (
          <Card className="py-16 flex flex-col items-center gap-3 text-center">
            <Building2 className="w-10 h-10 text-muted-foreground/40" />
            <div className="font-medium">No clients yet</div>
            <div className="text-sm text-muted-foreground">Add your first BPO client to get started</div>
            <Button onClick={openNew} variant="outline" className="mt-2 gap-2">
              <Plus className="w-4 h-4" /> Add Client
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3">
            {filtered.map((client) => (
              <Card
                key={client.id}
                className="p-4 flex items-center gap-4 hover:bg-muted/30 transition-colors cursor-pointer"
                onClick={() => openEdit(client)}
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary">
                    {client.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-semibold truncate">{client.name}</span>
                    <Badge variant="outline" className={cn('text-xs shrink-0', statusColor[client.status])}>
                      {client.status}
                    </Badge>
                    <Badge variant="outline" className={cn('text-xs shrink-0', planColor[client.plan])}>
                      {client.plan}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {client.industry && <span>{client.industry}</span>}
                    {client.contact_email && <span>{client.contact_email}</span>}
                  </div>
                </div>

                {/* Active agents */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {client.bishop_enabled && (
                    <div title="Bishop active" className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                      <Mail className="w-3 h-3 text-blue-400" />
                    </div>
                  )}
                  {client.knight_enabled && (
                    <div title="Knight active" className="w-6 h-6 rounded-full bg-purple-500/10 flex items-center justify-center">
                      <Shield className="w-3 h-3 text-purple-400" />
                    </div>
                  )}
                  {client.rook_enabled && (
                    <div title="Rook active" className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                      <RefreshCw className="w-3 h-3 text-orange-400" />
                    </div>
                  )}
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ── Add / Edit modal ─────────────────────────────── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingClient ? `Edit — ${editingClient.name}` : 'Add New Client'}</DialogTitle>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="bishop">Bishop</TabsTrigger>
              <TabsTrigger value="knight">Knight</TabsTrigger>
              <TabsTrigger value="rook">Rook</TabsTrigger>
            </TabsList>

            {/* ─ Overview tab ──────────────────────────────── */}
            <TabsContent value="overview" className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Company Name *</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Acme Corp"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Industry</Label>
                  <Input
                    value={form.industry || ''}
                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                    placeholder="B2B SaaS"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Name</Label>
                  <Input
                    value={form.contact_name || ''}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    placeholder="Sarah Chen"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Contact Email</Label>
                  <Input
                    type="email"
                    value={form.contact_email || ''}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    placeholder="sarah@acmecorp.io"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Website</Label>
                  <Input
                    value={form.website || ''}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    placeholder="https://acmecorp.io"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Slack Webhook (Queen reports)</Label>
                  <Input
                    value={form.slack_webhook_url || ''}
                    onChange={(e) => setForm({ ...form, slack_webhook_url: e.target.value })}
                    placeholder="https://hooks.slack.com/..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v: any) => setForm({ ...form, status: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pilot">Pilot</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="paused">Paused</SelectItem>
                      <SelectItem value="churned">Churned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Plan</Label>
                  <Select
                    value={form.plan}
                    onValueChange={(v: any) => setForm({ ...form, plan: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pilot">Pilot</SelectItem>
                      <SelectItem value="starter">Starter</SelectItem>
                      <SelectItem value="growth">Growth</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Pilot Start</Label>
                  <Input
                    type="date"
                    value={form.pilot_start_date || ''}
                    onChange={(e) => setForm({ ...form, pilot_start_date: e.target.value || null })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Pilot End</Label>
                  <Input
                    type="date"
                    value={form.pilot_end_date || ''}
                    onChange={(e) => setForm({ ...form, pilot_end_date: e.target.value || null })}
                  />
                </div>
              </div>
            </TabsContent>

            {/* ─ Bishop tab ────────────────────────────────── */}
            <TabsContent value="bishop" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Bishop — Outbound SDR</div>
                  <div className="text-sm text-muted-foreground">Cold email + follow-up automation</div>
                </div>
                <Switch
                  checked={form.bishop_enabled}
                  onCheckedChange={(v) => setForm({ ...form, bishop_enabled: v })}
                />
              </div>

              {form.bishop_enabled && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Value Proposition</Label>
                    <Textarea
                      value={form.bishop_value_prop || ''}
                      onChange={(e) => setForm({ ...form, bishop_value_prop: e.target.value })}
                      placeholder="What Regent is selling for this client. Be specific — Bishop injects this into every email."
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Sender Name</Label>
                      <Input
                        value={form.bishop_sender_name || ''}
                        onChange={(e) => setForm({ ...form, bishop_sender_name: e.target.value })}
                        placeholder="Alex from Acme"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Sender Email</Label>
                      <Input
                        type="email"
                        value={form.bishop_sender_email || ''}
                        onChange={(e) => setForm({ ...form, bishop_sender_email: e.target.value })}
                        placeholder="alex@acmecorp.io"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Tone</Label>
                      <Select
                        value={form.bishop_tone}
                        onValueChange={(v) => setForm({ ...form, bishop_tone: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                          <SelectItem value="direct">Direct</SelectItem>
                          <SelectItem value="friendly">Friendly</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Follow-up Interval (days)</Label>
                      <Input
                        type="number"
                        min={1}
                        max={14}
                        value={form.bishop_follow_up_days}
                        onChange={(e) => setForm({ ...form, bishop_follow_up_days: parseInt(e.target.value) || 3 })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Daily Email Limit</Label>
                      <Input
                        type="number"
                        min={1}
                        max={500}
                        value={form.bishop_daily_limit}
                        onChange={(e) => setForm({ ...form, bishop_daily_limit: parseInt(e.target.value) || 50 })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─ Knight tab ────────────────────────────────── */}
            <TabsContent value="knight" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Knight — Customer Support</div>
                  <div className="text-sm text-muted-foreground">WhatsApp / Email / Instagram</div>
                </div>
                <Switch
                  checked={form.knight_enabled}
                  onCheckedChange={(v) => setForm({ ...form, knight_enabled: v })}
                />
              </div>

              {form.knight_enabled && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>Support Policies</Label>
                    <Textarea
                      value={form.knight_policies || ''}
                      onChange={(e) => setForm({ ...form, knight_policies: e.target.value })}
                      placeholder="Paste the client's refund policy, FAQs, escalation rules, etc. Knight reads this to answer customer questions."
                      rows={5}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Tone</Label>
                      <Select
                        value={form.knight_tone}
                        onValueChange={(v) => setForm({ ...form, knight_tone: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="friendly">Friendly</SelectItem>
                          <SelectItem value="professional">Professional</SelectItem>
                          <SelectItem value="empathetic">Empathetic</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Escalation Email</Label>
                      <Input
                        type="email"
                        value={form.knight_handoff_email || ''}
                        onChange={(e) => setForm({ ...form, knight_handoff_email: e.target.value })}
                        placeholder="support@acmecorp.io"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>WhatsApp Business Number</Label>
                      <Input
                        value={form.knight_whatsapp_number || ''}
                        onChange={(e) => setForm({ ...form, knight_whatsapp_number: e.target.value })}
                        placeholder="+1 555 000 0000"
                      />
                    </div>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* ─ Rook tab ──────────────────────────────────── */}
            <TabsContent value="rook" className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">Rook — CRM Sync</div>
                  <div className="text-sm text-muted-foreground">Sync leads & tickets to the client's CRM automatically</div>
                </div>
                <Switch
                  checked={form.rook_enabled}
                  onCheckedChange={(v) => setForm({ ...form, rook_enabled: v })}
                />
              </div>

              {form.rook_enabled && (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label>CRM Type</Label>
                    <Select
                      value={form.rook_crm_type || ''}
                      onValueChange={(v) => setForm({ ...form, rook_crm_type: v || null, rook_crm_creds: null })}
                    >
                      <SelectTrigger><SelectValue placeholder="Select CRM" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hubspot">HubSpot</SelectItem>
                        <SelectItem value="salesforce">Salesforce</SelectItem>
                        <SelectItem value="zoho">Zoho CRM</SelectItem>
                        <SelectItem value="pipedrive">Pipedrive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* HubSpot */}
                  {form.rook_crm_type === 'hubspot' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Private App Access Token</Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                          value={form.rook_crm_creds?.access_token || ''}
                          onChange={(e) => setForm({
                            ...form,
                            rook_crm_creds: { ...(form.rook_crm_creds || {}), access_token: e.target.value },
                          })}
                        />
                        <p className="text-xs text-muted-foreground">
                          HubSpot → Settings → Integrations → Private Apps. Required scopes: crm.objects.contacts.write, crm.objects.tickets.write
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Salesforce */}
                  {form.rook_crm_type === 'salesforce' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Instance URL</Label>
                        <Input
                          placeholder="https://yourorg.salesforce.com"
                          value={form.rook_crm_creds?.instance_url || ''}
                          onChange={(e) => setForm({
                            ...form,
                            rook_crm_creds: { ...(form.rook_crm_creds || {}), instance_url: e.target.value },
                          })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Access Token</Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          placeholder="Salesforce OAuth2 access token"
                          value={form.rook_crm_creds?.access_token || ''}
                          onChange={(e) => setForm({
                            ...form,
                            rook_crm_creds: { ...(form.rook_crm_creds || {}), access_token: e.target.value },
                          })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Salesforce → Setup → Connected Apps → OAuth token. Needs Contacts + Cases read/write.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Zoho */}
                  {form.rook_crm_type === 'zoho' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Access Token</Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          placeholder="Zoho OAuth2 access token"
                          value={form.rook_crm_creds?.access_token || ''}
                          onChange={(e) => setForm({
                            ...form,
                            rook_crm_creds: { ...(form.rook_crm_creds || {}), access_token: e.target.value },
                          })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>API Domain <span className="text-muted-foreground">(optional)</span></Label>
                        <Input
                          placeholder="https://www.zohoapis.com (default)"
                          value={form.rook_crm_creds?.api_domain || ''}
                          onChange={(e) => setForm({
                            ...form,
                            rook_crm_creds: { ...(form.rook_crm_creds || {}), api_domain: e.target.value },
                          })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Zoho API Console → Self Client → generate token with ZohoCRM.modules.contacts.ALL and ZohoCRM.modules.Cases.ALL scopes.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Pipedrive */}
                  {form.rook_crm_type === 'pipedrive' && (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>API Token</Label>
                        <Input
                          type="password"
                          autoComplete="off"
                          placeholder="Pipedrive API token"
                          value={form.rook_crm_creds?.api_token || ''}
                          onChange={(e) => setForm({
                            ...form,
                            rook_crm_creds: { ...(form.rook_crm_creds || {}), api_token: e.target.value },
                          })}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Company Domain <span className="text-muted-foreground">(optional)</span></Label>
                        <Input
                          placeholder="yourcompany.pipedrive.com (default: api.pipedrive.com)"
                          value={form.rook_crm_creds?.company_domain || ''}
                          onChange={(e) => setForm({
                            ...form,
                            rook_crm_creds: { ...(form.rook_crm_creds || {}), company_domain: e.target.value },
                          })}
                        />
                        <p className="text-xs text-muted-foreground">
                          Pipedrive → Settings → Personal preferences → API. Token has full account access.
                        </p>
                      </div>
                    </div>
                  )}

                  {form.rook_crm_type && (
                    <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
                      Credentials are stored encrypted in your workspace. Rook will sync leads automatically when Bishop sends emails, and can be triggered manually from the Rook dashboard.
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingClient ? 'Save Changes' : 'Add Client'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

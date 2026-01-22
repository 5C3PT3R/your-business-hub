/**
 * Bishop Settings Page (Master PRD)
 *
 * Tabs:
 * - 📡 Radar: Stats (Active Deals, Reply Rate, Revenue)
 * - 📖 Playbook: Toggle strategies, edit timing
 * - 🗣️ Identity: LinkedIn URL, Golden Samples, Voice Tone
 * - 🛡️ Blacklist: Domain exclusions
 */

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Radio,
  BookOpen,
  User,
  Shield,
  Loader2,
  Save,
  Sparkles,
  TrendingUp,
  Mail,
  Clock,
  Ban,
  Plus,
  X,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BishopSettings {
  user_id: string;
  linkedin_profile_url: string;
  voice_tone: string;
  signature_html: string;
  golden_samples: string[];
  blacklisted_domains: string[];
  enable_sniper_intro: boolean;
  enable_value_nudge: boolean;
  enable_breakup: boolean;
  days_to_first_followup: number;
  days_to_second_followup: number;
  days_to_breakup: number;
  persona_prompt: string;
}

const DEFAULT_SETTINGS: BishopSettings = {
  user_id: '',
  linkedin_profile_url: '',
  voice_tone: 'Professional',
  signature_html: '',
  golden_samples: [],
  blacklisted_domains: [],
  enable_sniper_intro: true,
  enable_value_nudge: true,
  enable_breakup: true,
  days_to_first_followup: 3,
  days_to_second_followup: 4,
  days_to_breakup: 7,
  persona_prompt: '',
};

const VOICE_TONES = [
  { value: 'Professional', label: 'Professional', description: 'Formal and business-like' },
  { value: 'Direct', label: 'Direct', description: 'Straightforward and concise' },
  { value: 'Consultative', label: 'Consultative', description: 'Helpful and advisory' },
  { value: 'Friendly', label: 'Friendly', description: 'Warm and personable' },
  { value: 'Casual', label: 'Casual', description: 'Relaxed and conversational' },
];

export default function BishopSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<BishopSettings>(DEFAULT_SETTINGS);
  const [newDomain, setNewDomain] = useState('');
  const [newSample, setNewSample] = useState('');

  // Stats (mock for now)
  const [stats] = useState({
    activeLeads: 12,
    draftsGenerated: 34,
    replyRate: 18.5,
    revenueRecovered: 45000,
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    if (!user) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('bishop_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
    }

    if (data) {
      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
        golden_samples: data.golden_samples || [],
        blacklisted_domains: data.blacklisted_domains || [],
      });
    } else {
      setSettings({ ...DEFAULT_SETTINGS, user_id: user.id });
    }

    setLoading(false);
  };

  const saveSettings = async () => {
    if (!user) return;

    setSaving(true);
    const { error } = await supabase
      .from('bishop_settings')
      .upsert({
        ...settings,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      });

    setSaving(false);

    if (error) {
      toast({
        title: 'Error saving settings',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Settings saved',
        description: 'Your Bishop settings have been updated.',
      });
    }
  };

  const addDomain = () => {
    if (newDomain && !settings.blacklisted_domains.includes(newDomain.toLowerCase())) {
      setSettings({
        ...settings,
        blacklisted_domains: [...settings.blacklisted_domains, newDomain.toLowerCase()],
      });
      setNewDomain('');
    }
  };

  const removeDomain = (domain: string) => {
    setSettings({
      ...settings,
      blacklisted_domains: settings.blacklisted_domains.filter((d) => d !== domain),
    });
  };

  const addSample = () => {
    if (newSample && settings.golden_samples.length < 5) {
      setSettings({
        ...settings,
        golden_samples: [...settings.golden_samples, newSample],
      });
      setNewSample('');
    }
  };

  const removeSample = (index: number) => {
    setSettings({
      ...settings,
      golden_samples: settings.golden_samples.filter((_, i) => i !== index),
    });
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Header
        title="Bishop Settings"
        subtitle="Configure your AI outbound agent"
        icon={<Sparkles className="h-6 w-6" />}
      />

      <div className="p-4 md:p-6 max-w-4xl">
        <Tabs defaultValue="radar" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="radar" className="gap-2">
              <Radio className="h-4 w-4" />
              <span className="hidden sm:inline">Radar</span>
            </TabsTrigger>
            <TabsTrigger value="playbook" className="gap-2">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Playbook</span>
            </TabsTrigger>
            <TabsTrigger value="identity" className="gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Identity</span>
            </TabsTrigger>
            <TabsTrigger value="blacklist" className="gap-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Blacklist</span>
            </TabsTrigger>
          </TabsList>

          {/* RADAR TAB */}
          <TabsContent value="radar">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Active Leads</CardDescription>
                  <CardTitle className="text-2xl">{stats.activeLeads}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                    Being processed by Bishop
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Drafts Generated</CardDescription>
                  <CardTitle className="text-2xl">{stats.draftsGenerated}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 mr-1" />
                    This month
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Reply Rate</CardDescription>
                  <CardTitle className="text-2xl">{stats.replyRate}%</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <TrendingUp className="h-4 w-4 mr-1 text-green-500" />
                    +2.3% from last month
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Revenue Recovered</CardDescription>
                  <CardTitle className="text-2xl">${stats.revenueRecovered.toLocaleString()}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Sparkles className="h-4 w-4 mr-1 text-primary" />
                    From stalled deals
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* PLAYBOOK TAB */}
          <TabsContent value="playbook">
            <Card>
              <CardHeader>
                <CardTitle>Strategy Settings</CardTitle>
                <CardDescription>
                  Configure which outreach strategies Bishop should use
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Strategy Toggles */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">🟢 Sniper Intro</p>
                      <p className="text-sm text-muted-foreground">
                        First contact email for NEW leads
                      </p>
                    </div>
                    <Switch
                      checked={settings.enable_sniper_intro}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, enable_sniper_intro: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">🟡 Value Nudge</p>
                      <p className="text-sm text-muted-foreground">
                        Follow-up with value after {settings.days_to_first_followup}+ days
                      </p>
                    </div>
                    <Switch
                      checked={settings.enable_value_nudge}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, enable_value_nudge: checked })
                      }
                    />
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg border">
                    <div>
                      <p className="font-medium">🔴 Breakup</p>
                      <p className="text-sm text-muted-foreground">
                        Final message after {settings.days_to_breakup}+ days
                      </p>
                    </div>
                    <Switch
                      checked={settings.enable_breakup}
                      onCheckedChange={(checked) =>
                        setSettings({ ...settings, enable_breakup: checked })
                      }
                    />
                  </div>
                </div>

                {/* Timing Settings */}
                <div className="pt-4 border-t">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Timing (Days)
                  </h4>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2">
                      <Label>First Follow-up</Label>
                      <Input
                        type="number"
                        min={1}
                        max={14}
                        value={settings.days_to_first_followup}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            days_to_first_followup: parseInt(e.target.value) || 3,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Second Follow-up</Label>
                      <Input
                        type="number"
                        min={1}
                        max={14}
                        value={settings.days_to_second_followup}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            days_to_second_followup: parseInt(e.target.value) || 4,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Breakup After</Label>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={settings.days_to_breakup}
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            days_to_breakup: parseInt(e.target.value) || 7,
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* IDENTITY TAB */}
          <TabsContent value="identity">
            <Card>
              <CardHeader>
                <CardTitle>Identity Calibration</CardTitle>
                <CardDescription>
                  Configure Bishop's voice to match your personal style
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* LinkedIn URL */}
                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn Profile URL</Label>
                  <Input
                    id="linkedin"
                    placeholder="https://linkedin.com/in/yourprofile"
                    value={settings.linkedin_profile_url}
                    onChange={(e) =>
                      setSettings({ ...settings, linkedin_profile_url: e.target.value })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Bishop will analyze your profile to match your communication style
                  </p>
                </div>

                {/* Voice Tone */}
                <div className="space-y-2">
                  <Label>Voice Tone</Label>
                  <Select
                    value={settings.voice_tone}
                    onValueChange={(value) => setSettings({ ...settings, voice_tone: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_TONES.map((tone) => (
                        <SelectItem key={tone.value} value={tone.value}>
                          <div>
                            <span className="font-medium">{tone.label}</span>
                            <span className="text-muted-foreground ml-2">- {tone.description}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Golden Samples */}
                <div className="space-y-2">
                  <Label>Golden Samples ({settings.golden_samples.length}/5)</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Paste your best emails for Bishop to learn your style
                  </p>

                  {settings.golden_samples.map((sample, index) => (
                    <div key={index} className="relative p-3 rounded-lg border bg-muted/50">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2 h-6 w-6 p-0"
                        onClick={() => removeSample(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                      <p className="text-sm pr-8 line-clamp-3">{sample}</p>
                    </div>
                  ))}

                  {settings.golden_samples.length < 5 && (
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Paste a successful email you've written..."
                        value={newSample}
                        onChange={(e) => setNewSample(e.target.value)}
                        rows={4}
                      />
                      <Button variant="outline" size="sm" onClick={addSample} disabled={!newSample}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Sample
                      </Button>
                    </div>
                  )}
                </div>

                {/* Signature */}
                <div className="space-y-2">
                  <Label htmlFor="signature">Email Signature (HTML)</Label>
                  <Textarea
                    id="signature"
                    placeholder="<p>Best,<br>Your Name</p>"
                    value={settings.signature_html}
                    onChange={(e) => setSettings({ ...settings, signature_html: e.target.value })}
                    rows={4}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* BLACKLIST TAB */}
          <TabsContent value="blacklist">
            <Card>
              <CardHeader>
                <CardTitle>Domain Blacklist</CardTitle>
                <CardDescription>
                  Bishop will skip leads from these domains
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="competitor.com"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addDomain()}
                  />
                  <Button onClick={addDomain} disabled={!newDomain}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                {settings.blacklisted_domains.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No domains blacklisted. Add domains to exclude from outreach.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {settings.blacklisted_domains.map((domain) => (
                      <div
                        key={domain}
                        className="flex items-center gap-1 px-3 py-1 rounded-full bg-destructive/10 text-destructive text-sm"
                      >
                        <Ban className="h-3 w-3" />
                        {domain}
                        <button
                          onClick={() => removeDomain(domain)}
                          className="ml-1 hover:text-destructive/80"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Common exclusions: competitor domains, government (.gov), education (.edu)
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end mt-6">
          <Button onClick={saveSettings} disabled={saving} variant="gradient">
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}

import { useState, useEffect, useCallback, KeyboardEvent } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Target, Loader2, Search, Users, CheckCircle, AlertCircle,
  Globe, X, ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface IcpSettings {
  icp_titles: string[];
  icp_industries: string[];
  icp_company_size_max: number;
  icp_locations: string[];
  icp_keywords: string[];
  enabled_sources: string[];
}

interface RunHistoryRow {
  id: string;
  created_at: string;
  job_type: string;
  total: number;
  clean: number;
  duplicates: number;
  invalid: number;
}

const DEFAULT_ICP: IcpSettings = {
  icp_titles: ['Founder', 'CEO', 'CTO'],
  icp_industries: ['SaaS', 'B2B Software'],
  icp_company_size_max: 200,
  icp_locations: [],
  icp_keywords: [],
  enabled_sources: ['product_hunt', 'hacker_news'],
};

const SOURCES = [
  {
    id: 'apollo',
    label: 'Apollo.io',
    description: 'B2B lead database — search by title, industry, size',
    requiresKey: true,
    keyName: 'APOLLO_API_KEY',
  },
  {
    id: 'hunter',
    label: 'Hunter.io',
    description: 'Email finder — find contacts by company domain',
    requiresKey: true,
    keyName: 'HUNTER_API_KEY',
  },
  {
    id: 'product_hunt',
    label: 'Product Hunt',
    description: 'SaaS founders from latest product launches',
    requiresKey: false,
  },
  {
    id: 'hacker_news',
    label: 'Hacker News',
    description: '"Who is Hiring" threads — startup contacts',
    requiresKey: false,
  },
  {
    id: 'url',
    label: 'Custom URL',
    description: 'Scrape emails from any webpage or directory',
    requiresKey: false,
  },
];

// ─── Tag input component ──────────────────────────────────
function TagInput({
  tags,
  onChange,
  placeholder,
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 p-2 rounded-lg border min-h-[42px] cursor-text"
      style={{ borderColor: '#E7E5E4', background: '#fff' }}
      onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
    >
      {tags.map(tag => (
        <span
          key={tag}
          className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
          style={{ background: '#fff0e6', color: '#CC5500', fontFamily: "'Space Grotesk', sans-serif" }}
        >
          {tag}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(tags.filter(t => t !== tag)); }}
            className="hover:opacity-70"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={inputValue}
        onChange={e => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
        placeholder={tags.length === 0 ? placeholder : ''}
        className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        style={{ color: '#1C1917' }}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────
export default function BishopProspect() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [icp, setIcp] = useState<IcpSettings>(DEFAULT_ICP);
  const [customUrl, setCustomUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [prospecting, setProspecting] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistoryRow[]>([]);
  const [lastResult, setLastResult] = useState<{
    total: number; clean: number; duplicates: number; invalid: number; inserted: number;
  } | null>(null);

  const loadSettings = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('bishop_settings')
      .select('icp_titles, icp_industries, icp_company_size_max, icp_locations, icp_keywords, enabled_sources')
      .eq('user_id', user.id)
      .maybeSingle();

    if (data) {
      setIcp({
        icp_titles: data.icp_titles ?? DEFAULT_ICP.icp_titles,
        icp_industries: data.icp_industries ?? DEFAULT_ICP.icp_industries,
        icp_company_size_max: data.icp_company_size_max ?? DEFAULT_ICP.icp_company_size_max,
        icp_locations: data.icp_locations ?? DEFAULT_ICP.icp_locations,
        icp_keywords: data.icp_keywords ?? DEFAULT_ICP.icp_keywords,
        enabled_sources: data.enabled_sources ?? DEFAULT_ICP.enabled_sources,
      });
    }
  }, [user]);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('pawn_jobs')
      .select('id, created_at, job_type, total, clean, duplicates, invalid')
      .order('created_at', { ascending: false })
      .limit(10);
    setRunHistory(data ?? []);
  }, [user]);

  useEffect(() => {
    loadSettings();
    loadHistory();
  }, [loadSettings, loadHistory]);

  const saveSettings = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from('bishop_settings')
      .upsert({
        user_id: user.id,
        icp_titles: icp.icp_titles,
        icp_industries: icp.icp_industries,
        icp_company_size_max: icp.icp_company_size_max,
        icp_locations: icp.icp_locations,
        icp_keywords: icp.icp_keywords,
        enabled_sources: icp.enabled_sources,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) {
      toast({ title: 'Save failed', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'ICP saved' });
    }
    setSaving(false);
  };

  const toggleSource = (sourceId: string) => {
    setIcp(prev => ({
      ...prev,
      enabled_sources: prev.enabled_sources.includes(sourceId)
        ? prev.enabled_sources.filter(s => s !== sourceId)
        : [...prev.enabled_sources, sourceId],
    }));
  };

  const handleFindLeads = async () => {
    if (!user) return;
    if (icp.enabled_sources.length === 0) {
      toast({ title: 'Select at least one source', variant: 'destructive' });
      return;
    }

    setProspecting(true);
    setLastResult(null);

    try {
      // Save ICP first
      await saveSettings();

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const fnUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bishop-prospect`;
      const res = await fetch(fnUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          user_id: user.id,
          sources: icp.enabled_sources,
          icp: {
            titles: icp.icp_titles,
            industries: icp.icp_industries,
            company_size_max: icp.icp_company_size_max,
            locations: icp.icp_locations,
            keywords: icp.icp_keywords,
            target_url: icp.enabled_sources.includes('url') ? customUrl : undefined,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      const stats = data?.stats ?? {};
      setLastResult({
        total: stats.total ?? 0,
        clean: stats.clean ?? 0,
        duplicates: stats.duplicates ?? 0,
        invalid: stats.invalid ?? 0,
        inserted: stats.inserted ?? 0,
      });

      const breakdown = data?.source_breakdown ?? {};
      const breakdownStr = Object.entries(breakdown).map(([k, v]) => `${k}: ${v}`).join(' · ');
      toast({
        title: `${stats.inserted ?? 0} new leads found`,
        description: breakdownStr || `${stats.duplicates ?? 0} dupes, ${stats.invalid ?? 0} invalid`,
      });

      await loadHistory();
    } catch (e: any) {
      toast({ title: 'Prospecting failed', description: e.message, variant: 'destructive' });
    } finally {
      setProspecting(false);
    }
  };

  return (
    <MainLayout>
      <Header
        title="Prospecting"
        subtitle="Configure your ICP and find leads from multiple sources"
        icon={<Target className="h-6 w-6" style={{ color: '#CC5500' }} />}
      />

      <div className="p-4 md:p-6 max-w-4xl" style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* ICP Config */}
        <div className="rounded-xl border mb-6" style={{ borderColor: '#E7E5E4', background: '#fff' }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: '#E7E5E4' }}>
            <h2 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#1C1917', letterSpacing: '0.04em' }}>
              IDEAL CUSTOMER PROFILE
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#a8a29e' }}>
              Define who Bishop should target. Press Enter or comma to add tags.
            </p>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Titles */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#78716c', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em' }}>
                TARGET TITLES
              </label>
              <TagInput
                tags={icp.icp_titles}
                onChange={tags => setIcp(p => ({ ...p, icp_titles: tags }))}
                placeholder="Founder, CEO, Head of Sales…"
              />
            </div>

            {/* Industries */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#78716c', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em' }}>
                INDUSTRIES
              </label>
              <TagInput
                tags={icp.icp_industries}
                onChange={tags => setIcp(p => ({ ...p, icp_industries: tags }))}
                placeholder="SaaS, Fintech, E-commerce…"
              />
            </div>

            {/* Locations */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#78716c', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em' }}>
                LOCATIONS
              </label>
              <TagInput
                tags={icp.icp_locations}
                onChange={tags => setIcp(p => ({ ...p, icp_locations: tags }))}
                placeholder="United States, UK, Canada…"
              />
            </div>

            {/* Keywords */}
            <div>
              <label className="block text-xs font-semibold mb-1.5" style={{ color: '#78716c', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em' }}>
                KEYWORDS
              </label>
              <TagInput
                tags={icp.icp_keywords}
                onChange={tags => setIcp(p => ({ ...p, icp_keywords: tags }))}
                placeholder="bootstrapped, Series A, hiring…"
              />
            </div>

            {/* Company size */}
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold mb-3" style={{ color: '#78716c', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em' }}>
                MAX COMPANY SIZE — {icp.icp_company_size_max} employees
              </label>
              <Slider
                min={1}
                max={500}
                step={10}
                value={[icp.icp_company_size_max]}
                onValueChange={([v]) => setIcp(p => ({ ...p, icp_company_size_max: v }))}
                className="w-full"
              />
              <div className="flex justify-between mt-1">
                <span className="text-xs" style={{ color: '#a8a29e' }}>1</span>
                <span className="text-xs" style={{ color: '#a8a29e' }}>500+</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sources */}
        <div className="rounded-xl border mb-6" style={{ borderColor: '#E7E5E4', background: '#fff' }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: '#E7E5E4' }}>
            <h2 className="font-semibold text-sm" style={{ fontFamily: "'Space Grotesk', sans-serif", color: '#1C1917', letterSpacing: '0.04em' }}>
              LEAD SOURCES
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#a8a29e' }}>
              Select which sources Bishop should pull from
            </p>
          </div>

          <div className="p-5 space-y-3">
            {SOURCES.map(source => {
              const active = icp.enabled_sources.includes(source.id);
              return (
                <div key={source.id}>
                  <button
                    onClick={() => toggleSource(source.id)}
                    className="w-full flex items-center gap-4 p-3 rounded-xl border transition-all text-left"
                    style={{
                      borderColor: active ? '#CC5500' : '#E7E5E4',
                      background: active ? '#fff8f5' : '#fafaf9',
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: active ? '#CC5500' : '#E7E5E4' }}
                    >
                      <Globe className="h-4 w-4" style={{ color: active ? '#fff' : '#78716c' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold" style={{ color: '#1C1917' }}>{source.label}</p>
                        {source.requiresKey && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#fef3c7', color: '#d97706', fontFamily: "'Space Grotesk', sans-serif" }}>
                            API key required
                          </span>
                        )}
                        {!source.requiresKey && (
                          <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#dcfce7', color: '#16a34a', fontFamily: "'Space Grotesk', sans-serif" }}>
                            Free
                          </span>
                        )}
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: '#78716c' }}>{source.description}</p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                      style={{ borderColor: active ? '#CC5500' : '#d6d3d1', background: active ? '#CC5500' : 'transparent' }}
                    >
                      {active && <CheckCircle className="h-3 w-3" style={{ color: '#fff' }} />}
                    </div>
                  </button>

                  {/* Custom URL input */}
                  {source.id === 'url' && active && (
                    <div className="mt-2 ml-12">
                      <Input
                        value={customUrl}
                        onChange={e => setCustomUrl(e.target.value)}
                        placeholder="https://example.com/team or any page with emails"
                        className="text-sm"
                        style={{ borderColor: '#E7E5E4' }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Result banner */}
        {lastResult && (
          <div
            className="rounded-xl border p-4 mb-6 flex items-start gap-3"
            style={{ borderColor: '#d1fae5', background: '#f0fdf4' }}
          >
            <CheckCircle className="h-5 w-5 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: '#15803d' }}>
                {lastResult.inserted} new leads added to pipeline
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#4ade80' }}>
                {lastResult.total} raw · {lastResult.clean} clean · {lastResult.duplicates} dupes skipped · {lastResult.invalid} invalid
              </p>
            </div>
          </div>
        )}

        {/* Find Leads button */}
        <div className="flex items-center gap-3 mb-8">
          <Button
            onClick={handleFindLeads}
            disabled={prospecting || icp.enabled_sources.length === 0}
            className="px-6"
            style={{ background: '#CC5500', color: '#fff', border: 'none' }}
          >
            {prospecting
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Finding leads…</>
              : <><Search className="h-4 w-4 mr-2" /> Find Leads</>
            }
          </Button>
          <Button
            variant="outline"
            onClick={saveSettings}
            disabled={saving}
            style={{ borderColor: '#E7E5E4' }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Save ICP
          </Button>
          {icp.enabled_sources.length === 0 && (
            <span className="flex items-center gap-1 text-xs" style={{ color: '#d97706' }}>
              <AlertCircle className="h-3.5 w-3.5" /> Select at least one source
            </span>
          )}
        </div>

        {/* Run history */}
        {runHistory.length > 0 && (
          <div>
            <h2 className="text-xs font-semibold mb-3" style={{ color: '#a8a29e', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em' }}>
              RUN HISTORY
            </h2>
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E7E5E4' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#FDFBF7', borderBottom: '1px solid #E7E5E4' }}>
                    {['Source', 'New Leads', 'Dupes', 'Invalid', 'When'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold"
                        style={{ color: '#a8a29e', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em' }}>
                        {h.toUpperCase()}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {runHistory.map((row, idx) => (
                    <tr
                      key={row.id}
                      style={{ borderBottom: idx < runHistory.length - 1 ? '1px solid #E7E5E4' : 'none', background: '#fff' }}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: '#1C1917' }}>
                          {row.job_type || 'verify'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold" style={{ color: '#CC5500' }}>
                          {row.clean ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#78716c' }}>
                        {row.duplicates ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#78716c' }}>
                        {row.invalid ?? 0}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: '#a8a29e' }}>
                        {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {runHistory.length === 0 && !prospecting && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mb-4" style={{ background: '#F5F4F0' }}>
              <Users className="h-7 w-7" style={{ color: '#a8a29e' }} />
            </div>
            <p className="text-sm" style={{ color: '#78716c' }}>
              No prospecting runs yet. Configure your ICP above and hit Find Leads.
            </p>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

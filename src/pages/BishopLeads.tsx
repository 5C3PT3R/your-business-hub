import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Swords, Loader2, Users, ArrowRight, AlertCircle, CalendarCheck } from 'lucide-react';
import { formatDistanceToNow, isPast, parseISO } from 'date-fns';

interface BishopLead {
  id: string;
  name: string | null;
  company: string | null;
  email: string | null;
  bishop_status: string | null;
  last_contact_date: string | null;
  next_action_due: string | null;
  meeting_booked_at: string | null;
  pendingDrafts?: number;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  INTRO_SENT:        { label: 'Intro Sent',     color: '#0ea5e9', bg: '#e0f2fe' },
  FOLLOW_UP_NEEDED:  { label: 'Follow-Up',      color: '#d97706', bg: '#fef3c7' },
  NUDGE_SENT:        { label: 'Nudge Sent',     color: '#CC5500', bg: '#fff0e6' },
  BREAKUP_SENT:      { label: 'Breakup',        color: '#dc2626', bg: '#fee2e2' },
  ESCALATE_TO_KING:  { label: 'Escalated',      color: '#7c3aed', bg: '#ede9fe' },
  MEETING_BOOKED:    { label: 'Meeting Booked', color: '#16a34a', bg: '#dcfce7' },
};

const ACTIVE_STATUSES = ['INTRO_SENT', 'FOLLOW_UP_NEEDED', 'NUDGE_SENT', 'BREAKUP_SENT', 'ESCALATE_TO_KING'];

const FILTER_TABS = [
  { id: 'all',              label: 'All' },
  { id: 'overdue',          label: 'Overdue' },
  { id: 'INTRO_SENT',       label: 'Intro' },
  { id: 'FOLLOW_UP_NEEDED', label: 'Follow-Up' },
  { id: 'NUDGE_SENT',       label: 'Nudge' },
  { id: 'BREAKUP_SENT',     label: 'Breakup' },
  { id: 'booked',           label: '✓ Booked' },
];

export default function BishopLeads() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [leads, setLeads] = useState<BishopLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState('all');
  const [bookingId, setBookingId] = useState<string | null>(null);

  const loadLeads = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Fetch active pipeline leads + booked leads
    const { data: leadRows, error } = await supabase
      .from('leads')
      .select('id, name, company, email, bishop_status, last_contact_date, next_action_due, meeting_booked_at')
      .or(`bishop_status.in.(${ACTIVE_STATUSES.join(',')}),meeting_booked_at.not.is.null`)
      .order('next_action_due', { ascending: true, nullsFirst: false });

    if (error) { console.error(error); setLoading(false); return; }

    // Count pending drafts per lead
    const leadIds = (leadRows ?? []).map(l => l.id);
    let draftCounts: Record<string, number> = {};
    if (leadIds.length > 0) {
      const { data: draftRows } = await supabase
        .from('ai_drafts')
        .select('lead_id')
        .in('lead_id', leadIds)
        .eq('status', 'PENDING_APPROVAL');
      for (const d of draftRows ?? []) {
        draftCounts[d.lead_id] = (draftCounts[d.lead_id] ?? 0) + 1;
      }
    }

    setLeads((leadRows ?? []).map(l => ({ ...l, pendingDrafts: draftCounts[l.id] ?? 0 })));
    setLoading(false);
  }, [user]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const isOverdue = (l: BishopLead) =>
    !!l.next_action_due && !l.meeting_booked_at && isPast(parseISO(l.next_action_due));

  const isBooked = (l: BishopLead) => !!l.meeting_booked_at;

  const filtered = (() => {
    if (activeFilter === 'all') return leads.filter(l => !isBooked(l));
    if (activeFilter === 'overdue') return leads.filter(l => isOverdue(l));
    if (activeFilter === 'booked') return leads.filter(l => isBooked(l));
    return leads.filter(l => l.bishop_status === activeFilter && !isBooked(l));
  })();

  const handleMarkBooked = async (lead: BishopLead, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookingId(lead.id);
    const { error } = await supabase
      .from('leads')
      .update({ meeting_booked_at: new Date().toISOString() })
      .eq('id', lead.id);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Meeting booked!', description: `${lead.name ?? 'Lead'} marked as booked` });
      setLeads(prev => prev.map(l =>
        l.id === lead.id ? { ...l, meeting_booked_at: new Date().toISOString() } : l
      ));
    }
    setBookingId(null);
  };

  const bookedCount = leads.filter(isBooked).length;
  const activeLeads = leads.filter(l => !isBooked(l));

  return (
    <MainLayout>
      <Header
        title="Leads Pipeline"
        subtitle="All leads Bishop is actively working through the sequence"
        icon={<Swords className="h-6 w-6" style={{ color: '#CC5500' }} />}
      />

      <div className="p-4 md:p-6" style={{ fontFamily: "'Inter', sans-serif" }}>

        {/* Summary strip */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total Active',    value: activeLeads.length },
            { label: 'Overdue',         value: activeLeads.filter(isOverdue).length, warn: true },
            { label: 'Pending Drafts',  value: activeLeads.reduce((s, l) => s + (l.pendingDrafts ?? 0), 0) },
            { label: 'In Breakup',      value: activeLeads.filter(l => l.bishop_status === 'BREAKUP_SENT').length },
            { label: 'Meetings Booked', value: bookedCount, success: true },
          ].map(m => (
            <div key={m.label} className="rounded-xl border p-4"
              style={{ background: '#fff', borderColor: '#E7E5E4' }}>
              <p className="text-xs mb-1" style={{ color: '#a8a29e', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.05em' }}>
                {m.label.toUpperCase()}
              </p>
              <p className="text-2xl font-bold" style={{
                color: (m as any).warn && activeLeads.filter(isOverdue).length > 0
                  ? '#CC5500'
                  : (m as any).success && bookedCount > 0
                    ? '#16a34a'
                    : '#1C1917',
                fontFamily: "'Instrument Serif', serif",
              }}>
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-5 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className="px-3 py-1.5 rounded-full text-sm font-medium transition-all"
              style={{
                background: activeFilter === tab.id ? '#CC5500' : '#F5F4F0',
                color: activeFilter === tab.id ? '#fff' : '#78716c',
                fontFamily: "'Space Grotesk', sans-serif",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#CC5500' }} />
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#F5F4F0' }}>
              {activeFilter === 'booked'
                ? <CalendarCheck className="h-8 w-8" style={{ color: '#16a34a' }} />
                : <Users className="h-8 w-8" style={{ color: '#a8a29e' }} />
              }
            </div>
            <h3 className="text-lg font-semibold mb-1" style={{ fontFamily: "'Instrument Serif', serif", color: '#1C1917' }}>
              {activeFilter === 'booked' ? 'No meetings booked yet' : 'No leads in pipeline'}
            </h3>
            <p className="text-sm" style={{ color: '#78716c' }}>
              {activeFilter === 'booked'
                ? 'Mark leads as booked when they agree to a meeting.'
                : 'Use Prospecting to find leads, then Bishop will follow up automatically.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && filtered.length > 0 && (
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#E7E5E4' }}>
            <table className="w-full">
              <thead>
                <tr style={{ background: '#FDFBF7', borderBottom: '1px solid #E7E5E4' }}>
                  {['Lead', 'Status', 'Last Contact', 'Next Action', 'Drafts', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold"
                      style={{ color: '#a8a29e', fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '0.06em' }}>
                      {h.toUpperCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((lead, idx) => {
                  const overdue = isOverdue(lead);
                  const booked = isBooked(lead);
                  const statusKey = booked ? 'MEETING_BOOKED' : (lead.bishop_status ?? '');
                  const sm = STATUS_META[statusKey] ?? { label: statusKey, color: '#78716c', bg: '#f5f5f4' };

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => !booked && navigate(`/bishop/drafts?lead_id=${lead.id}`)}
                      className={`transition-colors hover:bg-[#FDFBF7] ${booked ? '' : 'cursor-pointer'}`}
                      style={{
                        borderBottom: idx < filtered.length - 1 ? '1px solid #E7E5E4' : 'none',
                        borderLeft: booked
                          ? '3px solid #16a34a'
                          : overdue
                            ? '3px solid #d97706'
                            : '3px solid transparent',
                        background: '#fff',
                      }}
                    >
                      {/* Lead */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                            style={{ background: '#F5F4F0', color: '#1C1917' }}>
                            {(lead.name ?? '?')[0].toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-sm" style={{ color: '#1C1917' }}>{lead.name ?? '—'}</p>
                            <p className="text-xs" style={{ color: '#a8a29e' }}>{lead.company ?? lead.email ?? '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap"
                          style={{ background: sm.bg, color: sm.color, fontFamily: "'Space Grotesk', sans-serif" }}>
                          {sm.label}
                        </span>
                      </td>

                      {/* Last contact */}
                      <td className="px-4 py-4 text-sm" style={{ color: '#78716c' }}>
                        {lead.last_contact_date
                          ? formatDistanceToNow(parseISO(lead.last_contact_date), { addSuffix: true })
                          : '—'}
                      </td>

                      {/* Next action / booked date */}
                      <td className="px-4 py-4">
                        {booked ? (
                          <span className="text-sm" style={{ color: '#16a34a' }}>
                            Booked {formatDistanceToNow(parseISO(lead.meeting_booked_at!), { addSuffix: true })}
                          </span>
                        ) : lead.next_action_due ? (
                          <span className="text-sm flex items-center gap-1"
                            style={{ color: overdue ? '#CC5500' : '#78716c' }}>
                            {overdue && <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />}
                            {formatDistanceToNow(parseISO(lead.next_action_due), { addSuffix: true })}
                          </span>
                        ) : <span className="text-sm" style={{ color: '#a8a29e' }}>—</span>}
                      </td>

                      {/* Pending drafts */}
                      <td className="px-4 py-4">
                        {!booked && (lead.pendingDrafts ?? 0) > 0 ? (
                          <span className="px-2 py-0.5 rounded-full text-xs font-semibold"
                            style={{ background: '#fff0e6', color: '#CC5500' }}>
                            {lead.pendingDrafts} pending
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: '#a8a29e' }}>{booked ? '—' : 'None'}</span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-4">
                        {booked ? (
                          <CalendarCheck className="h-4 w-4" style={{ color: '#16a34a' }} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleMarkBooked(lead, e)}
                              disabled={bookingId === lead.id}
                              className="text-xs h-7 px-2 whitespace-nowrap"
                              style={{ borderColor: '#E7E5E4', color: '#16a34a' }}
                            >
                              {bookingId === lead.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <><CalendarCheck className="h-3 w-3 mr-1" />Booked</>
                              }
                            </Button>
                            <ArrowRight className="h-4 w-4" style={{ color: '#d6d3d1' }} />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}

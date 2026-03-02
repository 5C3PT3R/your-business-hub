import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Header } from '@/components/layout/Header';
import { cn } from '@/lib/utils';
import {
  Zap, Shield, Cpu, Swords, Castle, ScanSearch,
  Crown, Mail, ClipboardList, Banknote, AlertTriangle,
  Clock, Check, AlertCircle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────

type WorkflowStatus = 'active' | 'paused' | 'error';

interface ChainNode {
  name:    string;
  Icon:    React.ElementType;
  special: boolean; // rust/human node
}

interface WorkflowDef {
  id:          string;
  name:        string;
  status:      WorkflowStatus;
  trigger:     { label: string; Icon: React.ElementType };
  chain:       ChainNode[];
  lastRun:     string;
  successRate: number | null;
  errorCount:  number | null;
  errorNote:   string | null;
}

// ─── Static workflow definitions ──────────────────────────
// These describe the Regent BPO system architecture — agent pipelines,
// not user-created records.

const WORKFLOWS: WorkflowDef[] = [
  {
    id:          'ticket-resolution',
    name:        'New Ticket to Resolution',
    status:      'active',
    trigger:     { label: 'Email / WhatsApp', Icon: Mail },
    chain:       [
      { name: 'Knight', Icon: Shield,  special: false },
      { name: 'Queen',  Icon: Cpu,     special: false },
    ],
    lastRun:     '2m ago',
    successRate: 98,
    errorCount:  null,
    errorNote:   null,
  },
  {
    id:          'lead-qualification',
    name:        'Lead Qualification Flow',
    status:      'active',
    trigger:     { label: 'Pawn Import', Icon: ClipboardList },
    chain:       [
      { name: 'Pawn',   Icon: ScanSearch, special: false },
      { name: 'Bishop', Icon: Swords,     special: false },
      { name: 'Queen',  Icon: Cpu,        special: false },
      { name: 'Rook',   Icon: Castle,     special: false },
    ],
    lastRun:     '15m ago',
    successRate: 94,
    errorCount:  null,
    errorNote:   null,
  },
  {
    id:          'crm-sync',
    name:        'CRM Data Sync',
    status:      'active',
    trigger:     { label: 'Deal Closed', Icon: Banknote },
    chain:       [
      { name: 'Rook',  Icon: Castle, special: false },
      { name: 'Queen', Icon: Cpu,    special: false },
    ],
    lastRun:     '1h ago',
    successRate: 100,
    errorCount:  null,
    errorNote:   null,
  },
  {
    id:          'escalation-routing',
    name:        'Escalation Routing',
    status:      'active',
    trigger:     { label: 'Alert', Icon: AlertTriangle },
    chain:       [
      { name: 'Knight',      Icon: Shield, special: false },
      { name: 'King (Human)', Icon: Crown,  special: true },
    ],
    lastRun:     '10m ago',
    successRate: 100,
    errorCount:  null,
    errorNote:   null,
  },
  {
    id:          'bishop-outreach',
    name:        'Cold Outreach Campaign',
    status:      'paused',
    trigger:     { label: 'Hourly', Icon: Clock },
    chain:       [
      { name: 'Pawn',   Icon: ScanSearch, special: false },
      { name: 'Bishop', Icon: Swords,     special: false },
      { name: 'Rook',   Icon: Castle,     special: false },
    ],
    lastRun:     '3h ago',
    successRate: null,
    errorCount:  2,
    errorNote:   'Sync paused: BISHOP_AUTO_SEND not set. Enable autonomous mode or approve drafts manually.',
  },
];

// ─── Sub-components ───────────────────────────────────────

function ChainConnector() {
  return (
    <div className="flex items-center mx-2 shrink-0">
      {/* line */}
      <div className="w-8 lg:w-14 h-px bg-[#E7E5E4] relative">
        {/* arrowhead */}
        <div
          className="absolute right-0 top-1/2 w-1.5 h-1.5 border-t border-r border-[#E7E5E4]"
          style={{ transform: 'translateY(-50%) rotate(45deg)' }}
        />
      </div>
    </div>
  );
}

function TriggerBubble() {
  return (
    <div className="w-8 h-8 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-400 shrink-0">
      <Zap className="w-4 h-4" />
    </div>
  );
}

function DoneBubble() {
  return (
    <div className="w-8 h-8 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-white shrink-0">
      <Check className="w-4 h-4" />
    </div>
  );
}

function AgentNodePill({ node }: { node: ChainNode }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-medium shrink-0',
        'uppercase tracking-wider',
        node.special
          ? 'bg-[#FFF8F5] border-[#CC5500]/30 text-[#CC5500]'
          : 'bg-stone-50 border-[#E7E5E4] text-stone-600',
      )}
      style={{ fontFamily: 'Space Grotesk, sans-serif' }}
    >
      <node.Icon
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: node.special ? '#CC5500' : undefined }}
      />
      {node.name}
    </div>
  );
}

function StatusPill({ status, errorCount }: { status: WorkflowStatus; errorCount: number | null }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        Active
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-50 text-red-700 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-stone-100 text-stone-600 border border-[#E7E5E4]">
      <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
      {errorCount ? `${errorCount} Errors` : 'Paused'}
    </span>
  );
}

// ─── Main component ────────────────────────────────────────

type FilterId = 'all' | 'active' | 'paused' | 'error';

export default function Workflows() {
  const [filter, setFilter] = useState<FilterId>('all');

  const displayed = WORKFLOWS.filter(w => {
    if (filter === 'active') return w.status === 'active';
    if (filter === 'paused') return w.status === 'paused';
    if (filter === 'error')  return w.status === 'error' || w.errorCount;
    return true;
  });

  const counts = {
    all:    WORKFLOWS.length,
    active: WORKFLOWS.filter(w => w.status === 'active').length,
    paused: WORKFLOWS.filter(w => w.status === 'paused').length,
    error:  WORKFLOWS.filter(w => w.status === 'error' || w.errorCount).length,
  };

  const FILTERS: { id: FilterId; label: string }[] = [
    { id: 'all',    label: 'All Workflows' },
    { id: 'active', label: 'Active'        },
    { id: 'paused', label: 'Paused'        },
    { id: 'error',  label: 'Errors Only'   },
  ];

  return (
    <MainLayout>
      <Header title="Workflows" subtitle="Define and control how work moves through the system." />

      <div className="min-h-screen p-8" style={{ background: '#FDFBF7' }}>

        {/* ── Page heading + filter bar ───────────────────── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h1
              className="text-3xl text-stone-900 mb-2"
              style={{ fontFamily: 'Instrument Serif, serif' }}
            >
              Workflow Definitions
            </h1>
            <p className="text-stone-500 text-sm">
              Define and control how work moves through the system.
            </p>
          </div>

          {/* Filter pill-buttons */}
          <div className="flex bg-white border border-stone-200 rounded-lg p-1 gap-1 shadow-sm shrink-0">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                  filter === f.id
                    ? 'bg-[#1C1917] text-white'
                    : 'text-stone-500 hover:bg-stone-50 hover:text-stone-900',
                )}
              >
                {f.label}
                {counts[f.id] > 0 && filter !== f.id && (
                  <span className="ml-1.5 text-[10px] opacity-60">{counts[f.id]}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Workflow list ────────────────────────────────── */}
        <div className="space-y-4 pb-12">
          {displayed.length === 0 ? (
            <div className="bg-white border border-[#E7E5E4] rounded-lg p-12 text-center text-sm text-stone-400">
              No workflows match this filter.
            </div>
          ) : (
            displayed.map(wf => (
              <WorkflowCard key={wf.id} wf={wf} />
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// ─── Workflow card ─────────────────────────────────────────

function WorkflowCard({ wf }: { wf: WorkflowDef }) {
  const isPaused = wf.status === 'paused' || !!wf.errorCount;

  return (
    <div
      className={cn(
        'bg-white border rounded-lg p-6 group transition-all duration-200',
        isPaused
          ? 'border-l-4 border-l-amber-400 border-[#E7E5E4] hover:border-amber-300'
          : 'border-[#E7E5E4] hover:border-stone-300 hover:shadow-sm',
      )}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

        {/* ── Left: name + trigger ──────────────────────── */}
        <div className="w-full lg:w-56 shrink-0">
          {/* Mobile-only status */}
          <div className="flex items-center justify-between mb-2 lg:hidden">
            <StatusPill status={wf.status} errorCount={wf.errorCount} />
          </div>

          <h3 className="text-sm font-semibold text-stone-900 mb-2 leading-snug">
            {wf.name}
          </h3>

          <div className="flex items-center gap-2 text-stone-500">
            <div className="w-6 h-6 rounded bg-stone-100 border border-stone-200 flex items-center justify-center shrink-0">
              <wf.trigger.Icon className="w-3 h-3" />
            </div>
            <span
              className="text-[11px] uppercase tracking-wider"
              style={{ fontFamily: 'Space Grotesk, sans-serif' }}
            >
              Trigger: {wf.trigger.label}
            </span>
          </div>
        </div>

        {/* ── Center: chain diagram ─────────────────────── */}
        <div className="flex-1 flex items-center overflow-x-auto py-2 min-w-0">
          <TriggerBubble />

          {wf.chain.map((node, i) => (
            <div key={i} className="flex items-center">
              <ChainConnector />
              <AgentNodePill node={node} />
            </div>
          ))}

          <ChainConnector />
          <DoneBubble />
        </div>

        {/* ── Right: status + stats ─────────────────────── */}
        <div className="w-full lg:w-48 shrink-0 flex flex-row lg:flex-col items-center lg:items-end justify-between gap-4">
          {/* Desktop-only status pill */}
          <div className="hidden lg:block">
            <StatusPill status={wf.status} errorCount={wf.errorCount} />
          </div>

          <div className="flex gap-6 lg:gap-8">
            <div className="flex flex-col items-end">
              <span
                className="text-[10px] text-stone-400 uppercase tracking-wider mb-1"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Last Run
              </span>
              <span className="text-sm font-medium text-stone-700">{wf.lastRun}</span>
            </div>
            <div className="flex flex-col items-end">
              <span
                className="text-[10px] text-stone-400 uppercase tracking-wider mb-1"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {wf.errorCount ? 'Errors' : 'Success'}
              </span>
              {wf.errorCount ? (
                <span className="text-sm font-bold text-amber-600">{wf.errorCount} Errors</span>
              ) : (
                <span className="text-sm font-medium text-emerald-600">{wf.successRate}%</span>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── Error/pause note ─────────────────────────────── */}
      {wf.errorNote && (
        <div className="mt-4 pt-4 border-t border-[#E7E5E4] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-xs text-amber-700 font-medium leading-relaxed flex-1">
            {wf.errorNote}
          </span>
          <button className="text-xs font-medium text-stone-500 hover:text-stone-900 underline decoration-stone-300 underline-offset-4 shrink-0 ml-auto">
            View Logs
          </button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, X, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspace } from '@/hooks/useWorkspace';
import { getKnightConfig } from '@/lib/knight-ticket-service';

const DISMISS_KEY = 'regent_knight_setup_dismissed';

interface CheckItem {
  id:     string;
  label:  string;
  done:   boolean;
  action: string | null;
  href:   string | null;
}

export function KnightSetupChecklist() {
  const { workspace } = useWorkspace();
  const navigate       = useNavigate();
  const [dismissed, setDismissed] = useState<boolean>(
    () => localStorage.getItem(DISMISS_KEY) === 'true'
  );
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'whatsapp',  label: 'WhatsApp connected',       done: false, action: 'Connect',     href: '/integrations/meta' },
    { id: 'configured',label: 'Agent persona configured', done: false, action: 'Configure',   href: '/knight?tab=settings' },
    { id: 'kb',        label: 'Knowledge base populated', done: false, action: 'Add entries', href: '/knight?tab=kb' },
    { id: 'ticket',    label: 'First ticket received',    done: false, action: null,           href: null },
  ]);

  useEffect(() => {
    if (!workspace?.id || dismissed) return;

    (async () => {
      const [waRes, configData, kbRes, ticketRes] = await Promise.all([
        supabase
          .from('meta_integrations')
          .select('meta_whatsapp_accounts(id)')
          .eq('workspace_id', workspace.id)
          .limit(1)
          .single(),
        getKnightConfig(workspace.id),
        (supabase as any)
          .from('knowledge_base')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id),
        supabase
          .from('tickets')
          .select('id', { count: 'exact', head: true })
          .eq('workspace_id', workspace.id),
      ]);

      const hasWhatsApp =
        !!waRes.data?.meta_whatsapp_accounts &&
        (waRes.data.meta_whatsapp_accounts as any[]).length > 0;
      const hasPersona  = !!configData?.business_description?.trim();
      const hasKb       = (kbRes.count ?? 0) > 0;
      const hasTicket   = (ticketRes.count ?? 0) > 0;

      setChecks([
        { id: 'whatsapp',   label: 'WhatsApp connected',       done: hasWhatsApp, action: 'Connect',     href: '/integrations/meta'      },
        { id: 'configured', label: 'Agent persona configured', done: hasPersona,  action: 'Configure',   href: '/knight?tab=settings'    },
        { id: 'kb',         label: 'Knowledge base populated', done: hasKb,       action: 'Add entries', href: '/knight?tab=kb'          },
        { id: 'ticket',     label: 'First ticket received',    done: hasTicket,   action: null,          href: null                      },
      ]);
    })();
  }, [workspace?.id, dismissed]);

  const done = checks.filter((c) => c.done).length;
  const allDone = done === checks.length;

  if (dismissed) return null;

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-lg p-5 mb-6 relative">
      {/* Dismiss */}
      <button
        onClick={() => {
          localStorage.setItem(DISMISS_KEY, 'true');
          setDismissed(true);
        }}
        className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 transition-colors"
        aria-label="Dismiss"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Header */}
      <div className="pr-6 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3
            className="text-base font-semibold text-stone-900"
            style={{ fontFamily: 'Instrument Serif, serif' }}
          >
            {allDone ? 'Knight is ready for your first design partner ✓' : 'Knight Setup Checklist'}
          </h3>
          <span
            className="text-[11px] text-stone-500 uppercase tracking-wider"
            style={{ fontFamily: 'Space Grotesk, sans-serif' }}
          >
            {done} of {checks.length} complete
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              allDone ? 'bg-emerald-500' : 'bg-[#CC5500]'
            )}
            style={{ width: `${(done / checks.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Checklist rows */}
      <div className="space-y-2">
        {checks.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {item.done ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="w-4 h-4 text-stone-300 shrink-0" />
              )}
              <span
                className={cn(
                  'text-sm',
                  item.done ? 'text-stone-400 line-through' : 'text-stone-700'
                )}
              >
                {item.label}
              </span>
            </div>
            {!item.done && item.href && (
              <button
                onClick={() => navigate(item.href!)}
                className="flex items-center gap-1 text-xs font-medium text-[#CC5500] hover:underline underline-offset-4 shrink-0"
              >
                {item.action}
                <ExternalLink className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

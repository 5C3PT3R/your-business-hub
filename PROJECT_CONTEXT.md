# Regent AI — Full Project Context (Handoff)

> Handoff document for switching Claude accounts. This captures the durable project
> context. Note: past Claude *conversations* cannot be exported — they are ephemeral.
> The two things that persist are (1) this doc + the memory file, and (2) the repo itself.
> Generated 2026-06-25.

---

## 1. Project Overview
- **App**: Regent AI — AI-led BPO platform (multi-tenant AI workforce for businesses)
- **Domain**: hireregent.com (Hostinger DNS) → deployed on Vercel
- **Stack**: React + Vite + TypeScript + Tailwind CSS + Supabase + shadcn/ui
- **Supabase project ref**: pesqbkgfsfkqdquhilsv
- **Repo**: https://github.com/5C3PT3R/your-business-hub
- **Contact**: hello@hireregent.com
- **ICP**: Bootstrapped SaaS — 0–10M revenue, 0–21 person companies

## 2. Design System
- **Fonts**: Instrument Serif (headings), Inter (body), Space Grotesk (labels/mono)
- **Colors**: #FDFBF7 (cream bg), #CC5500 (rust accent), #1C1917 (dark), #E7E5E4 (borders)
- **Style**: Warm cream, grain overlay, chess-themed agent names
- **Logo**: `public/regent-logo.png` (sidebar, Landing nav/footer, Onboarding, Subscribe, favicon)

## 3. The Agents (chess-themed)
| Agent  | Role |
|--------|------|
| **Knight** | Customer Support — WhatsApp / Discord / Telegram / Email inbound, RAG-powered |
| **Bishop** | SDR — web scraping + cold email outreach + automated follow-up (+ VAPI cold caller) |
| **Rook**   | Revenue Ops / CRM bridge — Salesforce / Zoho / HubSpot / Pipedrive sync + reply pipeline |
| **Pawn**   | Data gatekeeper — dedup + email verification before leads enter pipeline |
| **Queen**  | Ops oversight — A/B testing, daily Slack reports |

## 4. Multi-Tenant BPO Architecture
- Each client = one row in `clients` table with per-agent configs (Bishop/Knight/Rook), status, plan, pilot dates
- `client_id` FK (nullable) on `leads` and `tickets` — existing rows unaffected
- Router pattern in n8n: incoming webhook → lookup client config → inject into agent prompt
- Migration: `supabase/migrations/20260302_bpo_clients_schema.sql`

---

## 5. Edge Functions (current — supabase/functions/)
Knight: `knight-webhook`, `knight-discord`, `knight-telegram`, `knight-send-message`,
        `knight-analyze`, `knight-summarize`, `knight-voice-call`
Bishop: `bishop-prospect`, `bishop-enrich`, `bishop-sweep`, `bishop-send`, `sdr-agent-brain`
Pawn:   `pawn-verify`
Rook:   `rook-sync`, `rook-reply`, `crm-agent`
Gmail:  `gmail-oauth`, `gmail-send`, `gmail-sync`, `gmail-webhook`
Outlook:`outlook-oauth`, `outlook-send`, `outlook-sync`, `outlook-webhook`
Meta/Social: `meta-oauth`, `social-webhook`, `send-social-message`, `refresh-social-tokens`
Twilio/Voice: `twilio-call`, `twilio-status`, `twilio-webhook`, `transcribe-audio`, `analyze-call`
Other:  `lead-capture`, `lead-scoring`, `analyze-conversation`, `send-email`, `submit-waitlist`

**Edge function conventions (IMPORTANT):**
- All deployed with `--no-verify-jwt` (supabase.functions.invoke had JWT issues)
- All use dynamic CORS (allow both hireregent.com and www.hireregent.com)
- All frontend calls use explicit `fetch` with `apikey` header (NOT supabase.functions.invoke)

---

## 6. Agent Details & Live Status

### Knight — Support Agent (LIVE)
- Meta WhatsApp Cloud API connected (App ID: 891455416924956)
- Phone Number ID: 982115938315559 / WABA ID: 1214588500274390 / Test #: +1 555 171 1673
- Webhook: https://pesqbkgfsfkqdquhilsv.supabase.co/functions/v1/knight-webhook/whatsapp-meta
- Verify token: knight_whatsapp_verify_2024
- META_ACCESS_TOKEN in Supabase secrets (TEMP — needs permanent System User token)
- RAG pipeline live (migration `20260317_knight_rag.sql`)
- Discord + Telegram response pipelines working (latest commits)
- Inbox name resolution: contacts by workspace_id, leads by RLS; phone normalized to last 10 digits; leads overwrite contacts; settings save onBlur

### Bishop — AI SDR Pipeline (LIVE)
- Vision: Find Leads → Web Scrape/Personalize → Follow Up → Book Meeting
- `bishop-prospect`: multi-source sourcing (Apollo, Hunter, Product Hunt, HN, custom URL) → inline dedup/validate → insert
  - `force_refresh`: fetch matching emails → delete → insert fresh (leads table has NO unique constraint on email+user_id)
  - Intra-batch dedup via seenInBatch Set
- `bishop-enrich`: scrapes company website from email domain → enrichment_data + context_notes
- `bishop-sweep`: generates AI email drafts, calls bishop-enrich per lead
- `bishop-send`: sends approved drafts via Gmail, advances state machine
- State machine: INTRO_SENT → FOLLOW_UP_NEEDED → NUDGE_SENT → BREAKUP_SENT (terminal: meeting_booked_at)
- Gmail OAuth: `oauth_tokens` table, `GmailConnect` component
- UI pages: /bishop (settings), /bishop/prospect, /bishop/drafts, /bishop/leads
- VAPI cold caller separate (Assistant ID: ea28b76e-...)

### Pawn — Verify (LIVE)
- `pawn-verify`: validates emails, blocks disposables, batch dedups, inserts clean leads; logs to `pawn_jobs`
- Lead format guard rejects non-objects before email check

### Rook — CRM Sync + Reply (LIVE)
- `rook-sync`: syncs leads/tickets to CRMs. HubSpot fully implemented (upsert contacts + tickets). Salesforce/Zoho stubbed.
  - Idempotent via `rook_crm_syncs` unique constraint
  - fetchWithTimeout(15s) all CRM calls; soqlEscapeEmail() for SOQL; Zoho/Pipedrive errors throw
- `rook-reply`: 10k char body limit; SHA-256 idempotency key; Claude timeout 30s; email_body truncated in DB

---

## 7. Frontend Pages (src/pages/)
Landing, Auth, Waitlist, Privacy, Terms, Onboarding, Subscribe, Demo, NotFound
Dashboard, CommandCenter, Analytics, Forecast, Reports, Insights, Activity, NextActions
CRM: Leads, LeadProfile, Contacts, ContactDetail, Companies, CompanyDetail, Deals, DealDetail, Tasks, Import
Agents: Agents, AgentDetail, Knight, KnightDashboard, BishopSettings, BishopProspect, BishopDrafts, BishopLeads, Pawn, Rook, Clients
Workflows: Workflows, WorkflowEditor
Integrations: Inbox, MetaIntegration, MetaCallback, SelectCRM, Settings

## 8. Security (completed)
- META_APP_SECRET (renamed from VITE_ prefix — not exposed to frontend)
- Waitlist via Edge Function + Cloudflare Turnstile (site key: 0x4AAAAAAACf9A6xyowdUlCWG)
- All CRM tables RLS: auth.uid() = user_id (note: workspaces uses owner_id not user_id)
- Security headers + CSP + X-XSS-Protection + immutable asset cache in vercel.json
- DOMPurify in src/pages/Inbox.tsx
- CORS locked across all edge functions
- .env + docs/bishop/ scrubbed from git; all exposed keys rotated

## 9. Database
- 65+ migrations in supabase/migrations/ (Dec 2025 → Mar 2026)
- Core tables: clients, leads, tickets, contacts, companies, deals, tasks, ai_drafts, oauth_tokens,
  oauth_states, pawn_jobs, rook_crm_syncs, rook_reply_logs, waitlist, workspaces, agents, workflows,
  notifications, approvals, wallets, ai_insights, next_actions, conversations
- Key recent: 20260317_knight_rag.sql, 20260311_rook_reply_logs.sql, 20260302_bpo_clients_schema.sql

## 10. n8n Setup
- ngrok at: C:\Users\Eashan Singh\Downloads\ngrok-v3-stable-windows-amd64\
- start-bishop.bat in project root (starts ngrok + n8n)
- Workflows: Bishop — VAPI Tools Handler, Bishop — Campaign Launcher; new: docs/n8n-workflows/bishop-pipeline.json
- Google Calendar OAuth2 connected (regent.ctodev@gmail.com)

## 11. Testing
- Vitest: `npm test` / `npm run test:watch` / `npm run test:coverage`
- tests/: pawn-verify.test.ts, rook-reply.test.ts, rook-sync.test.ts (60 tests / 3 suites, green as of 2026-03-11)

## 12. Tech Stack (full)
React 18 · Vite · TypeScript · Tailwind · shadcn/ui (Radix) · @tanstack/react-query · react-router-dom
· react-hook-form · framer-motion · gsap · ogl · recharts · @xyflow/react (workflow editor) · dnd-kit
· papaparse · dompurify · @marsidev/react-turnstile · openai SDK · @supabase/supabase-js
Backend: Supabase (Postgres, Auth, RLS, Edge Functions/Deno) · n8n · Claude API · VAPI · Twilio

## 13. Pending TODO
- [ ] Submit sitemap (Search Console → https://www.hireregent.com/sitemap.xml)
- [ ] Run waitlist RLS cleanup SQL in Supabase Dashboard (drop old read/insert policies)
- [ ] META_ACCESS_TOKEN → permanent System User token
- [ ] Add APOLLO_API_KEY + HUNTER_API_KEY to Supabase secrets (activate paid prospecting)
- [ ] Add PRODUCT_HUNT_TOKEN to Supabase secrets
- [ ] Add HubSpot access token for first real client
- [ ] Social links (Twitter/LinkedIn) in Landing.tsx footer
- [ ] Real 1200×630 og:image
- [ ] Upgrade Twilio (~$20) for Bishop VAPI to call any number

## 14. Key Conventions Cheat-Sheet (for the next Claude)
- Platform: Windows 11, PowerShell primary (Bash tool also available). Repo at e:\your-business-hub
- Edge functions: deploy with `--no-verify-jwt`, dynamic CORS, frontend calls use explicit fetch + apikey
- leads table has NO unique constraint on email+user_id (force_refresh = delete+insert)
- workspaces RLS uses owner_id (not user_id); CRM tables use user_id
- Memory lives at: C:\Users\Eashan Singh\.claude\projects\e--your-business-hub\memory\

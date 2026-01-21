# Scout (AI SDR Agent) - Gap Analysis

## Executive Summary
Based on the PRD requirements and current codebase audit, here's the status of each feature for the "Scout" AI SDR Agent implementation.

## Gap Analysis Table

| Feature | Status | Next Step | Notes |
|---------|--------|-----------|-------|
| **Wallet System** | **Missing** | Create `Wallet` table with `dataCredits` and `aiUsage` columns | No wallet table exists in migrations. Need to create table and implement `src/lib/wallet-service.ts` |
| **SDR Brain Edge Function** | **Missing** | Create `supabase/functions/sdr-agent-brain` | Current `crm-agent` function exists but is for general CRM ops, not SDR-specific email drafting |
| **Agent Launcher UI Modal** | **Partial** | Create `RunScoutModal.tsx` or enhance existing `AgentPopup` | `AgentPopup.tsx` exists but is for general CRM agent, not SDR-specific with persona selection |
| **Approval Queue UI** | **Done** | ✅ Already implemented | `Approvals.tsx` page and `email_approvals` table are fully functional |
| **Rebranding (Contacts→Targets)** | **Missing** | Update all UI references from "Contacts" to "Targets" | Routes, pages, components still use "Contacts" terminology |
| **Rebranding (Deals→Trophy Room)** | **Missing** | Update all UI references from "Deals" to "Trophy Room" | Routes, pages, components still use "Deals" terminology |
| **Agent Personas Library** | **Missing** | Create `src/lib/agent-personas.ts` | No persona definitions for Friendly/Direct SDR styles |

## Detailed Findings

### ✅ **Approval Queue - COMPLETE**
- **Database**: `email_approvals` table exists (created in migration `20260117_create_approvals_table.sql`)
- **UI**: `src/pages/Approvals.tsx` is fully implemented with:
  - Pending email review queue
  - Approve/Reject/Edit functionality
  - Real-time updates
  - Feedback collection for AI training
- **Backend**: `src/hooks/useApprovals.tsx` hook provides complete API integration

### ⚠️ **Agent Launcher - PARTIAL**
- **Existing**: `AgentPopup.tsx` component provides general AI agent interface
- **Missing**: SDR-specific features:
  - Persona selection (Friendly/Direct)
  - Contact/Target selection for email drafting
  - Integration with SDR Brain edge function
- **Next Step**: Create `RunScoutModal.tsx` or extend `AgentPopup` with SDR capabilities

### ❌ **Wallet System - MISSING**
- **Database**: No `wallet` table in migrations
- **Service**: No `src/lib/wallet-service.ts` file
- **Concept**: Need to track `dataCredits` (for data usage) vs `aiUsage` (for AI calls)
- **Implementation**: Requires:
  1. Migration for `wallets` table
  2. Service layer for credit management
  3. Integration with edge functions for usage tracking

### ❌ **SDR Brain Edge Function - MISSING**
- **Current**: `crm-agent` function exists but is for general CRM operations
- **Missing**: `sdr-agent-brain` function specifically for:
  - Taking a Persona (Friendly/Direct)
  - Generating email drafts for selected contacts/targets
  - Using context from CRM data
- **Implementation**: Need to create new edge function with persona-based prompt engineering

### ❌ **Rebranding - MISSING**
- **Current**: All routes and UI use "Contacts" and "Deals"
- **Required**: Change to "Targets" and "Trophy Room" per PRD
- **Scope**: Affects:
  - Route paths (`/contacts` → `/targets`, `/deals` → `/trophy-room`)
  - Page titles and headers
  - Navigation menus
  - Component names
  - Database table references (if changing)

### ❌ **Agent Personas - MISSING**
- **Missing**: `src/lib/agent-personas.ts` file
- **Required**: Define persona configurations for:
  - **Friendly Persona**: Warm, conversational, relationship-focused tone
  - **Direct Persona**: Concise, value-focused, action-oriented tone
- **Implementation**: JSON structure with tone, style, and prompt templates

## Technical Dependencies

1. **Database Schema Updates**:
   - `wallets` table
   - Possible `personas` table or configuration

2. **Edge Functions**:
   - `sdr-agent-brain` for email drafting
   - Integration with OpenAI/GPT models

3. **Frontend Components**:
   - `RunScoutModal.tsx` for SDR agent launcher
   - Wallet credit display component
   - Persona selector UI

4. **Service Layers**:
   - `wallet-service.ts` for credit management
   - `agent-personas.ts` for persona definitions
   - Enhanced approval service for SDR drafts

## Recommended Implementation Order

1. **Wallet System** (Foundation for usage tracking)
2. **SDR Brain Edge Function** (Core AI capability)
3. **Agent Personas Library** (Configuration)
4. **RunScoutModal Component** (UI)
5. **Rebranding** (Cosmetic changes)

## Questions for Product Clarification

1. Should the Wallet system track credits per user or per workspace?
2. What are the specific differences between Friendly vs Direct personas?
3. Should "Trophy Room" be a complete replacement for "Deals" or an additional view?
4. Are there any existing email templates or examples for the SDR to follow?
5. What triggers should launch the SDR agent? (Manual button, automated triggers, etc.)

## Estimated Complexity

| Component | Complexity | Dependencies |
|-----------|------------|--------------|
| Wallet System | Medium | Database migration, service layer |
| SDR Brain | High | OpenAI integration, prompt engineering |
| Agent Launcher | Low-Medium | UI component, persona integration |
| Rebranding | Low | Find/replace across codebase |
| Personas Library | Low | Configuration file |

---
*Last Updated: 2026-01-17*
*Audit conducted by: Senior Technical Project Manager*
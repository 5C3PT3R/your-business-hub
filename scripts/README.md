# REGENT AI Scripts

## Bishop Agent - Outbound Sales Intelligence Unit

The Bishop Agent is an autonomous AI agent that generates personalized cold emails using LLMs and inserts them into the database for human approval in the Command Center.

### Setup

1. **Install dependencies:**
   ```bash
   npm install dotenv @supabase/supabase-js openai tsx
   ```

2. **Configure environment variables:**
   Copy `.env.example` to `.env` and set:

   ```bash
   # Supabase (required)
   SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...YOUR_SERVICE_ROLE_KEY

   # LLM Provider (choose one)
   LLM_PROVIDER=openai  # or 'deepseek' or 'openrouter'

   # OpenAI (if using OpenAI)
   OPENAI_API_KEY=sk-...

   # DeepSeek (if using DeepSeek - recommended for cost)
   DEEPSEEK_API_KEY=sk-...

   # OpenRouter (if using OpenRouter)
   OPENROUTER_API_KEY=sk-or-v1-...
   ```

3. **Get your API keys:**
   - **OpenAI**: https://platform.openai.com/api-keys
   - **DeepSeek**: https://platform.deepseek.com/api_keys (Recommended - much cheaper)
   - **OpenRouter**: https://openrouter.ai/keys (Access to multiple models)

### Usage

Run the Bishop Agent:

```bash
npx tsx scripts/bishop-agent.ts
```

The agent will:
1. Take the hardcoded target lead (Jensen Huang at NVIDIA)
2. Generate a personalized cold email using the configured LLM
3. Insert the draft into the `ai_drafts` table with `PENDING_APPROVAL` status
4. Display the draft ID and email content

### View Results

1. Navigate to the Command Center in your app: `/command-center`
2. You'll see the newly generated draft in the queue
3. Review, edit if needed, and approve to send the email

### Customization

Edit the `TARGET_LEAD` object in [bishop-agent.ts](./bishop-agent.ts) to generate emails for different targets:

```typescript
const TARGET_LEAD: TargetLead = {
  name: 'Your Target Name',
  email: 'target@company.com',
  company: 'Company Name',
  role: 'CEO',
  recent_news: 'Recent news or context about the target...',
};
```

### Next Steps

**Day 5+**: Scale the agent to:
- Process multiple leads from a CSV/database
- Run on a schedule (cron job)
- Connect to real lead sources (LinkedIn, news APIs, etc.)
- Add more sophisticated email templates
- Implement A/B testing for subject lines

### Architecture

```
┌─────────────────┐
│  Bishop Agent   │  (Node.js Script)
│  scripts/       │
└────────┬────────┘
         │
         │ 1. Generate email via LLM
         │ 2. Insert into ai_drafts
         │
         ▼
┌─────────────────┐
│  Supabase DB    │
│  ai_drafts      │
└────────┬────────┘
         │
         │ 3. Fetch pending drafts
         │
         ▼
┌─────────────────┐
│ Command Center  │  (React App)
│ /command-center │
└────────┬────────┘
         │
         │ 4. Human approval
         │ 5. Send email
         │
         ▼
┌─────────────────┐
│  Edge Function  │
│  send-email     │
└─────────────────┘
```

### Cost Comparison

**DeepSeek** (Recommended):
- $0.14 per 1M input tokens
- $0.28 per 1M output tokens
- ~$0.0001 per email (250 tokens)

**OpenAI GPT-4o-mini**:
- $0.15 per 1M input tokens
- $0.60 per 1M output tokens
- ~$0.0002 per email (250 tokens)

**OpenAI GPT-4o**:
- $2.50 per 1M input tokens
- $10.00 per 1M output tokens
- ~$0.003 per email (250 tokens)

For 1,000 emails/day, DeepSeek costs ~$0.10/day vs GPT-4o at ~$3/day.

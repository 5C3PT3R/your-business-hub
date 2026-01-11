# Generate Next Actions from Your Existing CRM Data

Instead of using sample data, this will create actions from your **real deals, contacts, and leads**.

## 📋 What Gets Generated

The function analyzes your existing CRM data and creates actions for:

1. **Deals with no recent activity** (Follow-ups)
   - Critical if inactive > 7 days
   - High if inactive > 3 days
   - Higher priority for deals > $50K

2. **Deals in demo stage** (Send Proposals)
   - Ready for next step
   - Priority based on deal value

3. **New/Hot Leads** (Qualification Calls)
   - Hot leads → Critical
   - Warm leads → High
   - New leads → Medium

4. **Contacts needing touchpoint** (Calls)
   - No contact in 14+ days
   - Has phone number
   - Maintains relationship

## 🚀 How to Use

### Step 1: Run the Function Creator

1. Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new)

2. Copy and paste the content from:
   ```
   supabase/migrations/20260111_create_action_generator_function.sql
   ```

3. Click "Run" - This creates the function (one-time setup)

### Step 2: Generate Actions

In the same SQL Editor, run this simple command:

```sql
SELECT * FROM generate_next_actions_from_crm_data();
```

**That's it!** This will:
- Analyze your deals, leads, and contacts
- Create prioritized actions
- Return how many actions were created

Example output:
```
actions_created | message
----------------|----------------------------------------
42              | Generated 42 next actions from existing CRM data.
```

### Step 3: View Your Actions

Refresh the Next Actions page: http://localhost:8080/next-actions

You'll see actions generated from your real data!

## 🔄 Running It Again

You can run the generator anytime:

```sql
SELECT * FROM generate_next_actions_from_crm_data();
```

**Don't worry about duplicates** - The function checks for existing pending actions and won't create duplicates.

## 🎯 Smart Logic

The function uses intelligent rules:

### Priority Scoring
```
Deal > $50K + Inactive 7+ days = Priority 95
Deal > $50K = Priority 85
Deal > $25K = Priority 75
Regular Deal = Priority 60
```

### Urgency Levels
```
Inactive 7+ days = Critical 🔴
Inactive 3+ days = High 🟠
Recent activity = Medium 🟡
```

### Won't Create Actions For
- ✅ Closed-won deals
- ✅ Closed-lost deals
- ✅ Deals that already have pending actions
- ✅ Very recent activity (< 2 days)

## 📊 What You'll Get

After running the generator, you'll have actions like:

1. **"Follow up on Acme Corp deal"**
   - Deal: $50K
   - Urgency: Critical (inactive 8 days)
   - Priority Score: 95

2. **"Send proposal to TechStartup"**
   - Deal: $75K
   - Stage: Demo Done
   - Priority Score: 90

3. **"Qualify lead - BigCo"**
   - Lead: Hot
   - Created: 2 days ago
   - Priority Score: 85

4. **"Call Sarah Chen"**
   - Contact at TechCorp
   - Last contact: 15 days ago
   - Priority Score: 60

## 🔧 Customizing the Generator

Want different rules? Edit the function:

```sql
-- Change the inactive threshold
WHERE d.updated_at < NOW() - INTERVAL '7 days'  -- Change to '5 days', '10 days', etc.

-- Change the value threshold
WHEN d.value > 50000 THEN 95  -- Adjust the $50K threshold

-- Change how many actions to create
LIMIT 20;  -- Increase or decrease
```

## 🆘 Troubleshooting

### "Function already exists"
- The function is already created
- Just run: `SELECT * FROM generate_next_actions_from_crm_data();`

### "0 actions created"
Possible reasons:
- All your deals already have pending actions
- All deals are closed
- All deals have recent activity
- Check your data: `SELECT COUNT(*) FROM deals WHERE stage NOT IN ('closed_won', 'closed_lost');`

### Want to reset and regenerate?
```sql
-- Delete all AI-generated actions
DELETE FROM next_actions WHERE source = 'ai';

-- Then regenerate
SELECT * FROM generate_next_actions_from_crm_data();
```

## ⚡ Quick Start Commands

```sql
-- 1. Create the function (one-time)
-- Copy from: 20260111_create_action_generator_function.sql

-- 2. Generate actions
SELECT * FROM generate_next_actions_from_crm_data();

-- 3. View what was created
SELECT
  title,
  urgency,
  ai_priority_score,
  revenue_impact,
  created_at
FROM next_actions
WHERE source = 'ai'
ORDER BY ai_priority_score DESC;
```

## 🎉 Success!

If you see actions in the Next Actions page that match your real deals/leads, **you're all set!**

The actions are:
- ✅ Based on your actual CRM data
- ✅ Prioritized by AI logic
- ✅ Actionable (complete/skip buttons work)
- ✅ Connected to real deals and contacts

**Run the generator daily/weekly** to keep actions fresh based on new activity!

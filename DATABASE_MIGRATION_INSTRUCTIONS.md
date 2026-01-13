# Database Migration Instructions - Contacts Table

## Status: Ready to Apply

The contacts table migration is ready but needs manual application due to Supabase CLI conflicts with existing database state.

---

## Option 1: Apply via Supabase Dashboard (RECOMMENDED)

### Steps:

1. **Go to Supabase SQL Editor:**
   - Navigate to: https://supabase.com/dashboard/project/pesqbkgfsfkqdquhilsv/sql/new

2. **Copy the Migration SQL:**
   - File: `e:\your-business-hub\safe_contacts_migration.sql`
   - Or from: https://github.com/5C3PT3R/your-business-hub/blob/main/safe_contacts_migration.sql

3. **Paste and Execute:**
   - Paste the entire SQL into the SQL Editor
   - Click "Run" or press `Ctrl+Enter`
   - Wait for completion (should take 5-10 seconds)

4. **Verify Success:**
   - Check for "Success" message
   - No errors should appear
   - The migration is idempotent (safe to run multiple times)

---

## Option 2: Apply via Supabase CLI (if Docker is running)

```bash
# Start Docker Desktop first
# Then run:
npx supabase db push
```

**Note:** This will fail if Docker is not running or if there are type conflicts.

---

## What This Migration Does

### New Database Fields Added to `contacts` Table:

1. **first_name** (TEXT) - Split from existing `name` field
2. **last_name** (TEXT) - Split from existing `name` field
3. **linkedin_url** (TEXT) - LinkedIn profile URL
4. **lifecycle_stage** (ENUM) - lead | mql | sql | opportunity | customer | churned
5. **lead_score** (INTEGER 0-100) - AI-calculated engagement score
6. **email_verified** (BOOLEAN) - Email validation status (NeverBounce)
7. **phone_valid** (BOOLEAN) - Phone validation status (Twilio)
8. **data_completeness** (INTEGER 0-100) - Auto-calculated profile completeness
9. **custom_fields** (JSONB) - Flexible user-defined fields
10. **tags** (TEXT[]) - Array of categorization tags
11. **notes** (TEXT) - Internal notes about contact
12. **last_activity_at** (TIMESTAMPTZ) - Timestamp of last interaction

### Database Functions Created:

1. **calculate_contact_completeness(contact_row)**
   - Calculates profile completeness score (0-100%)
   - Scoring breakdown:
     - Required fields (first_name, last_name, email): 10 pts each
     - Important fields (phone, company, position): 8 pts each
     - Additional fields (linkedin_url, avatar_url): 6 pts each
     - Verification (email_verified, phone_valid): 10 pts each
     - Tags and notes: 4 pts each

2. **update_contact_completeness() TRIGGER**
   - Automatically runs on INSERT/UPDATE
   - Updates `data_completeness` field with calculated score

### Database Indexes Created:

1. **idx_contacts_search** - Full-text search (GIN index) on name, email, company
2. **idx_contacts_lifecycle_stage** - Fast filtering by lifecycle stage
3. **idx_contacts_lead_score** - Ordered by lead score (DESC)
4. **idx_contacts_email_verified** - Partial index for unverified emails
5. **idx_contacts_phone_valid** - Partial index for unvalidated phones
6. **idx_contacts_last_activity** - Ordered by last activity (DESC NULLS LAST)

### Database View Created:

**contacts_with_stats** - Aggregates related data:
- `deal_count` - Number of associated deals
- `activity_count` - Number of logged activities
- `task_count` - Number of related tasks
- `latest_activity_at` - Most recent activity timestamp

### Data Migration:

- Existing `name` field is split into `first_name` and `last_name`
- All existing contacts will have their completeness scores calculated
- All changes are backward compatible (no data loss)

---

## Why Manual Application is Needed

The Supabase CLI `db push` command is failing because:

1. **Type Conflicts**: Some enum types (like `task_priority`) already exist in the remote database
2. **Docker Dependency**: Local shadow database requires Docker Desktop to be running
3. **Migration History Mismatch**: Remote database was partially created manually, causing state conflicts

The `safe_contacts_migration.sql` file solves this by:
- Using `DO $$ ... EXCEPTION WHEN duplicate_object` for enum creation
- Using `IF NOT EXISTS` checks for all column additions
- Using `CREATE OR REPLACE` for functions and views
- Being fully idempotent (safe to run multiple times)

---

## After Applying the Migration

### Frontend Features That Will Work:

1. **Contact Detail Page** ([src/pages/ContactDetail.tsx](src/pages/ContactDetail.tsx))
   - Lifecycle stage badges (color-coded)
   - Lead score progress bar (0-100)
   - Data completeness indicator (auto-calculated)
   - Email verification badge (✓ Verified / ✗ Not Verified)
   - Phone validation badge (✓ Valid / ⚠ Unvalidated)
   - LinkedIn profile link
   - Tags display
   - Notes section

2. **Contact List Enhancements**
   - Advanced filtering by lifecycle stage
   - Lead score sorting
   - Data quality filters (verified emails, valid phones)
   - Full-text search (name, email, company)

3. **Data Quality Dashboard**
   - Profile completeness scores for all contacts
   - Verification status tracking
   - Missing data identification

### Verification Steps:

1. **Check New Fields:**
   ```sql
   SELECT first_name, last_name, lifecycle_stage, lead_score, data_completeness
   FROM contacts
   LIMIT 5;
   ```

2. **Test Completeness Calculation:**
   ```sql
   -- Update a contact to trigger the completeness calculation
   UPDATE contacts
   SET email_verified = true
   WHERE id = 'some-contact-id';

   -- Check the updated completeness score
   SELECT name, data_completeness FROM contacts WHERE id = 'some-contact-id';
   ```

3. **Test View:**
   ```sql
   SELECT * FROM contacts_with_stats LIMIT 5;
   ```

4. **Test Full-Text Search:**
   ```sql
   SELECT name, email, company
   FROM contacts
   WHERE to_tsvector('english',
       COALESCE(first_name, '') || ' ' ||
       COALESCE(last_name, '') || ' ' ||
       COALESCE(email, '') || ' ' ||
       COALESCE(company, '')
   ) @@ to_tsquery('english', 'John');
   ```

---

## Rollback Instructions (if needed)

If you need to undo this migration:

```sql
-- Drop trigger
DROP TRIGGER IF EXISTS trigger_update_contact_completeness ON contacts;

-- Drop functions
DROP FUNCTION IF EXISTS update_contact_completeness();
DROP FUNCTION IF EXISTS calculate_contact_completeness(contacts);

-- Drop view
DROP VIEW IF EXISTS contacts_with_stats;

-- Drop indexes
DROP INDEX IF EXISTS idx_contacts_search;
DROP INDEX IF EXISTS idx_contacts_lifecycle_stage;
DROP INDEX IF EXISTS idx_contacts_lead_score;
DROP INDEX IF EXISTS idx_contacts_email_verified;
DROP INDEX IF EXISTS idx_contacts_phone_valid;
DROP INDEX IF EXISTS idx_contacts_last_activity;

-- Remove columns (CAUTION: This will delete data!)
ALTER TABLE contacts DROP COLUMN IF EXISTS first_name;
ALTER TABLE contacts DROP COLUMN IF EXISTS last_name;
ALTER TABLE contacts DROP COLUMN IF EXISTS linkedin_url;
ALTER TABLE contacts DROP COLUMN IF EXISTS lifecycle_stage;
ALTER TABLE contacts DROP COLUMN IF EXISTS lead_score;
ALTER TABLE contacts DROP COLUMN IF EXISTS email_verified;
ALTER TABLE contacts DROP COLUMN IF EXISTS phone_valid;
ALTER TABLE contacts DROP COLUMN IF EXISTS data_completeness;
ALTER TABLE contacts DROP COLUMN IF EXISTS custom_fields;
ALTER TABLE contacts DROP COLUMN IF EXISTS tags;
ALTER TABLE contacts DROP COLUMN IF EXISTS notes;
ALTER TABLE contacts DROP COLUMN IF EXISTS last_activity_at;

-- Drop enum type
DROP TYPE IF EXISTS lifecycle_stage;
```

---

## Next Steps After Migration

1. **Apply the migration** using Option 1 (Supabase Dashboard)
2. **Test the Contact Detail page** at http://localhost:8080/contacts/:id
3. **Verify all features work** (tabs, editing, badges, progress bars)
4. **Move on to Phase 3** - Add Pagination UI to Contacts List page

---

## Support

If you encounter any issues:

1. Check Supabase Dashboard logs
2. Verify all steps were followed correctly
3. Try running the migration again (it's idempotent)
4. Check for any foreign key or constraint violations in existing data

**Migration File Location:**
- Local: `e:\your-business-hub\safe_contacts_migration.sql`
- GitHub: https://github.com/5C3PT3R/your-business-hub/blob/main/safe_contacts_migration.sql

---

**Status:** ⏳ Ready to Apply
**Estimated Time:** 5-10 seconds
**Risk Level:** Low (idempotent, no data loss)
**Reversible:** Yes (see rollback instructions)

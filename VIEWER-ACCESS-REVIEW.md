# Invited read-only viewers and public research summaries

This PR is a **staged frontend plus database migration**. Nothing is merged or deployed, and no existing Supabase rows, Storage objects, account passwords or roles are changed by creating this PR.

## Intended roles
- Owner: retain all existing access, publish intentional public summaries, add/remove viewer memberships.
- Editor: existing record and file write access, cannot publish or manage viewers.
- Viewer: invited Supabase Auth user with a membership row role `viewer`. Can read detailed private inputs, methodologies, papers, files and version history; can preview/download but cannot change records, upload, trash, publish or restore backups.
- Anonymous/public: only `published_entries` summaries. Nothing in `inputs`, `files`, `file_versions`, or the `research-files` Storage bucket becomes public.

## Deployment sequence
1. Review pull request and checks; ensure `npm ci`, `npm test`, `npm run build` and browser tests pass.
2. After explicit owner approval, apply **only** `supabase/migrations/20261111143000_invited_readonly_viewers.sql` to the existing project using your controlled Supabase migration process. Do **not** rerun old migrations. Confirm the owner role, existing documents, and bucket privacy remain intact.
3. Merge the PR after approving the changes. The main-only GitHub Pages workflow then deploys the frontend.
4. Owner invites or creates a user under [Supabase Authentication → Users](https://supabase.com/dashboard/project/ttooxyezrvbyscexjxno/auth/users). Copy that account's UID; sign into the website as Owner → **Viewer access** → paste UID → Grant.
5. Verify private research browsing as Viewer; upload/delete/edit/backup restore must be unavailable in UI **and rejected by RLS/storage API** with the viewer's JWT. Sign out and confirm only published entries are visible. Test removal of viewer membership and repeat access checks.
6. Publish a harmless sample summary to verify anonymous visibility, then remove it.

## Limitations and safeguards
- The app does not contain or request a Supabase service-role credential. It cannot send a Supabase Auth admin invitation directly. Creating an Auth account is a separate trusted action in the Supabase dashboard.
- The owner controls viewer memberships by Auth UID, not email. A revoked user retains their Auth account but loses member-based data and Storage access.
- Viewer downloads are allowed. A viewer may retain copies of private research after permission revocation; invite trusted readers only.
- `app_private` is a non-exposed schema containing one narrowly scoped owner-check SECURITY DEFINER function. It cannot be called by anonymous clients; inspect RLS and function grants during review. Never add `app_private` to exposed Data API schemas.
- Existing `can_edit()`, owner-only publishing policies, model-run immutability triggers and private Storage writes remain unchanged.
- Public summaries are entered deliberately into `published_entries`; do not include private URLs or sensitive raw data.
- The Brave PDF.js `toHex` compatibility issue is a **separate bug**, not fixed by this access-control PR.
- The existing backup/restore is non-atomic; independent backups are still necessary.

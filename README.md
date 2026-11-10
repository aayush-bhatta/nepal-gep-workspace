# Nepal GEP — Research Workspace

A React + TypeScript research-management frontend for Nepal's 2030, 2040 and 2050 generation-expansion planning. It is not a solver and does **not** contain validated Nepal energy statistics or completed optimization results.

## Current implementation

- Private password login using Supabase Auth; no public sign-up/editing route.
- Member-only versioned input register, immutable model-run register, sensitivities, task register, and file registry.
- Database checks enforce input `Verified` source/date/evidence, run verification evidence, and task completion evidence.
- Dashboard presents counts from recorded rows, not fabricated numbers.
- Three-horizon comparison of recorded outputs. Energy accounting basis is preserved.
- Private multiple-file uploads (20 MB/file), authenticated download, display rename, folder move, recoverable metadata trash, and linking to research records by UUID.
- New folder records, cross-folder filename search and folder navigation, JSON/CSV export, DOCX generation, browser print-to-PDF, and selective JSON import preview.
- Public read-only `published_entries` with copy-only content; private table columns and Storage objects stay restricted.

## Setup (beginner friendly)

1. Create a GitHub repository called `nepal-gep-workspace` on [GitHub’s new-repository page](https://github.com/new) and choose **Public** for free GitHub Pages unless you have a plan supporting private-repo Pages. Public source code is fine here because it must contain no private data or secrets. **Never commit private research files or credentials.**
2. **Already completed:** Supabase project `Nepal GEP Research Workspace` exists in your free organization (`ttooxyezrvbyscexjxno`). Do not create another project.
3. **Already completed:** the live project contains migrations `initial_workspace`, `track_input_versions` and `revoke_anonymous_private_grants`, private tables, storage policies, and initial research workstreams. **Do not re-run the initial migration** in the existing live project.
4. In Supabase Authentication → Providers, enable Email and **disable public signups**. In Authentication → Users, create/invite your owner user. Obtain the owner's UUID on the Users screen. As of 10 November 2026 the project has 0 Auth users, so this step is required. Do not put your login password in ChatGPT.
5. In SQL Editor (administrator only), **replace YOUR_USER_UUID** and run:

   ```sql
   insert into public.workspace_members(user_id,role)
   values ('YOUR_USER_UUID','owner')
   on conflict (user_id) do update set role='owner';
   ```

   Nobody automatically becomes owner; editor invitations also require an administrator SQL statement with role `editor`.
6. In Supabase project settings copy **Project URL** and **publishable client key** (safe public client configuration). Never use secret/service-role keys in this application.
7. In GitHub repo → Settings → Secrets and variables → Actions → **Variables** create:
   - `VITE_SUPABASE_URL` = your HTTPS Supabase URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = public publishable client key
   - `VITE_BASE_PATH` = `/nepal-gep-workspace/` (replace with actual repo name), or `/` for custom domain
8. Configure Supabase Auth → URL Configuration: site URL `https://YOUR-USERNAME.github.io/YOUR-REPO/` and any required redirect URL.
9. Upload/commit these project files to your GitHub repo. Choose Settings → Pages → **GitHub Actions**. Every push to `main` invokes the deploy workflow; open the Actions tab to see actual results.
10. Visit `https://YOUR-USERNAME.github.io/YOUR-REPO/#/` and sign in with the owner account. For local development, install Node 22, copy `.env.example` to `.env.local`, insert publishable settings, and run `npm install` then `npm run dev`.

**Important:** `package-lock.json` was not generated in the initial provided archive because npm registry access was unavailable in the preparation environment. The workflow can initially run `npm install` when no lockfile is present, but you should run `npm install` once on a network-connected computer and commit the generated `package-lock.json` for reproducibility. The full build remains unverified until it runs.

## Hosting, billing and backups

GitHub Pages hosts only the compiled frontend. Supabase independently holds Auth, SQL records, and private file bytes. Both remain in your accounts and are independent of your ChatGPT subscription, subject to provider quotas, billing, inactivity and account status. See official [GitHub Pages documentation](https://docs.github.com/en/pages) and [Supabase pricing](https://supabase.com/pricing) for live limits; do not assume unlimited free service.

To back up, export database records as JSON **and** separately download actual files from the private bucket. The in-app JSON export includes file metadata and paths, **not the file bytes**; it is not a complete disaster-recovery backup. For database-grade backup/restore, use Supabase's official database backup / dump options appropriate for your plan. Restore SQL rows and file objects together, preserving storage paths and links.

## Results import schema (record one run)

Open Scenario comparison → Record model run. Numeric fields must be sourced from documented outputs and `capacity_mix`, `energy_mix`, `input_versions` must be valid JSON objects. Example shape (illustration only; **not** actual results):

```json
{
  "horizon": 2030,
  "scenario_name": "My documented solver run",
  "model_version": "version from Git",
  "input_versions": {"hourly_demand": "version-id"},
  "solver": "PuLP / CBC",
  "termination_status": "set from solver logs",
  "status": "Completed, unverified",
  "capacity_mix": {},
  "energy_mix": {},
  "energy_accounting_basis": "describe generation denominator; battery output is not primary generation"
}
```

Use **Not run**, **Completed, unverified**, or the correct actual status. Only claim verified when evidence exists. A model run cannot be edited after insertion; record corrected runs as new rows.

## Storage mapping

The SQL `folders.path` and `files.folder_path` provide virtual folders (e.g., `Results/2030`). Actual files are stored at stable keys `objects/<UUID>` in the private `research-files` bucket. Renaming or moving files updates metadata, not bytes or physical object paths. Trashing marks `files.trashed_at`, allowing restore; it does not delete storage objects. Uploading is never evidence of verification. For actual deletion, use an administrator-reviewed purge routine so SQL and Storage are cleaned consistently.

## Domain configuration

For `www.example.com`, follow GitHub Pages custom-domain instructions, configure the corresponding DNS records and Pages custom domain, set `VITE_BASE_PATH=/`, rebuild, and update Supabase Auth allowed URLs. Use HTTPS.

## Security

- Supabase RLS (not UI hiding) restricts private tables and storage to members.
- Memberships can only be assigned by an administrator in Supabase SQL Editor.
- Publication is opt-in and uses separately copied, deliberately public values; **do not copy private notes into `public_payload`**.
- No service-role keys, database passwords, or GitHub access tokens belong in Vite variables.
- Supabase's publishable key is visible to users, which is expected and safe only with appropriate RLS.
- Scripts/files uploaded here are never executed.
- Anonymous viewers can only read intentionally published entries.

## Known limitations / not yet complete

This is an initial deployable implementation, **not a fully verified production system**. Not yet implemented: atomic rollback for multi-row JSON imports, comprehensive conflict mapping of existing dashboard exports, proper chart PNG/SVG export, bulk file ZIP backups, visual progress bars, automated RLS/security integration tests, owner-only publication selector from underlying records, and full technical parameter-specific forms (the `inputs.details` JSON field can hold extra data). Some file operations are metadata-only. The import UI supports only inputs, tasks and sensitivities, deliberately excluding immutable runs and file objects. JSON import failures may leave already imported rows inserted. The frontend has not been built/tested against an initialized project yet.

## Acceptance checklist (run after setup)

- [ ] `npm install` creates lockfile; `npm run build` succeeds locally.
- [ ] GitHub Actions deployment succeeds and browser refresh works at `/#/`.
- [ ] Owner sign-in works; data remains after refresh and another session.
- [ ] Anonymous requests cannot select private inputs or download private files.
- [ ] An unrelated authenticated user cannot write, change their role or read private rows.
- [ ] Verified input with missing evidence is rejected by the database.
- [ ] Completed task without evidence is rejected.
- [ ] Upload/download bytes match; 20 MB limit rejects oversize input.
- [ ] Rename/move/trash/restore and file links work.
- [ ] JSON/CSV/DOCX exports open; print-to-PDF works.
- [ ] Invalid JSON import fails without record deletion; note non-atomic import caveat.

Do not mark these as passed until actually executed.

## Verified account state (10 November 2026)

- Supabase project ID `ttooxyezrvbyscexjxno` is ACTIVE_HEALTHY in `ap-south-1`.
- Initial, input-versioning and anonymous access hardening migrations were applied. Ten application tables have RLS enabled and the file bucket is private.
- GitHub repository `https://github.com/aayush-bhatta/nepal-gep-workspace` has been created (public, empty). An attempted connector write returned HTTP 403 (integration inaccessible); upload the source with GitHub web interface, or use an authorized git/Codex workflow. No repository files have been committed by the assistant.
- The Supabase project currently has no authenticated users and no assigned workspace owner. Owner setup is required before login can access private records.

- The application has not yet passed a Vite production build because access to registry.npmjs.org failed in the preparation environment. The Actions workflow now supports an initial npm install without a lockfile; commit the resulting lockfile once it is generated.

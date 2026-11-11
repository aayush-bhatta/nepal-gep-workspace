# Nepal GEP — File Workspace v2 rollout guide

This is an **additive** upgrade to the existing deployed application. Do not recreate the project or reapply the three original SQL migrations. No existing records or Storage objects need to be replaced.

## 1. What changes

- New React modules: `src/FileWorkspace.tsx`, `src/FilePreview.tsx`, `src/fileUtils.ts`, `src/backup.ts` and automated utility tests.
- Modified `src/main.tsx` to mount the upgraded file manager instead of the original table, modified `src/style.css` and `package.json`.
- New SQL migration `supabase/migrations/XXXX_file_workspace_v2.sql` (the XXXX prefix matches the migration version actually created in your Supabase project). It adds metadata fields and append-only history to the `files` registry, backfills existing file history, and exposes 3 authenticated database functions for safe folder operations and version replacement.

## 2. Database migration

Applied through the connected Supabase project tool (when this package was prepared). Check the Supabase dashboard's migration history for `file_workspace_v2`. **Do not re-run a migration which is already recorded.** The functions use SECURITY INVOKER, existing `can_edit()` membership checks, and RLS to protect private records. `storage.buckets.research-files.public` remains `false`.

You may verify from Supabase SQL Editor:

```sql
select id,original_name,folder_path,storage_path,current_version from public.files;
select file_id,version_number,storage_path from public.file_versions;
select tablename,rowsecurity from pg_tables where schemaname='public' and tablename in ('files','file_versions','folders');
select id,public,file_size_limit from storage.buckets where id='research-files';
```

## 3. GitHub deployment

The connected GitHub integration previously rejected writes with HTTP 403, so updating `main` may require your GitHub web upload or an authorized git/Codex workflow. Upload this package's **changed/new** files to `aayush-bhatta/nepal-gep-workspace` without deleting or replacing other research files. The deployment workflow uses `npm install` and `npm run build`. `package.json` includes `jszip@3.10.2`. Commit a generated `package-lock.json` when running `npm install` on an internet-connected development machine, and later change the workflow to `npm ci` for reproducible deployment.

GitHub Pages Settings → Source must remain **GitHub Actions**. `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` remain the same as before. No new secret keys are required. The app runs entirely on GitHub Pages as a static React SPA; SQL and file bytes remain in Supabase.

## 4. Validation after deployment

1. Sign in as owner at `https://aayush-bhatta.github.io/nepal-gep-workspace/#/files`. Existing `syllabus.pdf` must remain in **All folders/root**. Click **Preview**, and ensure bytes open; no external public URL should be exposed.
2. Create an empty test folder, rename, move and delete it. Move a nested folder and verify descendant paths. Reject deleting a nonempty folder.
3. Upload a small CSV to `Data/Demand`; preview its table. Check the ZIP, PDF/image and `.xlsx` preview with safe files.
4. Open Details for a file, enter source title, original URL, authors, page/table reference, and notes. Link it to a recorded input by UUID.
5. Upload a replacement version and verify you can download v1 and v2 with distinct bytes. Uploading does **not** mark the input verified.
6. Download a full ZIP backup, inspect `manifest.json` and `records.json` in a copy, and keep at least one copy on a separate drive.
7. To test restore without overwriting originals, use a **separate disposable Supabase test project** with matching schema and new owner membership. Do not test destructive recovery in production. Restore is add-only and reports the number of inserted/skipped rows.
8. Check that an anonymous browser cannot list private files or download Storage objects; verify RLS with dedicated nonmember test credentials. SQL-level grants alone do not simulate every real authentication path.

## 5. Google Colab handling

- Save a secure `https://colab.research.google.com/...` link (or a Google Drive notebook link, or public GitHub notebook blob link) in file metadata → **External notebook URL**. The notebook's **Open in Colab** button will open that exact destination in a new tab.
- If an `.ipynb` exists *only in private Supabase Storage*, use **Download notebook + open Colab**. In Colab select File → Upload notebook. The browser cannot inject private Storage bytes into Colab directly without a separate authenticated Google Drive integration.
- For version-controlled code, consider committing *non-sensitive* scripts to GitHub and storing the exact Git commit in `model_runs.git_commit`. Never put private research files in a public repo unintentionally.

## 6. Backup/restore guarantees and limitations

- ZIP stores `records.json`, `manifest.json`, and `objects/*.bin` with all bytes of every registered file version. Hashes are checked before any restore writes. The browser sends no objects to third-party servers; it only calls your own authenticated Supabase endpoint.
- Original database records and Storage object keys remain unchanged. New imports assign fresh Storage keys; existing record IDs are skipped. Unknown/missing input values are never treated as zero or verified.
- Authentication users, roles, passwords, provider configuration, GitHub source code and Supabase environment configuration are **not** included. You must back them up/configure them separately as appropriate.
- For >250 MB, use Supabase's Storage CLI/S3 export and database dump. Free projects can be paused and have provider limits, so do not rely on Supabase as your only long-term research archive.
- Restore is additive and per-request, not a single all-or-nothing database transaction; it can partially complete and requires review if interrupted. Keep the original ZIP as the recovery source. A production disaster-recovery practice requires a separate full restore rehearsal.

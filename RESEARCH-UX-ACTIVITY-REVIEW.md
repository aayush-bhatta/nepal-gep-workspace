# Nepal GEP research UX and activity audit — release review

## Purpose
This PR fixes three editor failures (invalid task parent UUID, unhelpful JSON errors, and unconfirmed file trashing), adds a browser favicon, and introduces a public read-only activity history plus reversible archiving of immutable model-run test entries.

## Risk controls
- No existing inputs, tasks, model runs, file objects, scenario horizons, memberships, or storage buckets are deleted.
- **Do not delete the Scenario comparison section.** Planning horizons are essential to GEP. Two existing model-run records labeled "why" and "check" can be archived after this upgrade rather than rewritten/deleted.
- New `model_run_visibility` stores archive flags separately from immutable `model_runs` rows. Owner can archive/unarchive; public can read. No SQL updates to model run results.
- New `activity_events` records **only** affected entity name, record ID, action, timestamp and changed field NAMES (not old/new field values or file contents). Public can read; direct client inserts/updates/deletes are revoked. Changes after migration are logged; historical changes before migration are NOT reconstructed. Direct changes to Storage objects outside the app are not represented.
- Audit trigger code lives in non-exposed `app_private` schema with locked-down execution, and existing Supabase Owner/RLS boundaries are preserved.
- Files moved to Trash get a confirmation explaining they are recoverable. Record deletion gets an item-specific warning.
- Task parent and baseline-run selectors use actual existing record names rather than manually pasted UUIDs.
- JSON editor shows validation guidance and rejects invalid input before database save.
- SVG favicon and title metadata change the browser tab icon; no branding files or fonts are imported.
- Existing file backup still covers current research records and Storage bytes. Activity log has a separate CSV export, not a restore operation.

## Rollout
1. Review PR and GitHub Actions checks. Confirm `npm ci`, `npm test`, `npm run build`, browser tests.
2. Review the staged additive migration `supabase/migrations/20261112032000_activity_and_run_visibility.sql`. After approval, apply it ONCE to the existing project BEFORE merging the UI. Do not rerun earlier migrations.
3. Verify public read + no public writes on `activity_events` and `model_run_visibility`; verify Owner can archive and that events cannot be tampered with.
4. Merge PR; check main GitHub Pages workflow. Visit activity, task editor, sensitivity JSON and file trash confirmation in Safari/Brave.
5. Archive the two test runs if desired. They stay in database, can be shown with "Show archived", and the activity log retains the archive event.

## Known limits
- Deletions performed before activating the activity trigger won't appear historically.
- Native browser dialogs are used for irreversible actions. An accessible custom modal could be added later.
- Browser favicon display may be cached; hard-refresh or reopen the site if it doesn't appear.
- Actual database CRUD and Storage access should be tested by the owner after deployment; automated frontend tests use fixtures.

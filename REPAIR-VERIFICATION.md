# Private workspace repair verification

Started from `main` at `f01497e28cec903c45f0008fd4bc7713cb3f8931`. Inspected the existing React source, all four SQL migrations, original three utility tests, package configuration and Pages workflow before implementation. A read-only Supabase migration-list check confirmed the same four versions are already applied, including `20261110175204_file_workspace_v2`. No migration, live row, owner permission, bucket setting or Storage object was changed by this work.

## Changes

| Files | Purpose |
| --- | --- |
| `src/PdfCanvas.tsx`, `src/FilePreview.tsx`, `src/style.css` | Locally bundled PDF.js worker and canvas renderer, zoom/page controls, cancellation on version changes, safe preview errors, stale worksheet/preview request protection. PDF module loads on demand. Historical notebook versions do not claim to match a current external Colab link. |
| `src/errors.ts`, `src/db.ts`, `src/main.tsx`, `src/FileWorkspace.tsx` | Readable errors from plain Supabase objects; preserve uploaded recovery bytes after uncertain metadata/RPC errors. |
| `src/dataAccess.ts`, `src/folderUtils.ts`, `src/FileWorkspace.tsx` | Paginate past API row caps, preserve chronological display order, materialize missing parents for navigation without DB writes, clear cross-folder search when navigating, block nonempty folder deletion including trash. Existing transactional folder RPCs remain authoritative. |
| `src/fileUtils.ts` | Bound compressed and expanded spreadsheet sizes before parsing. |
| `src/backup.ts` | Verify recorded checksums and actual byte totals on export, reject edits during export, validate archive structure/references/duplicate IDs and object keys, reject restore conflicts before writes, verify existing skipped bytes and newly uploaded bytes, retain partial recovery data and report progress. |
| `src/*.test.ts`, `tests/`, `playwright.config.ts` | Unit and browser regression coverage using synthetic records and private bytes. |
| `package.json`, `package-lock.json`, `.gitignore`, `.github/workflows/` | Reproducible dependencies, PDF.js, Playwright, PR verification, tests before existing main-only Pages build. Correct JSZip to published `3.10.1` (the previous manifest requested nonexistent `3.10.2`). |
| `README.md`, `REPAIR-VERIFICATION.md` | Current setup and verification/recovery instructions. |

## Automated checks

Final local results: `npm ci` passed; `npm test` passed (12 tests across 3 files); `npm run build` passed; `npm run test:browser` passed (13 Chromium checks); `git diff --check` passed. The build retains a large main-bundle warning. Run on Node 24 in this repair environment; CI uses Node 22:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:browser
```

Browser tests use the actual workspace and preview components with intercepted requests against a dummy Supabase hostname. The PDF test checks a rendered blue pixel, actual canvas dimensions after zoom, and the second page. The browser suite never authenticates to or writes to the production database. Unit checks cover ZIP private-byte round trips, payload corruption, duplicate object keys/row IDs, recorded hash mismatch, conflicting IDs, missing/different skipped bytes, fresh-key add-only restore and partial failure reporting; error formatting, missing parent navigation, folder protection, and pagination beyond 2,000 records are also covered.

## Manual verification before approving deployment

1. Run the branch locally with the existing publishable configuration and an invited account. Do not reapply any migration. In Brave with normal Shields settings, preview an existing private PDF; test first/last pages, zoom limits, close/reopen and historical version selection. Confirm there is no PDF iframe, public URL or third-party PDF request in Network. This is read-only.
2. Preview existing PNG/JPEG, quoted CSV, multi-sheet `.xlsx`, Python and notebook files. Switch versions and worksheets quickly; old requests must not replace the selected content. Check notebook Colab links point to the saved external source. Private notebook bytes require a separate authorized upload to Colab.
3. Inspect Details: source title, authors/year, source URL, DOI/page references, access date, notes/assumptions, tags and version checksums. Compare these against existing values without saving.
4. With separate approval for test writes, use disposable folders/files in an isolated recovery project with the same reviewed schema: rename and move a folder subtree, reject moving into itself/conflicting paths, reject deleting folders containing active files, trash or subfolders, and allow empty-folder deletion. Verify Storage keys and existing version bytes never change.
5. Export ZIP while edits are paused; inspect `manifest.json`, `records.json` and `objects/*.bin` offline. Check SHA-256 values independently. Open the archive without clicking Restore to validate integrity. A changed payload must fail before restore is enabled.
6. Rehearse restore only in an isolated, explicitly approved recovery project. Compare row counts, original IDs, task parents, links, citations, current file bytes and every version hash. Existing matching records are skipped; differing IDs/paths/horizons or changed records stop preflight. Test an interrupted restore and retain its report and ZIP. No existing record or object is overwritten.

## Remaining limits and recovery safeguards

- Brave itself and the signed-in live operations have not been automated. Chromium verifies the plugin-free rendering path. Supabase documentation search succeeded, but the changelog URL was blocked by the environment's network policy (HTTP 403).
- Excel preview supports `.xlsx`, not legacy binary `.xls`; convert `.xls` to `.xlsx` or CSV. SVG, macros, notebook outputs, HTML and code are not executed or embedded. Notebook preview shows source only. Encrypted PDFs need an external viewer. Preview row/size limits remain documented in the UI.
- Virtual parents are navigable but cannot be renamed/deleted until an actual folder row is created with the Folder action. This avoids inventing live records or attempting RPCs against nonexistent rows.
- ZIP contains registered current/historical file objects, research rows and citations, including trash. Unregistered/orphan Storage objects, Auth users/passwords, role assignments, provider configuration and source code require independent provider backups. Failed uploads/metadata commits may retain unregistered recovery objects; save the reported key and inspect it before any approved cleanup.
- ZIP is not encrypted or digitally signed: checksums detect corruption, not an attacker who rewrites both bytes and manifest. Keep archives private and use trusted backups only. Limit is 250 MB object bytes plus bounded metadata. ZIP parsing still consumes browser memory.
- Export rereads records to reject concurrent changes, but is not a database snapshot; pause editing for a consistent backup. Restore spans separate API requests and is not atomic. Server constraints/RLS may still reject records after earlier inserts. There is no automatic deletion or rollback of retained bytes. Save the partial report; refresh and assess state before retrying. Strict preflight can require a fresh recovery project after a partial restore.
- The existing first-version insert trigger generates a version-row UUID for a restored v1 file. Restore preserves its bytes/version number and skips the equivalent archived v1 pair; that history-row UUID can differ from the archive. Existing live version IDs remain untouched. Restores into independently seeded projects may stop on folder/scenario conflicts; do not delete seed/live records to force an import without approval.
- Existing folder RPC SQL is unchanged. The UI precheck supplements server checks, but no new cross-client locking scheme is introduced; coordinate folder edits/uploads during recovery.
- Vite may report its existing large main-bundle warning. PDF.js is split into a lazy module and its worker is served from the same GitHub Pages base path.

No merge or production deployment is authorized by this repair.

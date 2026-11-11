# Nepal GEP — Research Workspace

Private research-management workspace for Nepal generation expansion planning (GEP) in **2030, 2040 and 2050**. The dashboard records data sources, assumptions, methodology, model versions, verified results and research files. It does **not** run Python/PuLP optimizations or claim unverified research results.

## Live services and ownership

- Frontend: React + TypeScript + Vite, GitHub Pages at https://aayush-bhatta.github.io/nepal-gep-workspace/
- Repository: https://github.com/aayush-bhatta/nepal-gep-workspace
- Database, authentication and private file storage: Supabase project `ttooxyezrvbyscexjxno` (region `ap-south-1`).
- Login: Supabase Auth, with one authorized workspace owner in the database. Authentication credentials and owner membership are **not** stored in this GitHub repository.
- Supabase workspace data is private by default. `published_entries` is the intentionally public table; do not put unpublished material into its payload.
- Your project, hosting and data are independent of a ChatGPT subscription, subject to GitHub and Supabase provider plans, quotas and retention policies.

## Research functionality

- Dashboard: 2030/2040/2050 horizons, verified-input counters, recorded model runs and task progress.
- Input register: hourly demand, hydro technologies, solar, BESS, costs, reliability and policy, with validation status, source and evidence.
- Scenario comparison: append-only model-run evidence and energy/capacity mix records; no invented results.
- Sensitivities and tasks: structured research progress, issues, evidence and next actions.
- File manager v2: virtual folders with move/rename/empty-folder delete, private uploads/downloads and trash/restore, read-only PDF/images/CSV/Excel `.xlsx`/Python/notebook previews, source citations, external links, SHA-256 checksums and preserved replacement versions.
- Full project-data ZIP backup: database records plus private file bytes for all **registered** file versions. Validated add-only restore skips existing IDs and doesn't overwrite existing records. See limits below.
- Research evidence links associate files with input, scenario, model-run, sensitivity or task UUIDs.
- `.ipynb` notebook links saved in metadata can open an existing Colab/Drive or public GitHub notebook in a new tab. A notebook stored exclusively in private Supabase Storage requires a download and authorized Colab upload; the app never exposes private objects publicly.

## Deployment

**v2 database migration has already been applied** as `20261110175204_file_workspace_v2` in the existing Supabase project. Do not run the initial migrations again. The original `syllabus.pdf`, its private object path, the input record and initial folders remain intact.

The latest source ZIP and deployment patch are included in this ChatGPT conversation. The GitHub integration's write attempts returned HTTP 403, so **this frontend upgrade is not live until the files are committed to the actual GitHub repository** and the GitHub Actions workflow finishes successfully. See `UPLOAD-TO-GITHUB.md` and `UPGRADE-V2.md` for exact directions.

The `.github/workflows/deploy.yml` action checks out `main`, sets up Node 22, installs dependencies, runs tests and builds Vite. It deploys `dist` to GitHub Pages. It uses existing GitHub Actions repository variables:

- `VITE_SUPABASE_URL` (Supabase project HTTPS URL)
- `VITE_SUPABASE_PUBLISHABLE_KEY` (public browser key)
- `VITE_BASE_PATH=/nepal-gep-workspace/` (provided in workflow)

No Supabase service-role key, database password, or GitHub token belongs in client-side configuration. `.gitignore` excludes `.env` and `.env.local`.

**Developer setup:** use Node 22, run `npm install` (generates `package-lock.json`), `npm test`, `npm run build`, then `npm run dev`. Commit the generated lockfile after a successful install; prefer `npm ci` in CI afterward. This package was prepared in a container without npm registry access, so its full dependency installation, Vite build and end-to-end tests could not run here.

## Storage and privacy model

- `folders.path` and `files.folder_path` describe virtual folders, not physical Storage directories.
- Uploaded bytes live in the **private** `research-files` bucket at `objects/<UUID>`. Moving a folder changes database paths, not Storage object keys.
- New versions upload to a fresh key, then update file metadata and version history in one database transaction. Existing versions remain stored.
- Deleting an empty folder is allowed; deletion of a folder with files/subfolders is rejected. Trashing a file is recoverable metadata only; bytes are retained. Nothing automatically verifies uploaded content.
- All private tables (including `file_versions`) use RLS and membership checks, and the storage bucket is nonpublic.
- The public GitHub source does not contain uploaded research files or credentials.

## Backups, restoration, and limits

- Browser ZIP export includes `records.json`, `manifest.json` with SHA-256 digests, and binary `objects/*.bin` for registered files and past versions. A JSON-only export is **not** a full backup.
- Browser ZIP backups/restores are limited to 250 MB uncompressed object bytes (and ZIP-size limit on import). For larger projects use Supabase's database backup/dump facilities plus bulk Storage/S3 export.
- ZIP restore validates archive hashes and schema, restores missing records/objects with new private object keys, and skips existing identifiers. It is **not atomic** across browser API calls; interrupted restores can leave partial inserts. Keep backups and rehearse restores in a separate project.
- Supabase Auth users, passwords, owner/editor role assignments, provider settings, and GitHub source are intentionally **not included** in the research backup. Back them up or reconstruct them separately.
- PDF, CSV and Excel previews are read-only, limited-size convenience views. CSV timestamps, units, missing hours and paper provenance must still be validated as research work.
- No arbitrary Python scripts, notebooks, spreadsheet macros, HTML or formulas are executed.
- Maintain independent offline and cloud backups. Supabase Free does not guarantee indefinite availability; consult https://supabase.com/pricing and current support docs.

## Technical caveats

The backend migration and schema checks have been verified; a browser session has not yet been used to test every new operation. No claim is made that the upgraded frontend is already deployed. See `UPGRADE-V2.md` for verification and the exact cases to test before relying on backup/restore.

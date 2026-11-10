# Upload the Nepal GEP Research Workspace to GitHub (Mac / Brave)

The GitHub repository already exists: https://github.com/aayush-bhatta/nepal-gep-workspace

The linked connector reported `403 Resource not accessible by integration` on repository writes, so no source files were uploaded automatically.

## Upload using the GitHub website

1. Download `nepal-gep-workspace-deployment.zip` from this ChatGPT conversation and open it in Finder (double-click to extract).
2. Open the **extracted folder**. On macOS, press **Command + Shift + .** to reveal hidden files and folders. Select ALL contents, including `.github`, `.env.example`, `.gitignore`, `src`, and `supabase`. Do **not** select only the ZIP and do **not** upload a parent directory instead of its contents.
3. Open https://github.com/aayush-bhatta/nepal-gep-workspace . Select `uploading an existing file` (empty repository screen) or `Add file > Upload files`.
4. Drag the selected files/folders into GitHub's upload area; verify their paths, particularly `.github/workflows/deploy.yml`, `src/main.tsx`, and `supabase/migrations/`.
5. Commit directly to `main` with the message `Initial Nepal GEP research workspace`.

If the browser refuses to upload a folder, use `git`/GitHub Desktop instead. GitHub Desktop supports adding the existing local folder and publishing/pushing to the empty remote repository.

## After uploading

1. Go to the repository **Settings > Secrets and variables > Actions > Variables**. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (client key, not service-role) from the Supabase project dashboard. Set `VITE_BASE_PATH` to `/nepal-gep-workspace/`.
2. Go to **Settings > Pages > Build and deployment > Source** and select **GitHub Actions**.
3. In GitHub **Actions**, inspect the `Deploy GitHub Pages` workflow. Only report deployment success if it shows green.
4. In Supabase **Authentication > Users**, invite/create the intended owner account. Disable open signups in Authentication Providers; then grant that known user's UUID the `owner` role in `public.workspace_members` as documented in README.
5. Supabase Auth **URL Configuration** should include `https://aayush-bhatta.github.io/nepal-gep-workspace/`.

Do not upload secrets or any `.env.local`. The repo should contain `.env.example` placeholders only.

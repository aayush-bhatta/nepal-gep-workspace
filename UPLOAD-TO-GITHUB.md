# Publish the Nepal GEP v2 upgrade safely

**The Supabase database migration has already been applied. Do not re-run it on production.**

## GitHub write-access limitation

The GitHub connector in this chat previously returned `403 Resource not accessible by integration` for writes. Read access and deployment log inspection do work. Until repository write access is granted, use the GitHub web interface to commit the files. The live website does not gain v2 features just because Supabase was migrated.

## Easy upload using GitHub web UI

1. Download the **v2 patch ZIP** supplied in the ChatGPT response and extract it on your Mac.
2. Open `https://github.com/aayush-bhatta/nepal-gep-workspace/upload/main`.
3. Open the extracted patch directory in Finder and select its **contents**, including the `src`, `supabase` and `.github` directories. Press Command + Shift + . if hidden directories are not visible.
4. Drag all selected files/folders onto GitHub's file-drop area. Existing files are updated by the new versions; new files are added. **Do not delete the existing repository first.**
5. Check the file paths listed before committing. You should see `src/FileWorkspace.tsx`, `src/FilePreview.tsx`, `src/fileUtils.ts`, `src/backup.ts`, and `supabase/migrations/20261110175204_file_workspace_v2.sql`.
6. Commit with message `Upgrade Nepal GEP file management and backup v2`.
7. Open `https://github.com/aayush-bhatta/nepal-gep-workspace/actions` and check the latest action. It installs dependencies, runs the utility tests and builds the website. A green tick is required before claiming deployment success.
8. Refresh `https://aayush-bhatta.github.io/nepal-gep-workspace/#/files` and sign in as your existing owner.

**Do not upload your Supabase password, `.env.local`, service key or API secret.** The existing GitHub Actions *publishable* project variables remain correct and do not need to be changed.

If GitHub's file uploader refuses to overwrite any existing path, use the repository editor for that file, or use GitHub Desktop / Codespaces to commit the extracted patch. There is no need to re-create the Supabase project.

## Verify the upgrade

- Find the existing `syllabus.pdf` under **All folders/root**; Preview should open it privately.
- Test an empty folder: create, rename, move and delete it; nonempty folder deletion must fail.
- Upload a sample CSV under `Data/Demand`, preview rows, save source citation metadata and link it to an input record.
- Add a new version of a test file; both versions should remain accessible.
- Click **Full ZIP backup**, keep a copy outside Supabase, and confirm it contains `manifest.json`, `records.json`, and `objects/*.bin`.
- Test restoring your backup **only in a disposable test project** before depending on it for disaster recovery. The restore workflow is additive, not an atomic transaction.

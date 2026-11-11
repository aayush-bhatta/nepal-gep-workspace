# Nepal GEP: public read-only research, single Owner, opt-in visitor analytics

## Requested publishing model
- **Anyone** opening the public GitHub Pages URL can read the input register, scenarios, sensitivity records, work log, source references and files **without creating an account**.
- **Only the existing Owner** may add, edit, delete, move or replace research items, upload files, update metadata, publish curated summaries, or restore backups.
- Other authenticated roles (editor/viewer) are now read-only too. The owner login remains optional under **Owner sign in**.
- The Supabase Auth users and `workspace_members` roles are **never public**.
- This is truly public access. A link is not a security boundary: anyone can share or index it. Before approving the migration, ensure all present AND future research files and metadata are safe for public release.

## Rollout
1. Review pull request and confirm GitHub verification passes. **Do not apply SQL or merge before you agree to publish all existing research.**
2. Review `supabase/migrations/20261111153000_public_readonly_owner.sql`. Apply only this new migration, once, to the existing Supabase project after explicit approval. Do not rerun older migrations.
3. Test anonymous GET requests for `inputs`, `files`, `file_versions` and Storage `download()`. Test anonymous INSERT/UPDATE/DELETE all fail, as do editor-account writes. Test Owner CRUD still works.
4. Merge PR, then confirm GitHub Actions deploys from `main`. In an incognito Brave window, visit `/#/inputs`, `/#/scenarios` and `/#/files` without signing in, then sign in as Owner and test editing.
5. A deleted Storage object may still have a stale file metadata record. Repair those separately; this migration does not delete any record or object.

## Visitor analytics (free, optional)
- Create a Cloudflare Web Analytics site for hostname `aayush-bhatta.github.io`. Cloudflare does not require your GitHub Pages domain to move to Cloudflare.
- From that Web Analytics site, copy its **beacon site token**, not your Cloudflare API token.
- Add GitHub **Actions repository variable** `VITE_CF_WEB_ANALYTICS_TOKEN` with the site token, then rerun the GitHub Pages deployment.
- The application will inject the Cloudflare beacon only when this variable is provided and well formed.
- Analytics estimate visits, pages, referrers, regions and devices; they do not reveal real names/emails and are not retroactive. Ad blockers (including Brave Shields) can suppress tracking.
- The app uses HashRouter. The beacon counts page loads; accurate per-section hash-navigation analytics may need separate SPA route events later.

## Security design
- Existing `research-files` bucket stays **private** at bucket level. A new Storage RLS SELECT policy permits anyone with the public API key to download **registered active** document versions only. Unregistered/orphan objects and trashed files are not deliberately exposed.
- All read tables have RLS and explicit SELECT grants. The `workspace_members` and Supabase Auth tables have **no public read grants**.
- Existing INSERT/UPDATE/DELETE policies still invoke `public.can_edit()`, now Owner-only. The Owner-only publishing policy remains.
- Public visitors can download copies and redistribute them. Revoking access later cannot retract copies.
- Existing backup restore is non-atomic. Never keep credentials in published research files.

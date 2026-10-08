# Echo language learning studio

A bilingual language practice interface with shadowing, dictation, vocabulary cards and learning progress. Static frontend hosted on GitHub Pages; authentication, private course storage and access-code redemption powered by Supabase.

Payments and AI are disabled in this edition. Users sign in with a username and password; mail-based password recovery is not enabled.

## Development and deployment

- Node.js 24: run `npm ci`, then `npm run test:cloud`.
- Apply `supabase/migrations/202610070001_echo.sql` to a new Supabase project.
- Set public project settings `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` to build with `npm run build:static`.
- Never commit a service-role key, database password, user database, or raw access codes.
- Read [deployment instructions](deploy/Supabase免费部署.md) for account setup, media import and verification.

Media files are not included. Original demo and public-domain course metadata is included; third-party reference materials are excluded. Public source visibility does not grant rights to third-party materials.

## YouTube course ingestion

Weekly YouTube ingestion prepares bilingual course drafts in Supabase; publication remains manual. See [setup and source configuration](ingestion/README.md). Automation is disabled until credentials and the first real import have been verified.

# Storage gateway

Profile pictures, banners and library files for Danna, Botdanna and the hub. They are kept in Supabase Storage (500 MB
free) and, once that holds 400 MB, new files go to Cloudflare R2. The apps call this Worker for every file; the Worker
checks the person's Supabase sign-in and applies the same rules as the storage policies.

## Set up (once)

1. **Cloudflare dashboard → R2 Object Storage.** Enable R2 and create a bucket named `danna-files`. Keep it private.
2. **In a terminal**, in this folder:

   ```powershell
   cd worker\storage
   npm install
   npx wrangler login
   ```

   `wrangler login` opens your browser. Approve it there.
3. **The service-role key.** In Supabase: Project Settings → API → `service_role` key. Then, in the terminal:

   ```powershell
   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
   ```

   Paste the key at the prompt. It is stored in Cloudflare and never goes into the repository or the apps.
4. **The database.** In Supabase, run `supabase/migrations/0029_storage_usage.sql` (after 0027 and 0028).
5. **Deploy.**

   ```powershell
   npx wrangler deploy
   ```

   The command prints the Worker's address, for example `https://danna-storage.<your-name>.workers.dev`. Send it to
   the developer: it goes into the apps and the hub.

## Notes

- The address is public. Access is decided by the sign-in, not by the address.
- `ALLOWED_ORIGINS` (wrangler.toml) lists the apps and the hub. Add an origin only for a real app that uses the storage.
- `STORAGE_THRESHOLD_BYTES` (wrangler.toml) is the level at which new files go to R2. The default is 400 MB.
- Files already in Supabase Storage stay there. Only new files go to R2.
- The tests run with the rest of the suite (`npm test` in the repository root).

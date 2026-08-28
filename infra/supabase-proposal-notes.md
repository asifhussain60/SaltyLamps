# Supabase — proposal-site notes database

Database record for the notes and brainstorm board behind the **Salty Lamps
proposal site** (`salty-lamps-proposal.pages.dev`).

> **This is not the storefront.** `salty-lamps-site` uses Cloudflare D1 and has
> no Supabase dependency — see [`cloudflare.md`](cloudflare.md), which records
> that the `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` pair was retired. This
> file covers the earlier proposal/presentation site only, which is still live.

Moved here from the `podcast-factory` repo on 2026-08-03; that repo had no
business holding Salty Lamps records. Content last reconciled 2026-05-31 and
**not re-verified since** — treat the schema as accurate and the operational
notes as historical.

---

## Project details

| Field | Value |
|---|---|
| **Project name** | asifhussain60's Project |
| **Project ID** | `babguqugvxagijmnsgsj` |
| **Project URL** | `https://babguqugvxagijmnsgsj.supabase.co` |
| **REST API base** | `https://babguqugvxagijmnsgsj.supabase.co/rest/v1/` |
| **Region** | East US (North Virginia) — `us-east-1` |
| **Plan** | Free — 500 MB DB, 5 GB bandwidth, NANO compute |
| **Dashboard** | <https://supabase.com/dashboard/project/babguqugvxagijmnsgsj> |

---

## Keys

Per this directory's rule, no key **values** appear here — only where each is
found. This repo is public.

| Key | Where to get it | Usage |
|---|---|---|
| Publishable (anon) | [API Keys page](https://supabase.com/dashboard/project/babguqugvxagijmnsgsj/settings/api-keys) | Baked into the proposal site's JS bundle at Vite build time |
| Secret | Same page | Server-side only. Nothing currently uses it |

> **⚠ The publishable key is not as safe here as the name suggests.** A Supabase
> publishable key is only browser-safe to the extent Row Level Security limits
> it — and on this project RLS is `using (true) with check (true)` on both
> tables (see below). Anyone holding that key can **read, modify and delete
> every row**. The key is already public, because Vite bakes it into the
> deployed bundle, so anyone who views source on the live site has it.
>
> That was an acceptable trade for a single-user proposal tool with no valuable
> data. It is worth knowing rather than forgetting, and it is why the value is
> not restated in this file: no reason to make it *more* discoverable.

---

## Tables

### `text_notes` — the freeform notes tab. One row, keyed `'default'`.

```sql
create table text_notes (
  id text primary key default 'default',
  content text default '',
  updated_at timestamptz default now()
);
```

### `board_notes` — one row per post-it on the brainstorm board.

```sql
create table board_notes (
  id bigint primary key,          -- Date.now() at creation
  x float default 0,              -- canvas position, px
  y float default 0,
  width float default 200,
  height float default 160,
  color text default 'yellow',    -- yellow|pink|blue|green|orange|purple
  content text default '',
  z int default 1,                -- stacking order
  updated_at timestamptz default now()
);
```

### Row Level Security

Enabled on both tables, with a deliberately open policy:

```sql
alter table text_notes  enable row level security;
alter table board_notes enable row level security;

create policy "allow all" on text_notes  for all using (true) with check (true);
create policy "allow all" on board_notes for all using (true) with check (true);
```

**To tighten it:** replace `using (true)` with policies scoped to Supabase Auth
user ids. That requires adding auth to the proposal site, which today has none.

---

## How the proposal site uses it

`src/components/NotesPanel.jsx`:

1. **On first panel open** — fetch both tables, hydrate state, cache to localStorage.
2. **On every change** — update state and localStorage immediately, then upsert to
   Supabase after a **1.5 s debounce**.
3. **Sync indicator** — "Saving…" (orange) during the debounce, "Saved" (green) on
   success, "Offline" (red) on error.
4. **Board writes** delete all rows and re-insert. Crude, but it sidesteps
   partial-update edge cases at this scale.

Client init, `src/lib/supabase.js`:

```js
import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = url && key ? createClient(url, key) : null
```

Both vars come from `.env.local` at the proposal site's root and are baked in at
build time, so that file must exist and be populated **before** `npm run build`.
Cloudflare Pages environment variables are not used for them.

---

## Building and deploying the proposal site

Its source repo was recorded as
`/Users/asifhussain/PROJECTS/DevProjects/Salty Lamps/salty-lamps-proposal/`,
which **does not exist on the current machine** — verified 2026-08-03. The site
is still live, so the source is presumably on another machine or in another
checkout. Locate it before relying on these commands.

```bash
cd salty-lamps-proposal
npm run build
npx wrangler pages deploy dist \
  --project-name salty-lamps-proposal --branch master --commit-dirty=true
```

The Pages project sits on the **`asifhussain60@hotmail.com`** Cloudflare account
(`844bc687926c910d5ad9d79c40ad1f2f`), **not** the gmail account that holds
`safinaverse.com`. The record that previously documented this claimed gmail; the
gmail account has only ever held `asif-academy`. Verified against the API
2026-08-03.

---

## Viewing the data

| Surface | URL |
|---|---|
| Table Editor | <https://supabase.com/dashboard/project/babguqugvxagijmnsgsj/editor> |
| SQL Editor | <https://supabase.com/dashboard/project/babguqugvxagijmnsgsj/sql> |
| API Keys | <https://supabase.com/dashboard/project/babguqugvxagijmnsgsj/settings/api-keys> |

```sql
select * from text_notes;
select id, color, content, x, y from board_notes order by id desc;
```

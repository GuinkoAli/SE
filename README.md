# ALX Polly

A modern polling app built with Next.js App Router, TypeScript, and Supabase. Users can register, create polls, and share them for others to vote. The project also demonstrates secure patterns to prevent duplicate votes, unauthorized access, and input tampering.

## Tech Stack
- Framework: Next.js (App Router)
- Language: TypeScript
- Auth/DB: Supabase (Postgres + RLS)
- UI: Tailwind CSS + shadcn/ui
- State: Server Components first; Client Components for interactivity

## Project Overview
- Auth: Email/password login and registration via Supabase Auth.
- Polls: Create, edit, list, and delete polls you own.
- Voting: Server Action validates option index, requires auth, and blocks duplicates.
- Dashboard: See your polls at /polls, with quick edit/delete actions.

---

## Setup

### 1) Prerequisites
- Node.js 20+
- npm
- Supabase project (URL + anon key)

### 2) Environment variables
Create a `.env.local` file in the project root with:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3) Database schema (run in Supabase SQL editor)
Create tables, indexes, and RLS policies:

```sql
-- Polls
create table if not exists public.polls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  options text[] not null,
  created_at timestamptz not null default now()
);

-- Votes
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.polls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_index int not null,
  created_at timestamptz not null default now(),
  constraint votes_option_index_nonneg check (option_index >= 0)
);

-- Prevent duplicate votes per user per poll
create unique index if not exists votes_unique_user_per_poll
  on public.votes (poll_id, user_id);

-- Enable RLS
alter table public.polls enable row level security;
alter table public.votes enable row level security;

-- Policies: polls (owner can manage, anyone can read their own list via app logic)
drop policy if exists insert_own_poll on public.polls;
create policy insert_own_poll on public.polls
  for insert with check (auth.uid() = user_id);

drop policy if exists update_own_poll on public.polls;
create policy update_own_poll on public.polls
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists delete_own_poll on public.polls;
create policy delete_own_poll on public.polls
  for delete using (auth.uid() = user_id);

-- Policies: votes
drop policy if exists insert_own_vote on public.votes;
create policy insert_own_vote on public.votes
  for insert with check (
    auth.uid() = user_id and exists (select 1 from public.polls p where p.id = poll_id)
  );

drop policy if exists read_votes on public.votes;
create policy read_votes on public.votes for select using (true);
```

---

## Running locally

Install and start the dev server:

```bash
npm install
npm run dev
```

- App: http://localhost:3000
- Common tasks:
  - Lint: `npm run lint`
  - Typecheck: `npm run tsc`
  - Build: `npm run build`
  - Start prod build: `npm run start`

Troubleshooting:
- If you see chunk load or build cache errors, stop the server, delete the `.next` folder, and re-run `npm run dev`.

---

## Usage examples

### Register and Login
- Go to `/register` to create an account (name, email, password).
- Go to `/login` to sign in.

### Create a poll
- Navigate to `/create`.
- Enter a question and at least two options.
- Submit; you’ll be redirected to `/polls`.

### Manage your polls
- On `/polls`, each poll shows actions:
  - View details (route may vary by implementation)
  - Edit question/options
  - Delete (owner-only)

### Vote on a poll
- From a poll’s detail page, select an option and submit.
- Server-side checks:
  - Auth required
  - Option index must be valid
  - One vote per user per poll (enforced in code and DB)

---

## Testing the app
- Manual: Use the UI flows above for create/edit/delete/vote.
- Programmatic checks:
  - Ensure duplicate voting returns an error.
  - Ensure unauthenticated users are blocked from voting/creating.
- CI ideas (not included): add unit tests for server actions, e2e for main flows.

---

## Security hardening highlights
- Server Actions validate inputs and auth server-side.
- DB-level protections: unique index on `(poll_id, user_id)`, RLS policies, and a CHECK on `option_index`.
- Auth state bridged via middleware; secrets loaded from env only.

---

## Scripts
- `npm run dev` – start dev server
- `npm run build` – build
- `npm run start` – run production build
- `npm run lint` – lint
- `npm run tsc` – typecheck

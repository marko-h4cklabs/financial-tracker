# Aurelius Tracker

Internal financial management tool for the Aurelius marketing agency team.

## Tech Stack

- **Frontend:** React 18 + Vite + TypeScript
- **Styling:** Tailwind CSS v3
- **Backend/DB/Auth:** Supabase
- **State:** Zustand
- **Forms:** React Hook Form + Zod
- **Tables:** TanStack Table v8
- **Routing:** React Router v6

## Setup

### 1. Clone the repository

```bash
git clone <repo-url>
cd aurelius-tracker
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

Go to [supabase.com](https://supabase.com) → New Project. Copy the **Project URL** and **anon key**.

### 4. Run the database schema

In your Supabase project → **SQL Editor**, paste and run the full contents of `supabase/schema.sql`.

### 5. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials in `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 6. Start the dev server

```bash
npm run dev
```

App runs at `http://localhost:5173`.

### 7. Create your first admin user

In Supabase Dashboard → **Auth → Users → Create user**, add your email and password.

Then in **SQL Editor**:

```sql
UPDATE profiles SET role = 'admin' WHERE username = 'your-email@example.com';
```

After that, use the Admin panel inside the app to create additional team members.

### 8. Deploy to Vercel

1. Push to GitHub
2. Import project at [vercel.com](https://vercel.com)
3. Add environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
4. Deploy

The `vercel.json` file at the project root handles client-side routing automatically.

## Edge Function: create-user

The Admin panel's "Create User" feature calls a Supabase Edge Function. Deploy it with:

```bash
supabase functions deploy create-user --project-ref YOUR_PROJECT_REF
```

Set the service role key as a Supabase secret:

```bash
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Auth Configuration

In **Supabase → Auth → Settings**:
- Disable **Email confirmations** (admin creates users directly)
- Set **Site URL** to your Vercel deployment URL

## Project Structure

```
src/
├── components/
│   ├── ui/           # Reusable UI primitives
│   ├── layout/       # Sidebar, header, app shell
│   └── modules/      # Feature-specific components
├── pages/
│   ├── auth/
│   ├── clients/
│   ├── deals/
│   ├── invoices/
│   ├── installments/
│   ├── expenses/
│   ├── admin/
│   └── settings/
├── hooks/            # Custom React hooks
├── store/            # Zustand stores
├── lib/              # Supabase client, helpers
├── types/            # TypeScript interfaces
└── styles/           # Global CSS, design tokens
```

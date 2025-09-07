
# Supabase Configuration

This project uses Supabase for authentication and database services.

## Environment Variables

To run this project, you need to create a `.env.local` file in the root directory and add the following environment variables:

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

You can get these values from your Supabase project dashboard.

1. Go to your Supabase project dashboard.
2. Click on the **Settings** icon in the left sidebar.
3. Click on **API** in the **Project Settings** section.
4. You will find your **Project URL** and **Project API keys** in this section.
5. Copy the **URL** and paste it as the value for `NEXT_PUBLIC_SUPABASE_URL`.
6. Copy the `anon` `public` key and paste it as the value for `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

## Supabase Server, Client, and Middleware

The following files have been created to handle Supabase integration:

- `lib/supabase/client.ts`: Creates a Supabase client for the browser.
- `lib/supabase/server.ts`: Creates a Supabase client for the server.
- `lib/supabase/middleware.ts`: A middleware that refreshes the user's session.

These files are used throughout the application to interact with Supabase.

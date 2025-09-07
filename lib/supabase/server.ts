import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Create a Supabase client scoped to the current server request.
 * - Reads/writes auth cookies via Next.js headers API.
 * - Safe for Server Components, Route Handlers, and Server Actions.
 * - Avoids leaking secrets to the client; uses anon key with RLS.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            // When called in a Route Handler/Action, this updates the response cookies.
            cookieStore.set({ name, value, ...options })
          } catch (error) {
            // Called from a Server Component: cookie mutation is noop; middleware keeps session fresh.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch (error) {
            // Same caveat as `set` in Server Components context.
          }
        },
      },
    }
  )
}

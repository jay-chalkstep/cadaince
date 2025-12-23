import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { auth } from "@clerk/nextjs/server";
import type { Database } from "./types";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// Admin client with service role key for server-side operations
// Uses regular supabase-js client without strict typing for flexibility
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

/**
 * Creates a Supabase client authenticated with the Clerk session JWT.
 * This enables RLS policies to identify the user via `auth.jwt() ->> 'sub'`.
 *
 * Use this for user-scoped operations where RLS should apply.
 * Do NOT use the admin client for user-facing endpoints like /api/users/me.
 *
 * @param clerkToken - The Clerk session token from auth().getToken()
 * @returns Supabase client with the Clerk JWT in the Authorization header
 */
export function createClerkAuthClient(clerkToken: string) {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${clerkToken}`,
        },
      },
    }
  );
}

/**
 * Convenience wrapper that gets the Clerk token and creates the authenticated client.
 * Returns null if no valid session token is available.
 */
export async function createAuthenticatedClient() {
  const { getToken } = await auth();
  const token = await getToken();

  if (!token) {
    return null;
  }

  return createClerkAuthClient(token);
}

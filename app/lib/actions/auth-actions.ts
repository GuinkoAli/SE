'use server';

import { createClient } from '@/lib/supabase/server';
import { LoginFormData, RegisterFormData } from '../types';

/**
 * Perform a password-based login using Supabase Auth on the server.
 * - Uses the server Supabase client so auth cookies are set via RLS-friendly middleware.
 * - Returns a normalized error object suitable for UI forms.
 */
export async function login(data: LoginFormData) {
  const supabase = await createClient();

  // Attempt sign-in with email/password. Supabase will set cookies via SSR helpers.
  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password,
  });

  if (error) {
    return { error: error.message };
  }

  // Success
  return { error: null };
}

/**
 * Register a new user account.
 * - Stores "name" in user_metadata for later display.
 * - If email confirmations are enabled in Supabase, the user may need to confirm before session is active.
 */
export async function register(data: RegisterFormData) {
  const supabase = await createClient();

  const { error } = await supabase.auth.signUp({
    email: data.email,
    password: data.password,
    options: {
      data: { name: data.name },
    },
  });

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

/**
 * Invalidate the current session for the authenticated user.
 * - Removes auth cookies and signs the user out server-side.
 */
export async function logout() {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    return { error: error.message };
  }
  return { error: null };
}

/**
 * Fetch the current authenticated user (or null).
 * - Reads from the server-side session.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

/**
 * Fetch the full auth session (if any) for the current request.
 */
export async function getSession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  return data.session;
}

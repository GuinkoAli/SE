"use server";

/**
 * Poll server actions
 * - All database interactions use the server-scoped Supabase client (RLS enforced)
 * - Mutations call revalidatePath to refresh relevant routes
 */
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// CREATE POLL
/**
 * Create a new poll for the authenticated user.
 * Expects: formData with `question` and repeated `options` fields (>= 2).
 */
export async function createPoll(formData: FormData) {
  const supabase = await createClient();

  const question = formData.get("question") as string;
  const options = formData.getAll("options").filter(Boolean) as string[];

  if (!question || options.length < 2) {
    return { error: "Please provide a question and at least two options." };
  }

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to create a poll." };
  }

  const { error } = await supabase.from("polls").insert([
    {
      user_id: user.id,
      question,
      options,
    },
  ]);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/polls");
  return { error: null };
}

// GET USER POLLS
/**
 * Fetch polls owned by the current authenticated user, newest first.
 */
export async function getUserPolls() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { polls: [], error: "Not authenticated" };

  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { polls: [], error: error.message };
  return { polls: data ?? [], error: null };
}

// GET POLL BY ID
/**
 * Fetch a single poll by id.
 */
export async function getPollById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("polls")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return { poll: null, error: error.message };
  return { poll: data, error: null };
}

// SUBMIT VOTE (hardened: requires auth, validates input, prevents duplicates)
/**
 * Submit a vote for a specific option on a poll.
 * - Requires login
 * - Validates option index bounds based on poll.options
 * - Prevents duplicate votes per (poll_id, user_id)
 */
export async function submitVote(pollId: string, rawOptionIndex: number | string) {
  const supabase = await createClient();

  // Require authenticated user
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) return { error: userErr.message };
  if (!user) return { error: "You must be logged in to vote." };

  // Coerce and validate option index
  const optionIndex = typeof rawOptionIndex === "string" ? parseInt(rawOptionIndex, 10) : rawOptionIndex;
  if (!Number.isInteger(optionIndex)) return { error: "Invalid option." };

  // Validate poll and bounds
  const { data: poll, error: pollErr } = await supabase
    .from("polls")
    .select("id, options")
    .eq("id", pollId)
    .single();
  if (pollErr) return { error: pollErr.message };
  if (!Array.isArray(poll.options) || optionIndex < 0 || optionIndex >= poll.options.length) {
    return { error: "Invalid option." };
  }

  // Prevent duplicate votes for this user + poll
  const { data: existing, error: checkErr } = await supabase
    .from("votes")
    .select("id")
    .eq("poll_id", pollId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (checkErr) return { error: checkErr.message };
  if (existing) return { error: "You have already voted in this poll." };

  // Insert vote (also safe against race if DB has unique (poll_id, user_id))
  const { error } = await supabase
    .from("votes")
    .insert({ poll_id: pollId, user_id: user.id, option_index: optionIndex });

  // Handle potential unique violation gracefully
  if (error) {
    const msg = error.message || "Failed to submit vote";
    if (/duplicate key|unique/i.test(msg)) return { error: "You have already voted in this poll." };
    return { error: msg };
  }

  revalidatePath(`/polls/${pollId}`);
  return { error: null };
}

// DELETE POLL
/**
 * Delete a poll owned by the current user.
 */
export async function deletePoll(id: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to delete a poll." };
  }

  const { error } = await supabase
    .from("polls")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
    
  if (error) return { error: error.message };
  revalidatePath("/polls");
  return { error: null };
}

// UPDATE POLL
/**
 * Update question/options for a poll owned by the current user.
 */
export async function updatePoll(pollId: string, formData: FormData) {
  const supabase = await createClient();

  const question = formData.get("question") as string;
  const options = formData.getAll("options").filter(Boolean) as string[];

  if (!question || options.length < 2) {
    return { error: "Please provide a question and at least two options." };
  }

  // Get user from session
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError) {
    return { error: userError.message };
  }
  if (!user) {
    return { error: "You must be logged in to update a poll." };
  }

  // Only allow updating polls owned by the user
  const { error } = await supabase
    .from("polls")
    .update({ question, options })
    .eq("id", pollId)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { error: null };
}

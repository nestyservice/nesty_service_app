import { createClient } from '@supabase/supabase-js';

const getSupabaseUrl = () => (process.env.SUPABASE_URL || '').trim();
const getSupabaseKey = () =>
  (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    ''
  ).trim();

export const isSupabaseConfigured = () => Boolean(getSupabaseUrl() && getSupabaseKey());

export function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    return null;
  }
  try {
    return createClient(getSupabaseUrl(), getSupabaseKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (err) {
    console.warn('[SUPABASE] Failed to initialize client:', err.message);
    return null;
  }
}

/**
 * Synchronizes a single user account to Supabase Authentication (auth.users)
 * Safely handles both new creations and updates if user already exists.
 * Does NOT throw errors or disrupt core application flow.
 */
export async function syncUserToSupabaseAuth(user, rawPassword = null) {
  const client = getSupabaseClient();
  if (!client || !user || !user.email) return null;

  const email = user.email.toLowerCase().trim();
  const metadata = {
    name: user.name || '',
    phone: user.phone || '',
    rollNo: user.rollNo || '',
    role: user.role || 'student',
    emailVerified: Boolean(user.emailVerified !== false),
    nestyUserId: user.id || '',
  };

  try {
    // 1. If user already exists in Supabase Auth, update metadata (and password if provided)
    if (client.auth && client.auth.admin) {
      const { data: listData, error: listError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 }).catch((e) => ({ error: e }));
      const existing = listData?.users?.find((u) => u.email?.toLowerCase() === email);

      if (existing) {
        const updatePayload = {
          email_confirm: true,
          user_metadata: {
            ...existing.user_metadata,
            ...metadata,
          },
        };
        if (rawPassword && rawPassword.length >= 6) {
          updatePayload.password = rawPassword;
        }
        const { data: updateData, error: updateError } = await client.auth.admin.updateUserById(existing.id, updatePayload);
        if (updateError) {
          console.warn(`[SUPABASE] Notice updating user metadata for ${email}:`, updateError.message);
        } else {
          console.log(`[SUPABASE] User updated in Supabase Auth: ${email}`);
        }
        return updateData?.user || existing;
      }

      // 2. User does not exist in Supabase Auth yet: create new user
      const createPayload = {
        email,
        email_confirm: true,
        user_metadata: metadata,
      };
      if (rawPassword && rawPassword.length >= 6) {
        createPayload.password = rawPassword;
      } else {
        // Generate temporary secure hash placeholder password if plain password not available during bulk sync
        createPayload.password = `NestyAuth_${Math.random().toString(36).slice(2, 10)}!${Date.now()}`;
      }

      const { data: createData, error: createError } = await client.auth.admin.createUser(createPayload);
      if (createError) {
        console.warn(`[SUPABASE] Notice creating user in Supabase Auth for ${email}:`, createError.message);
        return null;
      }

      console.log(`[SUPABASE] Successfully registered user in Supabase Authentication: ${email}`);
      return createData?.user || null;
    }

    return null;
  } catch (err) {
    console.warn(`[SUPABASE] Non-fatal sync error for ${email}:`, err.message);
    return null;
  }
}

/**
 * Background synchronizer for all existing users in the local database.
 * Runs non-blockingly so server startup is instantaneous.
 */
export async function syncAllUsersToSupabase(users = []) {
  if (!isSupabaseConfigured() || !Array.isArray(users) || users.length === 0) {
    return;
  }
  console.log(`[SUPABASE] Syncing ${users.length} existing users to Supabase Authentication...`);
  for (const u of users) {
    try {
      await syncUserToSupabaseAuth(u, null);
    } catch {
      // Ignore individual sync errors
    }
  }
  console.log('[SUPABASE] Initial user sync to Supabase complete.');
}

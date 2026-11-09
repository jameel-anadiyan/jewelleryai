import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';
import { StudioJob, Variation } from '../types';

let supabaseClient: SupabaseClient | null = null;

export const DEFAULT_SUPABASE_URL = 'https://eylkbycxhptmmqcpvloz.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV5bGtieWN4aHB0bW1xY3B2bG96Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3NzU4OTUsImV4cCI6MjEwODM1MTg5NX0.2Bb-bYhxOi-GQFzpCmdpgeovleC6a0g6is_0AcImjyY';

export function getSupabaseClient(customAnonKey?: string): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const key =
    customAnonKey ||
    import.meta.env.VITE_SUPABASE_ANON_KEY ||
    localStorage.getItem('swa_supabase_anon_key') ||
    DEFAULT_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return supabaseClient;
}

export function setCustomSupabaseKey(key: string): void {
  if (key) {
    localStorage.setItem('swa_supabase_anon_key', key);
  } else {
    localStorage.removeItem('swa_supabase_anon_key');
  }
  supabaseClient = null; // reset client to re-initialize
}

/**
 * Initiates Google OAuth sign in using Supabase Auth.
 * Redirects the user to Google OAuth and returns to current origin.
 */
export async function signInWithGoogle(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: new Error('Supabase client is not configured') };
  }

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  return { error: error ? new Error(error.message) : null };
}

/**
 * Signs the current user out of Supabase.
 */
export async function signOutUser(): Promise<{ error: Error | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { error: new Error('Supabase client is not configured') };
  }
  const { error } = await client.auth.signOut();
  return { error: error ? new Error(error.message) : null };
}

/**
 * Retrieves the currently authenticated Supabase user.
 */
export async function getCurrentUser(): Promise<User | null> {
  const client = getSupabaseClient();
  if (!client) return null;
  try {
    const { data } = await client.auth.getUser();
    return data?.user || null;
  } catch (err) {
    console.warn('Failed to retrieve current user from Supabase:', err);
    return null;
  }
}

/**
 * Subscribes to Supabase Auth state changes (login, logout, token refresh).
 */
export function onAuthStateChange(
  callback: (user: User | null, session: Session | null) => void
) {
  const client = getSupabaseClient();
  if (!client) {
    return { data: { subscription: { unsubscribe: () => {} } } };
  }
  return client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null, session);
  });
}

/**
 * Saves or updates a single variation design and its generated image in Supabase jewellery_designs table.
 */
export async function saveDesignToSupabase(
  jobId: string,
  variation: Variation,
  user?: User | null
): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client not configured' };
  }

  try {
    const currentUser = user || (await getCurrentUser());
    const payload = {
      job_id: jobId,
      index: Number(variation.index) || 1,
      name: variation.name || `Design Concept ${variation.index || 1}`,
      description: variation.description || '',
      motif_treatment: variation.motifTreatment || '',
      stone_count: Number(variation.stoneCount) || 10,
      stone_layout: variation.stoneLayout || '',
      setting: variation.setting || '',
      size_mm: variation.sizeMm || '',
      gold_vs_original: variation.goldVsOriginal || '',
      image_prompt: variation.imagePrompt || '',
      image_base64: variation.imageBase64 || null,
      user_id: currentUser?.id || null,
      user_email: currentUser?.email || null,
      created_at: new Date().toISOString(),
    };

    // Upsert or insert by matching job_id and index
    const { error } = await client.from('jewellery_designs').insert(payload);

    if (error) {
      console.warn('Supabase design save warning:', error.message);
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Failed to save design to Supabase:', err);
    return { success: false, message: err?.message || 'Sync error' };
  }
}

/**
 * Syncs the entire studio run (metadata + all variations JSON) into Supabase jewellery_runs table.
 */
export async function syncRunToSupabase(
  job: StudioJob,
  user?: User | null
): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client not configured' };
  }

  try {
    const currentUser = user || (await getCurrentUser());
    const { error } = await client.from('jewellery_runs').upsert(
      {
        job_id: job.jobId,
        sku: job.sku || 'SWA',
        diamond_count: job.diamondCount,
        count_for: job.countFor,
        original_summary: job.original?.summary || '',
        photo_base64: job.photoBase64 || job.photoUrl || null,
        created_at: new Date(job.createdAt).toISOString(),
        variations_json: job.variations,
        user_id: currentUser?.id || null,
        user_email: currentUser?.email || null,
      },
      { onConflict: 'job_id' }
    );

    if (error) {
      console.warn('Supabase run sync warning:', error.message);
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Sync error' };
  }
}

/**
 * Fetches all past runs from Supabase jewellery_runs table.
 */
export async function fetchHistoryFromSupabase(): Promise<StudioJob[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  try {
    const { data, error } = await client
      .from('jewellery_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) {
      console.warn('Failed to load runs from Supabase:', error?.message);
      return [];
    }

    const jobIds = data.map((row: any) => row.job_id).filter(Boolean);
    const designsMap = new Map<string, Map<number, string>>();

    if (jobIds.length > 0) {
      try {
        const { data: designs } = await client
          .from('jewellery_designs')
          .select('job_id, index, image_base64')
          .in('job_id', jobIds)
          .not('image_base64', 'is', null);

        if (designs) {
          designs.forEach((d: any) => {
            if (!designsMap.has(d.job_id)) {
              designsMap.set(d.job_id, new Map());
            }
            designsMap.get(d.job_id)!.set(d.index, d.image_base64);
          });
        }
      } catch (e) {
        console.warn('Could not fetch linked designs:', e);
      }
    }

    return data.map((row: any) => {
      const jobDesigns = designsMap.get(row.job_id);
      const variations = (row.variations_json || []).map((v: any) => {
        const generatedImg = jobDesigns?.get(v.index) || v.imageBase64;
        return {
          ...v,
          imageBase64: generatedImg,
          status: generatedImg ? ('done' as const) : ('waiting' as const),
        };
      });

      return {
        jobId: row.job_id,
        photoUrl: row.photo_base64 || '',
        photoBase64: row.photo_base64 || '',
        sku: row.sku || 'SWA',
        diamondCount: row.diamond_count || 10,
        countFor: (row.count_for as any) || 'piece',
        stoneSize: '',
        metal: 'same',
        mustKeep: '',
        quality: 'medium',
        masterMm: row.master_mm || '',
        original: {
          productType: 'Jewellery',
          metal: 'Gold',
          motif: 'Fine Jewellery Motif',
          stoneCount: row.diamond_count || 10,
          stoneLayout: '',
          summary: row.original_summary || '',
        },
        variations,
        createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
      };
    });
  } catch (err) {
    console.error('Error fetching Supabase history:', err);
    return [];
  }
}

/**
 * Deletes a run and all its designs from Supabase.
 */
export async function deleteRunFromSupabase(
  jobId: string
): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) return { success: false, message: 'No client' };

  try {
    await client.from('jewellery_designs').delete().eq('job_id', jobId);
    const { error } = await client.from('jewellery_runs').delete().eq('job_id', jobId);
    if (error) {
      return { success: false, message: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || 'Delete error' };
  }
}

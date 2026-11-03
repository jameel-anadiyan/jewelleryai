import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
    supabaseClient = createClient(url, key);
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
 * Saves or updates a single variation design and its generated image in Supabase jewellery_designs table.
 */
export async function saveDesignToSupabase(
  jobId: string,
  variation: Variation
): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client not configured' };
  }

  try {
    const payload = {
      job_id: jobId,
      index: variation.index,
      name: variation.name,
      description: variation.description,
      motif_treatment: variation.motifTreatment || '',
      stone_count: variation.stoneCount,
      stone_layout: variation.stoneLayout,
      setting: variation.setting,
      size_mm: variation.sizeMm,
      gold_vs_original: variation.goldVsOriginal,
      image_prompt: variation.imagePrompt,
      image_base64: variation.imageBase64 || null,
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
  job: StudioJob
): Promise<{ success: boolean; message?: string }> {
  const client = getSupabaseClient();
  if (!client) {
    return { success: false, message: 'Supabase client not configured' };
  }

  try {
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

    return data.map((row: any) => ({
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
      original: {
        productType: 'Jewellery',
        metal: 'Gold',
        motif: 'Fine Jewellery Motif',
        stoneCount: row.diamond_count || 10,
        stoneLayout: '',
        summary: row.original_summary || '',
      },
      variations: (row.variations_json || []).map((v: any) => ({
        ...v,
        status: v.imageBase64 ? 'done' : 'waiting',
      })),
      createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    }));
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

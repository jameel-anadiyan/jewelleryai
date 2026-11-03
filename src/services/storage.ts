import { get, set, del } from 'idb-keyval';
import { StudioJob } from '../types';

const ACTIVE_JOB_KEY = 'swa_jewellery_active_job';
const HISTORY_KEY = 'swa_jewellery_history_runs';

export async function saveActiveJob(job: StudioJob): Promise<void> {
  try {
    await set(ACTIVE_JOB_KEY, job);
    await saveToHistory(job);
  } catch (err) {
    console.error('Failed to save active job to IndexedDB:', err);
  }
}

export async function loadActiveJob(): Promise<StudioJob | null> {
  try {
    const job = await get<StudioJob>(ACTIVE_JOB_KEY);
    return job || null;
  } catch (err) {
    console.error('Failed to load active job from IndexedDB:', err);
    return null;
  }
}

export async function clearActiveJob(): Promise<void> {
  try {
    await del(ACTIVE_JOB_KEY);
  } catch (err) {
    console.error('Failed to clear active job from IndexedDB:', err);
  }
}

export async function saveToHistory(job: StudioJob): Promise<void> {
  try {
    const current = (await get<StudioJob[]>(HISTORY_KEY)) || [];
    const index = current.findIndex((item) => item.jobId === job.jobId);
    if (index >= 0) {
      current[index] = job;
    } else {
      current.unshift(job);
    }
    // Keep up to 25 past runs
    await set(HISTORY_KEY, current.slice(0, 25));
  } catch (err) {
    console.error('Failed to save job to history:', err);
  }
}

export async function getHistory(): Promise<StudioJob[]> {
  try {
    const history = await get<StudioJob[]>(HISTORY_KEY);
    return history || [];
  } catch (err) {
    console.error('Failed to get history from IndexedDB:', err);
    return [];
  }
}

export async function deleteHistoryItem(jobId: string): Promise<void> {
  try {
    const current = (await get<StudioJob[]>(HISTORY_KEY)) || [];
    const filtered = current.filter((item) => item.jobId !== jobId);
    await set(HISTORY_KEY, filtered);
  } catch (err) {
    console.error('Failed to delete history item:', err);
  }
}

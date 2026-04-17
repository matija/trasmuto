import { useEffect } from 'react';
import { create } from 'zustand';
import { openPath } from '@tauri-apps/plugin-opener';
import type { ConversionJob } from '../lib/types';
import {
  cancelConversion,
  onConversionProgress,
  onConversionComplete,
  onConversionError,
  onJobStarted,
  probeFile,
  takePendingJobStarts,
} from '../lib/tauri-commands';
import { useSettingsStore } from './useConversionSettings';

interface JobQueueStore {
  jobs: ConversionJob[];
  upsert: (id: string, patch: Partial<ConversionJob>) => void;
  markCancelled: (id: string) => void;
  clearDone: () => void;
  removeJob: (id: string) => void;
}

const useJobQueueStore = create<JobQueueStore>((set) => ({
  jobs: [],

  upsert: (id, patch) =>
    set((state) => {
      const idx = state.jobs.findIndex((j) => j.id === id);
      if (idx >= 0) {
        const updated = [...state.jobs];
        updated[idx] = { ...updated[idx], ...patch };
        return { jobs: updated };
      }
      const newJob: ConversionJob = {
        id,
        inputPath: '',
        outputPath: null,
        status: 'running',
        outTimeMs: 0,
        durationMs: null,
        speed: null,
        error: null,
        ...patch,
      };
      return { jobs: [newJob, ...state.jobs] };
    }),

  markCancelled: (id) =>
    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === id ? { ...j, status: 'cancelled' } : j
      ),
    })),

  clearDone: () =>
    set((state) => ({
      jobs: state.jobs.filter(
        (j) => j.status === 'running' || j.status === 'pending'
      ),
    })),

  removeJob: (id) =>
    set((state) => ({ jobs: state.jobs.filter((j) => j.id !== id) })),
}));

export function useJobQueue() {
  const { jobs, upsert, markCancelled, clearDone, removeJob } = useJobQueueStore();

  useEffect(() => {
    const applyStart = (jobId: string, inputPath: string) => {
      upsert(jobId, { inputPath, status: 'running' });
      probeFile(inputPath)
        .then((info) => upsert(jobId, { durationMs: info.durationMs }))
        .catch(() => {});
    };

    const subs = Promise.all([
      onJobStarted(({ jobId, inputPath }) => applyStart(jobId, inputPath)),

      onConversionProgress(({ jobId, outTimeMs, speed, done }) => {
        upsert(jobId, { outTimeMs, speed, status: done ? 'done' : 'running' });
      }),

      onConversionComplete(({ jobId, outputPath }) => {
        upsert(jobId, { status: 'done', outputPath });
        const { settings } = useSettingsStore.getState();
        const { jobs } = useJobQueueStore.getState();
        const anyRunning = jobs.some((j) => j.id !== jobId && j.status === 'running');
        if (settings.openAfterConversion && outputPath && !anyRunning) {
          openPath(outputPath).catch(() => {});
        }
      }),

      onConversionError(({ jobId, error }) => {
        upsert(jobId, { status: 'failed', error });
      }),
    ]);

    // Drain any job-started events that fired before listeners were attached.
    // This catches the cold-launch dock-drop case, where macOS dispatches
    // `Opened` (and the Rust side starts the job) before React has mounted.
    // Duplicates are harmless: upsert dedupes by job id.
    subs.then(() => {
      takePendingJobStarts()
        .then((pending) => {
          for (const p of pending) applyStart(p.jobId, p.inputPath);
        })
        .catch(() => {});
    });

    return () => {
      subs.then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  const cancelJob = async (id: string) => {
    await cancelConversion(id).catch(() => {});
    markCancelled(id);
  };

  return { jobs, clearDone, cancelJob, removeJob };
}

import { useEffect } from 'react';
import { create } from 'zustand';
import type { ConversionJob } from '../lib/types';
import {
  onConversionProgress,
  onConversionComplete,
  onConversionError,
  onJobStarted,
  probeFile,
} from '../lib/tauri-commands';
import { cancelConversion } from '../lib/tauri-commands';

interface JobQueueStore {
  jobs: ConversionJob[];
  upsert: (id: string, patch: Partial<ConversionJob>) => void;
  markCancelled: (id: string) => void;
  clearDone: () => void;
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
}));

export function useJobQueue() {
  const { jobs, upsert, markCancelled, clearDone } = useJobQueueStore();

  useEffect(() => {
    const subs = Promise.all([
      onJobStarted(({ jobId, inputPath }) => {
        upsert(jobId, { inputPath, status: 'running' });
        probeFile(inputPath)
          .then((info) => upsert(jobId, { durationMs: info.durationMs }))
          .catch(() => {});
      }),

      onConversionProgress(({ jobId, outTimeMs, speed, done }) => {
        upsert(jobId, { outTimeMs, speed, status: done ? 'done' : 'running' });
      }),

      onConversionComplete(({ jobId, outputPath }) => {
        upsert(jobId, { status: 'done', outputPath });
      }),

      onConversionError(({ jobId, error }) => {
        upsert(jobId, { status: 'failed', error });
      }),
    ]);

    return () => {
      subs.then((fns) => fns.forEach((fn) => fn()));
    };
  }, []);

  const cancelJob = async (id: string) => {
    await cancelConversion(id).catch(() => {});
    markCancelled(id);
  };

  return { jobs, clearDone, cancelJob };
}

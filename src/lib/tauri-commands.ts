import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ConversionSettings, FileInfo } from './types';

// --- Commands ---

export const convertFile = (inputPath: string, settings: ConversionSettings): Promise<string> =>
  invoke('convert_file', { inputPath, settings });

export const cancelConversion = (jobId: string): Promise<void> =>
  invoke('cancel_conversion', { jobId });

export const probeFile = (path: string): Promise<FileInfo> =>
  invoke('probe_file', { path });

export const getSettings = (): Promise<ConversionSettings> =>
  invoke('get_settings');

export const saveSettings = (settings: ConversionSettings): Promise<void> =>
  invoke('save_settings', { settings });

export const takePendingJobStarts = (): Promise<JobStartedPayload[]> =>
  invoke('take_pending_job_starts');

export const trashFile = (path: string): Promise<void> =>
  invoke('trash_file', { path });

// --- Event payload types ---

export interface ProgressPayload {
  jobId: string;
  outTimeMs: number;
  speed: number;
  done: boolean;
}

export interface CompletePayload {
  jobId: string;
  outputPath: string;
}

export interface ErrorPayload {
  jobId: string;
  error: string;
}

export interface JobStartedPayload {
  jobId: string;
  inputPath: string;
}

// --- Event listeners ---

export const onConversionProgress = (cb: (p: ProgressPayload) => void): Promise<UnlistenFn> =>
  listen<ProgressPayload>('conversion-progress', (e) => cb(e.payload));

export const onConversionComplete = (cb: (p: CompletePayload) => void): Promise<UnlistenFn> =>
  listen<CompletePayload>('conversion-complete', (e) => cb(e.payload));

export const onConversionError = (cb: (p: ErrorPayload) => void): Promise<UnlistenFn> =>
  listen<ErrorPayload>('conversion-error', (e) => cb(e.payload));

export const onJobStarted = (cb: (p: JobStartedPayload) => void): Promise<UnlistenFn> =>
  listen<JobStartedPayload>('job-started', (e) => cb(e.payload));

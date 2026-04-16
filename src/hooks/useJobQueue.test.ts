import { renderHook, act } from '@testing-library/react';

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockResolvedValue([]),
}));

import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import { useJobQueue } from './useJobQueue';

type ListenHandler = (e: { payload: unknown }) => void;

function getListener(event: string): ListenHandler | undefined {
  return (vi.mocked(listen).mock.calls as [string, ListenHandler][])
    .find(([e]) => e === event)?.[1];
}

async function setupHook() {
  const result = renderHook(() => useJobQueue());
  await act(async () => {
    await Promise.resolve();
  });
  return result;
}

describe('useJobQueue', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listen).mockResolvedValue(vi.fn());
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it('updates outTimeMs, speed, and status on conversion-progress event', async () => {
    const { result } = await setupHook();
    const cb = getListener('conversion-progress');

    await act(async () => {
      cb?.({ payload: { jobId: 'prog-1', outTimeMs: 3000, speed: 2.0, done: false } });
    });

    const job = result.current.jobs.find((j) => j.id === 'prog-1');
    expect(job?.outTimeMs).toBe(3000);
    expect(job?.speed).toBe(2.0);
    expect(job?.status).toBe('running');
  });

  it('sets status to done and records outputPath on conversion-complete', async () => {
    const { result } = await setupHook();
    const cb = getListener('conversion-complete');

    await act(async () => {
      cb?.({ payload: { jobId: 'done-1', outputPath: '/out/video.mp4' } });
    });

    const job = result.current.jobs.find((j) => j.id === 'done-1');
    expect(job?.status).toBe('done');
    expect(job?.outputPath).toBe('/out/video.mp4');
  });

  it('sets status to failed and records error on conversion-error', async () => {
    const { result } = await setupHook();
    const cb = getListener('conversion-error');

    await act(async () => {
      cb?.({ payload: { jobId: 'err-1', error: 'ffmpeg exited with code 1' } });
    });

    const job = result.current.jobs.find((j) => j.id === 'err-1');
    expect(job?.status).toBe('failed');
    expect(job?.error).toBe('ffmpeg exited with code 1');
  });

  it('cancelJob calls cancelConversion and marks job as cancelled', async () => {
    const { result } = await setupHook();

    // Add a job first via the complete event
    const completeCb = getListener('conversion-complete');
    await act(async () => {
      completeCb?.({ payload: { jobId: 'cancel-1', outputPath: '/out/video.mp4' } });
    });

    vi.mocked(invoke).mockResolvedValueOnce(undefined);

    await act(async () => {
      await result.current.cancelJob('cancel-1');
    });

    expect(invoke).toHaveBeenCalledWith('cancel_conversion', { jobId: 'cancel-1' });
    const job = result.current.jobs.find((j) => j.id === 'cancel-1');
    expect(job?.status).toBe('cancelled');
  });
});

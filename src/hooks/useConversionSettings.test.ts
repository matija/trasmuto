import { renderHook, act } from '@testing-library/react';
import type { ConversionSettings } from '../lib/types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

import { invoke } from '@tauri-apps/api/core';
import { useConversionSettings } from './useConversionSettings';

const loadedSettings: ConversionSettings = {
  videoCodec: 'h265',
  crf: 28,
  preset: 'slow',
  maxResolution: 'fhd1080p',
  audioCodec: 'aac',
  audioBitrate: 192,
  ffmpegPath: null,
  openAfterConversion: false,
};

describe('useConversionSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(loadedSettings);
  });

  it('calls getSettings on mount and stores the result', async () => {
    const { result } = renderHook(() => useConversionSettings());

    await act(async () => {
      await Promise.resolve();
    });

    expect(invoke).toHaveBeenCalledWith('get_settings');
    expect(result.current.loaded).toBe(true);
    expect(result.current.settings.videoCodec).toBe('h265');
    expect(result.current.settings.crf).toBe(28);
  });

  it('calls saveSettings with updated value when update is called', async () => {
    const { result } = renderHook(() => useConversionSettings());

    await act(async () => {
      await Promise.resolve();
    });

    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.update({ crf: 30 });
    });

    expect(invoke).toHaveBeenCalledWith('save_settings', {
      settings: expect.objectContaining({ crf: 30 }),
    });
  });
});

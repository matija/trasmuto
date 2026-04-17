import type { ConversionSettings } from './types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

import { invoke } from '@tauri-apps/api/core';
import { convertFile, cancelConversion, getSettings, saveSettings } from './tauri-commands';

const defaultSettings: ConversionSettings = {
  videoCodec: 'h264',
  crf: 23,
  preset: 'medium',
  maxResolution: 'none',
  audioCodec: 'aac',
  audioBitrate: 128,
  ffmpegPath: null,
  openAfterConversion: false,
};

describe('tauri-commands', () => {
  beforeEach(() => vi.clearAllMocks());

  it('convertFile calls invoke("convert_file") with inputPath and settings', async () => {
    vi.mocked(invoke).mockResolvedValueOnce('job-1');
    await convertFile('/tmp/video.mkv', defaultSettings);
    expect(invoke).toHaveBeenCalledWith('convert_file', {
      inputPath: '/tmp/video.mkv',
      settings: defaultSettings,
    });
  });

  it('cancelConversion calls invoke("cancel_conversion") with jobId', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await cancelConversion('job-abc');
    expect(invoke).toHaveBeenCalledWith('cancel_conversion', { jobId: 'job-abc' });
  });

  it('getSettings calls invoke("get_settings")', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(defaultSettings);
    await getSettings();
    expect(invoke).toHaveBeenCalledWith('get_settings');
  });

  it('saveSettings calls invoke("save_settings") with settings', async () => {
    vi.mocked(invoke).mockResolvedValueOnce(undefined);
    await saveSettings(defaultSettings);
    expect(invoke).toHaveBeenCalledWith('save_settings', { settings: defaultSettings });
  });
});

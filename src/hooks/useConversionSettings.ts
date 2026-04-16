import { useEffect } from 'react';
import { create } from 'zustand';
import type { ConversionSettings } from '../lib/types';
import { getSettings, saveSettings } from '../lib/tauri-commands';

const DEFAULT_SETTINGS: ConversionSettings = {
  videoCodec: 'h264',
  crf: 23,
  preset: 'medium',
  maxResolution: 'none',
  audioCodec: 'aac',
  audioBitrate: 128,
  ffmpegPath: null,
};

interface SettingsStore {
  settings: ConversionSettings;
  loaded: boolean;
  _set: (s: ConversionSettings) => void;
  _setLoaded: (v: boolean) => void;
}

const useSettingsStore = create<SettingsStore>((set) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  _set: (settings) => set({ settings }),
  _setLoaded: (loaded) => set({ loaded }),
}));

export function useConversionSettings() {
  const { settings, loaded, _set, _setLoaded } = useSettingsStore();

  useEffect(() => {
    if (!loaded) {
      getSettings()
        .then((s) => {
          _set(s);
          _setLoaded(true);
        })
        .catch(() => {
          _setLoaded(true);
        });
    }
  }, [loaded]);

  const update = async (patch: Partial<ConversionSettings>) => {
    const next = { ...settings, ...patch };
    _set(next);
    await saveSettings(next);
  };

  return { settings, loaded, update };
}

import { render, screen } from '@testing-library/react';
import SettingsPanel from './SettingsPanel';
import type { ConversionSettings } from '../lib/types';

const defaultSettings: ConversionSettings = {
  videoCodec: 'h264',
  crf: 23,
  preset: 'medium',
  maxResolution: 'none',
  audioCodec: 'aac',
  audioBitrate: 128,
  ffmpegPath: null,
};

vi.mock('../hooks/useConversionSettings', () => ({
  useConversionSettings: () => ({
    settings: defaultSettings,
    loaded: true,
    update: vi.fn(),
  }),
}));

describe('SettingsPanel', () => {
  it('renders all six setting controls', () => {
    render(<SettingsPanel />);

    expect(screen.getByText('Video codec')).toBeInTheDocument();
    // CRF label includes the current value
    expect(screen.getByText(/Quality.*CRF/)).toBeInTheDocument();
    expect(screen.getByText('Encoding preset')).toBeInTheDocument();
    expect(screen.getByText('Max resolution')).toBeInTheDocument();
    expect(screen.getByText('Audio codec')).toBeInTheDocument();
    expect(screen.getByText('Audio bitrate')).toBeInTheDocument();
  });
});

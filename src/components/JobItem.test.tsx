import { render, screen } from '@testing-library/react';
import JobItem from './JobItem';
import type { ConversionJob } from '../lib/types';

vi.mock('@tauri-apps/plugin-opener', () => ({
  revealItemInDir: vi.fn(),
  openPath: vi.fn(),
}));

vi.mock('../lib/tauri-commands', () => ({
  trashFile: vi.fn(),
}));

const baseJob: ConversionJob = {
  id: 'test-job',
  inputPath: '/videos/sample.mkv',
  outputPath: null,
  status: 'running',
  outTimeMs: 2000,
  durationMs: 10000,
  speed: 1.8,
  error: null,
};

describe('JobItem', () => {
  it('renders filename, progress bar, speed, and cancel button for a running job', () => {
    render(<JobItem job={baseJob} onCancel={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText('sample.mkv')).toBeInTheDocument();
    expect(screen.getByText(/1\.8/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();

    // Progress bar: determinate since durationMs is set
    const progressBar = document.querySelector('[style*="width"]');
    expect(progressBar).not.toBeNull();
  });

  it('renders Play and Delete buttons for a done job', () => {
    const doneJob: ConversionJob = {
      ...baseJob,
      status: 'done',
      outputPath: '/videos/sample.mp4',
    };

    render(<JobItem job={doneJob} onCancel={vi.fn()} onRemove={vi.fn()} />);

    expect(screen.getByText('sample.mkv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });
});

import { revealItemInDir } from '@tauri-apps/plugin-opener';
import type { ConversionJob, JobStatus } from '../lib/types';

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

interface Props {
  job: ConversionJob;
  onCancel: (id: string) => void;
}

export default function JobItem({ job, onCancel }: Props) {
  const filename = job.inputPath ? basename(job.inputPath) : job.id;

  const pct =
    job.durationMs && job.durationMs > 0
      ? Math.min(100, (job.outTimeMs / job.durationMs) * 100)
      : null;

  const handleReveal = () => {
    if (job.outputPath) {
      revealItemInDir(job.outputPath).catch(() => {});
    }
  };

  return (
    <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-zinc-800 last:border-0">
      {/* Top row: filename + controls */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-100 truncate" title={job.inputPath}>
          {filename}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {job.status === 'running' && job.speed != null && (
            <span className="text-xs text-zinc-400 tabular-nums">
              {job.speed.toFixed(1)}&times;
            </span>
          )}
          <StatusBadge status={job.status} />
          {job.status === 'running' && (
            <button
              onClick={() => onCancel(job.id)}
              className="text-xs text-zinc-500 hover:text-zinc-200 transition-colors leading-none"
              title="Cancel"
            >
              ✕
            </button>
          )}
          {job.status === 'done' && job.outputPath && (
            <button
              onClick={handleReveal}
              className="text-xs text-sky-400 hover:text-sky-300 transition-colors"
            >
              Reveal
            </button>
          )}
        </div>
      </div>

      {/* Progress bar for running jobs */}
      {job.status === 'running' && <ProgressBar pct={pct} />}

      {/* Error message */}
      {job.status === 'failed' && job.error && (
        <span className="text-xs text-red-400 truncate" title={job.error}>
          {job.error}
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const styles: Record<JobStatus, string> = {
    pending: 'bg-zinc-700 text-zinc-300',
    running: 'bg-sky-950 text-sky-300',
    done: 'bg-emerald-950 text-emerald-300',
    failed: 'bg-red-950 text-red-300',
    cancelled: 'bg-zinc-800 text-zinc-500',
  };
  const labels: Record<JobStatus, string> = {
    pending: 'Pending',
    running: 'Converting',
    done: 'Done',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function ProgressBar({ pct }: { pct: number | null }) {
  if (pct !== null) {
    return (
      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-sky-500 rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }

  // Indeterminate — animated shimmer
  return (
    <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
      <div className="h-full animate-progress-indeterminate bg-sky-500 rounded-full" />
    </div>
  );
}

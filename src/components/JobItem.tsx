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
    <div className="flex flex-col gap-1.5 px-3 py-2.5 mx-1 rounded-lg hover:bg-[color:var(--surface)] transition-colors">
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[13px] font-medium text-[color:var(--fg)] truncate"
          title={job.inputPath}
        >
          {filename}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {job.status === 'running' && job.speed != null && (
            <span className="text-[11px] text-[color:var(--fg-muted)] tabular-nums">
              {job.speed.toFixed(1)}&times;
            </span>
          )}
          <StatusBadge status={job.status} />
          {job.status === 'running' && (
            <button
              onClick={() => onCancel(job.id)}
              className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition-colors leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-[color:var(--surface-strong)]"
              title="Cancel"
              aria-label="Cancel"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
          {job.status === 'done' && job.outputPath && (
            <button
              onClick={handleReveal}
              className="text-[11px] text-[color:var(--accent)] hover:underline transition-colors"
            >
              Reveal
            </button>
          )}
        </div>
      </div>

      {job.status === 'running' && <ProgressBar pct={pct} />}

      {job.status === 'failed' && job.error && (
        <span className="text-[11px] text-[color:var(--danger)] truncate" title={job.error}>
          {job.error}
        </span>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const base =
    'text-[10px] px-1.5 py-0.5 rounded-md font-medium uppercase tracking-wide';
  const styles: Record<JobStatus, string> = {
    pending:
      'bg-[color:var(--surface-strong)] text-[color:var(--fg-muted)]',
    running:
      'bg-[color:var(--accent-bg)] text-[color:var(--accent)]',
    done:
      'bg-[color:var(--success-bg)] text-[color:var(--success)]',
    failed:
      'bg-[color:var(--danger-bg)] text-[color:var(--danger)]',
    cancelled:
      'bg-[color:var(--surface-strong)] text-[color:var(--fg-faint)]',
  };
  const labels: Record<JobStatus, string> = {
    pending: 'Pending',
    running: 'Converting',
    done: 'Done',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return <span className={`${base} ${styles[status]}`}>{labels[status]}</span>;
}

function ProgressBar({ pct }: { pct: number | null }) {
  if (pct !== null) {
    return (
      <div className="h-1 bg-[color:var(--progress-track)] rounded-full overflow-hidden">
        <div
          className="h-full bg-[color:var(--accent)] rounded-full transition-[width] duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    );
  }

  return (
    <div className="h-1 bg-[color:var(--progress-track)] rounded-full overflow-hidden">
      <div className="h-full animate-progress-indeterminate bg-[color:var(--accent)] rounded-full" />
    </div>
  );
}

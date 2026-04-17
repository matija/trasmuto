import { useState, useRef } from 'react';
import { openPath } from '@tauri-apps/plugin-opener';
import type { ConversionJob, JobStatus } from '../lib/types';
import { trashFile } from '../lib/tauri-commands';

function basename(path: string): string {
  return path.split('/').pop() ?? path;
}

interface Props {
  job: ConversionJob;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
}

export default function JobItem({ job, onCancel, onRemove }: Props) {
  const filename = job.inputPath ? basename(job.inputPath) : job.id;
  const [deleteState, setDeleteState] = useState<'idle' | 'confirming'>('idle');
  const [fileError, setFileError] = useState(false);
  const [removing, setRemoving] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pct =
    job.durationMs && job.durationMs > 0
      ? Math.min(100, (job.outTimeMs / job.durationMs) * 100)
      : null;

  const showFileError = () => {
    setFileError(true);
    setTimeout(() => setFileError(false), 2000);
  };

  const handlePlay = async () => {
    if (!job.outputPath) return;
    try {
      await openPath(job.outputPath);
    } catch {
      showFileError();
    }
  };

  const handleDelete = async () => {
    if (!job.outputPath) return;
    if (deleteState === 'idle') {
      setDeleteState('confirming');
      confirmTimer.current = setTimeout(() => setDeleteState('idle'), 300);
    } else {
      if (confirmTimer.current) clearTimeout(confirmTimer.current);
      try {
        await trashFile(job.outputPath);
        setRemoving(true);
        setTimeout(() => onRemove(job.id), 200);
      } catch {
        showFileError();
        setDeleteState('idle');
      }
    }
  };

  return (
    <div
      className={`flex flex-col gap-1.5 px-2 py-2.5 rounded-lg hover:bg-[color:var(--surface)] transition-colors animate-job-enter ${removing ? 'animate-job-remove' : ''}`}
    >
      {/* Filename row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {/* Film-strip icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            className="shrink-0 text-[color:var(--fg-muted)]"
          >
            <rect x="1" y="2.5" width="14" height="11" rx="1.5" />
            <line x1="4.5" y1="2.5" x2="4.5" y2="13.5" />
            <line x1="11.5" y1="2.5" x2="11.5" y2="13.5" />
            <line x1="1" y1="5.5" x2="4.5" y2="5.5" />
            <line x1="11.5" y1="5.5" x2="15" y2="5.5" />
            <line x1="1" y1="8" x2="4.5" y2="8" />
            <line x1="11.5" y1="8" x2="15" y2="8" />
            <line x1="1" y1="10.5" x2="4.5" y2="10.5" />
            <line x1="11.5" y1="10.5" x2="15" y2="10.5" />
          </svg>

          {/* Checkmark — only for done jobs, left of filename */}
          {job.status === 'done' && (
            <svg
              width="11"
              height="11"
              viewBox="0 0 12 12"
              fill="none"
              className="shrink-0 text-[color:var(--success)]"
            >
              <path
                d="M2 6l3 3 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}

          <span
            className={`text-[14px] font-medium truncate ${job.status === 'done' ? 'text-[color:var(--fg-muted)]' : 'text-[color:var(--fg)]'}`}
            title={job.inputPath}
          >
            {filename}
          </span>
        </div>

        {/* Right side: speed + cancel (running) or status badge (non-done non-running) */}
        <div className="flex items-center gap-2 shrink-0">
          {job.status === 'running' && job.speed != null && (
            <span className="text-[11px] text-[color:var(--fg-muted)] tabular-nums">
              {job.speed.toFixed(1)}&times;
            </span>
          )}
          {job.status !== 'done' && <StatusBadge status={job.status} />}
          {job.status === 'running' && (
            <button
              onClick={() => onCancel(job.id)}
              className="text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition-colors leading-none w-4 h-4 flex items-center justify-center rounded hover:bg-[color:var(--surface-strong)]"
              title="Cancel"
              aria-label="Cancel"
            >
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path
                  d="M1 1l8 8M9 1l-8 8"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Progress bar (running) or hairline rule (done) */}
      {job.status === 'running' && <ProgressBar pct={pct} />}
      {job.status === 'done' && (
        <div className="h-px bg-[color:var(--divider)]" />
      )}

      {/* Error message for failed jobs */}
      {job.status === 'failed' && job.error && (
        <span className="text-[11px] text-[color:var(--danger)] truncate" title={job.error}>
          {job.error}
        </span>
      )}

      {/* Completion action row (done jobs only) */}
      {job.status === 'done' && (
        <div className="flex items-center gap-1.5 animate-action-row-in">
          {fileError ? (
            <span className="text-[11px] text-[color:var(--fg-muted)]">File not found</span>
          ) : (
            <>
              <button
                onClick={handlePlay}
                className="h-5 px-2.5 rounded-full text-[12px] font-medium bg-[color:var(--bg-raised)] text-[color:var(--fg)] hover:bg-[color:var(--surface-strong)] transition-colors"
              >
                Play
              </button>
              <button
                onClick={handleDelete}
                className="h-5 px-2.5 rounded-full text-[12px] font-medium transition-colors"
                style={{ color: `rgba(255, 69, 58, ${deleteState === 'confirming' ? 1 : 0.75})` }}
              >
                {deleteState === 'confirming' ? 'Sure?' : 'Delete'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: JobStatus }) {
  const base = 'text-[10px] px-1.5 py-0.5 rounded-md font-medium';
  const styles: Record<JobStatus, string> = {
    pending: 'bg-[color:var(--surface-strong)] text-[color:var(--fg-muted)]',
    running: 'bg-[color:var(--accent-bg)] text-[color:var(--accent)]',
    done: '',
    failed: 'bg-[color:var(--danger-bg)] text-[color:var(--danger)]',
    cancelled: 'bg-[color:var(--surface-strong)] text-[color:var(--fg-faint)]',
  };
  const labels: Record<JobStatus, string> = {
    pending: 'Pending',
    running: 'Converting',
    done: '',
    failed: 'Failed',
    cancelled: 'Cancelled',
  };
  return <span className={`${base} ${styles[status]}`}>{labels[status]}</span>;
}

function ProgressBar({ pct }: { pct: number | null }) {
  if (pct !== null) {
    return (
      <div className="h-[3px] bg-[color:var(--progress-track)] rounded-full overflow-hidden">
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

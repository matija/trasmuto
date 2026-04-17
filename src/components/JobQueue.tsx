import { useJobQueue } from '../hooks/useJobQueue';
import JobItem from './JobItem';

export default function JobQueue() {
  const { jobs, clearDone, cancelJob } = useJobQueue();

  const hasDone = jobs.some(
    (j) => j.status === 'done' || j.status === 'failed' || j.status === 'cancelled'
  );

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1.5 px-6 text-center">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[color:var(--fg-muted)]"
          style={{ opacity: 0.4 }}
        >
          <rect x="3" y="5" width="18" height="14" rx="2.5" />
          <polygon points="10,9 16,12 10,15" fill="currentColor" stroke="none" />
        </svg>
        <div className="flex flex-col gap-1.5">
          <p className="text-[13px] font-medium text-[color:var(--fg)]">Drop a video to convert.</p>
          <p className="text-[11px] text-[color:var(--fg-muted)] leading-snug">
            Or drag onto the dock icon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-3">
        {jobs.map((job) => (
          <JobItem key={job.id} job={job} onCancel={cancelJob} />
        ))}
      </div>
      {hasDone && (
        <div className="border-t border-[color:var(--divider)] px-4 py-2 shrink-0">
          <button
            onClick={clearDone}
            className="text-xs text-[color:var(--fg-muted)] hover:text-[color:var(--fg)] transition-colors"
          >
            Clear completed
          </button>
        </div>
      )}
    </div>
  );
}

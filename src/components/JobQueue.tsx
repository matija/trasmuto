import { useJobQueue } from '../hooks/useJobQueue';
import JobItem from './JobItem';

export default function JobQueue() {
  const { jobs, clearDone, cancelJob } = useJobQueue();

  const hasDone = jobs.some(
    (j) => j.status === 'done' || j.status === 'failed' || j.status === 'cancelled'
  );

  if (jobs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="2" y="2" width="20" height="20" rx="2.5" />
          <polygon points="10,8 16,12 10,16" />
        </svg>
        <p className="text-sm">Drop a video on the dock icon to convert it</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        {jobs.map((job) => (
          <JobItem key={job.id} job={job} onCancel={cancelJob} />
        ))}
      </div>
      {hasDone && (
        <div className="border-t border-zinc-800 px-4 py-2 shrink-0">
          <button
            onClick={clearDone}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear completed
          </button>
        </div>
      )}
    </div>
  );
}

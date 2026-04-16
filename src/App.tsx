import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import JobQueue from './components/JobQueue';
import SettingsPanel from './components/SettingsPanel';

type Tab = 'queue' | 'settings';

export default function App() {
  const [tab, setTab] = useState<Tab>('queue');

  // Switch to queue tab when files arrive via dock drop
  useEffect(() => {
    const unlisten = listen('file-opened', () => setTab('queue'));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 select-none overflow-hidden">
      {/* Title bar — extends under macOS traffic lights (~76px from left) */}
      <div className="drag flex items-center h-8 shrink-0 border-b border-zinc-800/60">
        <div className="no-drag ml-[76px] flex">
          <TabButton active={tab === 'queue'} onClick={() => setTab('queue')}>
            Queue
          </TabButton>
          <TabButton active={tab === 'settings'} onClick={() => setTab('settings')}>
            Settings
          </TabButton>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        {tab === 'queue' ? <JobQueue /> : <SettingsPanel />}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'px-3 h-8 text-xs font-medium transition-colors',
        active
          ? 'text-zinc-100 border-b-2 border-sky-500'
          : 'text-zinc-500 hover:text-zinc-300',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

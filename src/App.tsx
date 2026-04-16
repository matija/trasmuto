import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import JobQueue from './components/JobQueue';
import SettingsPanel from './components/SettingsPanel';
import { convertFile } from './lib/tauri-commands';
import { useConversionSettings } from './hooks/useConversionSettings';

type Tab = 'queue' | 'settings';

const SUPPORTED_EXTENSIONS = [
  'mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v', 'flv', 'wmv', 'ts', 'mts', 'm2ts',
];

function isSupportedVideo(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return SUPPORTED_EXTENSIONS.includes(ext);
}

export default function App() {
  const [tab, setTab] = useState<Tab>('queue');
  const [dragOver, setDragOver] = useState(false);
  const { settings, loaded } = useConversionSettings();

  // Switch to queue tab when files arrive via dock drop.
  useEffect(() => {
    const unlisten = listen('file-opened', () => setTab('queue'));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Window drag-and-drop: hover overlay + dispatch conversions.
  //
  // NOTE: cleanup awaits the registration promise via `.then` so that the
  // listener is always detached even if the effect is torn down before the
  // promise resolves (React StrictMode double-mount).  Without this, the
  // first mount's listener leaks and every drop runs `convert_file` twice.
  useEffect(() => {
    if (!loaded) return;

    const reg = getCurrentWebview().onDragDropEvent((event) => {
      const p = event.payload;
      if (p.type === 'enter' || p.type === 'over') {
        if (p.type === 'enter') {
          const hasVideo = p.paths.some(isSupportedVideo);
          setDragOver(hasVideo);
        }
      } else if (p.type === 'leave') {
        setDragOver(false);
      } else if (p.type === 'drop') {
        setDragOver(false);
        setTab('queue');
        const videos = p.paths.filter(isSupportedVideo);
        for (const path of videos) {
          convertFile(path, settings).catch(() => {});
        }
      }
    });

    return () => {
      reg.then((fn) => fn()).catch(() => {});
    };
  }, [loaded, settings]);

  return (
    <div className="relative flex flex-col h-screen text-[color:var(--fg)] select-none overflow-hidden">
      {/* Draggable title bar — traffic-light area + tab switcher */}
      <div className="drag flex items-center justify-center h-11 shrink-0 relative">
        <div className="no-drag">
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: 'queue', label: 'Queue' },
              { value: 'settings', label: 'Settings' },
            ]}
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        {tab === 'queue' ? <JobQueue /> : <SettingsPanel />}
      </div>

      {/* Drag-drop overlay */}
      {dragOver && <DropOverlay />}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex items-center p-[2px] rounded-md bg-[color:var(--segmented-bg)] text-[13px] leading-none">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={[
            'px-3 py-1 rounded-[5px] transition-colors font-medium',
            value === o.value
              ? 'bg-[color:var(--segmented-active-bg)] text-[color:var(--fg)] shadow-[0_0_0_0.5px_var(--segmented-active-border),0_1px_1px_rgba(0,0,0,0.08)]'
              : 'text-[color:var(--fg-muted)] hover:text-[color:var(--fg)]',
          ].join(' ')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center p-3">
      <div className="w-full h-full rounded-[10px] border-2 border-dashed border-[color:var(--accent)] bg-[color:var(--accent-bg)] flex flex-col items-center justify-center gap-2">
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-[color:var(--accent)]"
        >
          <path d="M12 3v12" />
          <path d="m7 8 5-5 5 5" />
          <path d="M5 21h14" />
        </svg>
        <p className="text-sm font-medium text-[color:var(--fg)]">Drop to convert</p>
      </div>
    </div>
  );
}

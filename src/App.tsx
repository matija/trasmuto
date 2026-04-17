import { useState, useEffect, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
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
  const [dragActive, setDragActive] = useState(false);
  const [dragExiting, setDragExiting] = useState(false);
  const [dragCount, setDragCount] = useState(0);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

    const startExit = () => {
      setDragActive(false);
      setDragExiting(true);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      exitTimerRef.current = setTimeout(() => setDragExiting(false), 80);
    };

    const reg = getCurrentWebview().onDragDropEvent((event) => {
      const p = event.payload;
      if (p.type === 'enter') {
        if (exitTimerRef.current) { clearTimeout(exitTimerRef.current); exitTimerRef.current = null; }
        setDragExiting(false);
        const count = p.paths.filter(isSupportedVideo).length;
        if (count > 0) { setDragCount(count); setDragActive(true); }
      } else if (p.type === 'leave') {
        startExit();
      } else if (p.type === 'drop') {
        startExit();
        setTab('queue');
        const videos = p.paths.filter(isSupportedVideo);
        for (const path of videos) {
          convertFile(path, settings).catch(() => {});
        }
      }
    });

    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      reg.then((fn) => fn()).catch(() => {});
    };
  }, [loaded, settings]);

  return (
    <div className="relative flex flex-col h-screen text-[color:var(--fg)] select-none overflow-hidden">
      {/* Draggable title bar.

          We use an explicit `onMouseDown` → `startDragging()` handler rather
          than the CSS `-webkit-app-region: drag` property or even Tauri's
          `data-tauri-drag-region` attribute, both of which are unreliable on
          macOS transparent windows in Tauri v2.

          The handler only fires when the mousedown target is the title-bar
          div itself (i.e. empty space around the Segmented control). Clicks
          on the Segmented wrapper or its buttons are ignored because those
          elements are the event target, not the title bar. Double-click is
          forwarded to `toggleMaximize()` to match native titlebar behavior. */}
      <div
        onMouseDown={(e) => {
          if (e.button !== 0) return;
          if (e.target !== e.currentTarget) return;
          if (e.detail === 2) {
            void getCurrentWindow().toggleMaximize();
          } else {
            void getCurrentWindow().startDragging();
          }
        }}
        className="flex items-center justify-center h-10 shrink-0 relative border-b border-[color:var(--divider)]"
      >
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'queue', label: 'Queue' },
            { value: 'settings', label: 'Settings' },
          ]}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        {tab === 'queue' ? <JobQueue /> : <SettingsPanel />}
      </div>

      {/* Drag-drop overlay */}
      {(dragActive || dragExiting) && <DropOverlay count={dragCount} exiting={dragExiting} />}
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
    <div className="inline-flex items-center p-[2px] rounded-full bg-[color:var(--segmented-bg)] text-[13px] leading-none">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={[
            'px-3 py-1 rounded-full transition-colors font-medium',
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

function DropOverlay({ count, exiting }: { count: number; exiting: boolean }) {
  const label = count > 1 ? `Drop ${count} videos to convert` : 'Drop to convert';
  return (
    <div
      className={`pointer-events-none absolute inset-0 z-50 flex items-center justify-center p-3 ${exiting ? 'animate-overlay-out' : 'animate-overlay-in'}`}
    >
      <div className="w-full h-full rounded-[10px] border-2 border-[color:var(--accent)] bg-[color:var(--accent-bg)] flex flex-col items-center justify-center gap-2 animate-drop-pulse">
        {/* Film-strip icon */}
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
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="7" y1="4" x2="7" y2="20" />
          <line x1="17" y1="4" x2="17" y2="20" />
          <line x1="2" y1="8" x2="7" y2="8" />
          <line x1="17" y1="8" x2="22" y2="8" />
          <line x1="2" y1="12" x2="7" y2="12" />
          <line x1="17" y1="12" x2="22" y2="12" />
          <line x1="2" y1="16" x2="7" y2="16" />
          <line x1="17" y1="16" x2="22" y2="16" />
        </svg>
        <p className="text-sm font-medium text-[color:var(--fg)]">{label}</p>
      </div>
    </div>
  );
}

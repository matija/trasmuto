import { type ReactNode, useState, useRef, useEffect } from 'react';
import { useConversionSettings } from '../hooks/useConversionSettings';
import type { ConversionSettings } from '../lib/types';

export default function SettingsPanel() {
  const { settings, loaded, update } = useConversionSettings();

  if (!loaded) {
    return (
      <div className="flex items-center justify-center h-full text-[color:var(--fg-muted)] text-sm">
        Loading…
      </div>
    );
  }

  const isSoftwareCodec =
    settings.videoCodec === 'h264' || settings.videoCodec === 'h265';

  return (
    <div className="h-full flex flex-col">
      <div className="settings-scroll overflow-y-auto flex-1 px-4 py-4 flex flex-col gap-5">
        <SettingsGroup label="OUTPUT">
          <SettingRow label="Video codec">
            <CustomSelect
              value={settings.videoCodec}
              onChange={(v) =>
                update({ videoCodec: v as ConversionSettings['videoCodec'] })
              }
              options={[
                { value: 'h264', label: 'H.264 (libx264)' },
                { value: 'h264Hw', label: 'H.264 Hardware' },
                { value: 'h265', label: 'H.265 (libx265)' },
                { value: 'h265Hw', label: 'H.265 Hardware' },
                { value: 'copy', label: 'Copy (passthrough)' },
              ]}
            />
          </SettingRow>

          {isSoftwareCodec && (
            <SettingRow
              label={`Quality — CRF ${settings.crf}`}
              description="Lower = higher quality / larger file"
              wide
            >
              <input
                type="range"
                min={18}
                max={51}
                value={settings.crf}
                onChange={(e) => update({ crf: Number(e.target.value) })}
                className="w-full mt-0.5"
                style={{ accentColor: 'var(--accent)' }}
              />
              <div className="flex justify-between text-[11px] text-[color:var(--fg-faint)] mt-0.5">
                <span>18 (best)</span>
                <span>51 (smallest)</span>
              </div>
            </SettingRow>
          )}

          {isSoftwareCodec && (
            <SettingRow
              label="Encoding preset"
              description="Faster = larger file; slower = smaller file"
            >
              <CustomSelect
                value={settings.preset}
                onChange={(v) =>
                  update({ preset: v as ConversionSettings['preset'] })
                }
                options={[
                  { value: 'ultrafast', label: 'Ultrafast' },
                  { value: 'fast', label: 'Fast' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'slow', label: 'Slow' },
                  { value: 'veryslow', label: 'Very slow' },
                ]}
              />
            </SettingRow>
          )}

          <SettingRow label="Max resolution">
            <CustomSelect
              value={settings.maxResolution}
              onChange={(v) =>
                update({
                  maxResolution: v as ConversionSettings['maxResolution'],
                })
              }
              options={[
                { value: 'none', label: 'Keep original' },
                { value: 'uhd4k', label: '4K (3840px)' },
                { value: 'fhd1080p', label: '1080p (1920px)' },
                { value: 'hd720p', label: '720p (1280px)' },
                { value: 'sd480p', label: '480p (854px)' },
              ]}
            />
          </SettingRow>

          <SettingRow label="Audio codec">
            <CustomSelect
              value={settings.audioCodec}
              onChange={(v) =>
                update({ audioCodec: v as ConversionSettings['audioCodec'] })
              }
              options={[
                { value: 'aac', label: 'AAC' },
                { value: 'copy', label: 'Copy' },
                { value: 'none', label: 'None (strip audio)' },
              ]}
            />
          </SettingRow>

          {settings.audioCodec === 'aac' && (
            <SettingRow label="Audio bitrate">
              <CustomSelect
                value={String(settings.audioBitrate)}
                onChange={(v) => update({ audioBitrate: Number(v) })}
                options={[
                  { value: '64', label: '64 kbps' },
                  { value: '96', label: '96 kbps' },
                  { value: '128', label: '128 kbps' },
                  { value: '192', label: '192 kbps' },
                  { value: '256', label: '256 kbps' },
                ]}
              />
            </SettingRow>
          )}
        </SettingsGroup>

        <SettingsGroup label="BEHAVIOR">
          <SettingRow
            label="Open file when done"
            description="Automatically open output file on completion"
          >
            <Toggle
              checked={settings.openAfterConversion}
              onChange={(v) => update({ openAfterConversion: v })}
            />
          </SettingRow>

          <SettingRow
            label="ffmpeg path"
            description="Leave empty to auto-detect"
            wide
          >
            <input
              type="text"
              value={settings.ffmpegPath ?? ''}
              onChange={(e) =>
                update({ ffmpegPath: e.target.value || null })
              }
              placeholder="/opt/homebrew/bin/ffmpeg"
              className="w-full bg-[color:var(--control-bg)] border border-[color:var(--control-border)] rounded-md px-2 text-[13px] text-[color:var(--fg)] placeholder-[color:var(--fg-faint)] focus:outline-none focus:border-[color:var(--accent)] transition-colors"
              style={{ height: '22px' }}
            />
          </SettingRow>
        </SettingsGroup>
      </div>
    </div>
  );
}

function SettingsGroup({
  label,
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div>
      {label && (
        <div className="text-[10px] font-medium text-[color:var(--fg-muted)] tracking-widest uppercase px-1 mb-1.5">
          {label}
        </div>
      )}
      <div className="rounded-xl bg-[color:var(--bg-raised)] settings-group">
        {children}
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  wide,
  children,
}: {
  label: string;
  description?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  if (wide) {
    return (
      <div className="settings-row px-4 py-2.5 flex flex-col gap-1.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-medium text-[color:var(--fg)]">
            {label}
          </span>
          {description && (
            <span className="text-[11px] text-[color:var(--fg-muted)]">
              {description}
            </span>
          )}
        </div>
        {children}
      </div>
    );
  }

  return (
    <div className="settings-row px-4 py-2.5 flex items-center gap-3">
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <span className="text-[13px] font-medium text-[color:var(--fg)]">
          {label}
        </span>
        {description && (
          <span className="text-[11px] text-[color:var(--fg-muted)]">
            {description}
          </span>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex shrink-0 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent)]"
      style={{
        width: '28px',
        height: '17px',
        backgroundColor: checked ? 'var(--accent)' : 'var(--control-border)',
        transition: 'background-color 150ms',
      }}
    >
      <span
        className="inline-block rounded-full bg-white"
        style={{
          width: '13px',
          height: '13px',
          marginTop: '2px',
          marginLeft: '2px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
          transform: checked ? 'translateX(11px)' : 'translateX(0)',
          transition: 'transform 150ms',
        }}
      />
    </button>
  );
}

function CustomSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 bg-[color:var(--control-bg)] border border-[color:var(--control-border)] rounded-md text-[13px] text-[color:var(--fg)] focus:outline-none focus:border-[color:var(--accent)] transition-colors whitespace-nowrap cursor-pointer"
        style={{ height: '22px' }}
      >
        <span>{selected?.label}</span>
        <svg
          width="8"
          height="5"
          viewBox="0 0 8 5"
          fill="none"
          className="shrink-0 text-[color:var(--fg-muted)]"
        >
          <path
            d="M1 1l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 min-w-[150px] rounded-lg border border-[color:var(--divider)] z-50 overflow-hidden py-1"
          style={{
            backgroundColor: 'var(--bg-raised)',
            boxShadow:
              '0 4px 16px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="w-full text-left px-3 text-[13px] transition-colors hover:bg-[color:var(--surface)]"
              style={{
                paddingTop: '6px',
                paddingBottom: '6px',
                color:
                  o.value === value ? 'var(--accent)' : 'var(--fg)',
                fontWeight: o.value === value ? 500 : 400,
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

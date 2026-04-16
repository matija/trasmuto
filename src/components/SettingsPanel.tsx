import type { ReactNode } from 'react';
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
    <div className="overflow-y-auto h-full px-5 py-4 flex flex-col gap-4">
      <SettingRow label="Video codec">
        <Select
          value={settings.videoCodec}
          onChange={(v) =>
            update({ videoCodec: v as ConversionSettings['videoCodec'] })
          }
          options={[
            { value: 'h264', label: 'H.264 (libx264)' },
            { value: 'h264Hw', label: 'H.264 Hardware (VideoToolbox)' },
            { value: 'h265', label: 'H.265 (libx265)' },
            { value: 'h265Hw', label: 'H.265 Hardware (hevc_videotoolbox)' },
            { value: 'copy', label: 'Copy (passthrough)' },
          ]}
        />
      </SettingRow>

      {isSoftwareCodec && (
        <SettingRow
          label={`Quality — CRF ${settings.crf}`}
          hint="Lower = higher quality / larger file"
        >
          <input
            type="range"
            min={18}
            max={51}
            value={settings.crf}
            onChange={(e) => update({ crf: Number(e.target.value) })}
            className="w-full"
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
          hint="Faster = larger file; slower = smaller file"
        >
          <Select
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
        <Select
          value={settings.maxResolution}
          onChange={(v) =>
            update({ maxResolution: v as ConversionSettings['maxResolution'] })
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
        <Select
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
          <Select
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

      <SettingRow label="ffmpeg path" hint="Leave empty to auto-detect">
        <input
          type="text"
          value={settings.ffmpegPath ?? ''}
          onChange={(e) => update({ ffmpegPath: e.target.value || null })}
          placeholder="/opt/homebrew/bin/ffmpeg"
          className="w-full bg-[color:var(--control-bg)] border border-[color:var(--control-border)] rounded-md px-2.5 py-1.5 text-[13px] text-[color:var(--fg)] placeholder-[color:var(--fg-faint)] focus:outline-none focus:border-[color:var(--accent)] transition-colors"
        />
      </SettingRow>
    </div>
  );
}

function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-[13px] font-medium text-[color:var(--fg)]">{label}</span>
        {hint && <span className="text-[11px] text-[color:var(--fg-muted)]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full bg-[color:var(--control-bg)] border border-[color:var(--control-border)] rounded-md px-2.5 py-1.5 text-[13px] text-[color:var(--fg)] focus:outline-none focus:border-[color:var(--accent)] transition-colors appearance-none cursor-pointer bg-no-repeat bg-right pr-7"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path d='M1 1l4 4 4-4' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
        backgroundPosition: 'right 0.6rem center',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

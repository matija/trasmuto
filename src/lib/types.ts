export type VideoCodec = 'h264' | 'h264Hw' | 'h265' | 'h265Hw' | 'copy';
export type AudioCodec = 'aac' | 'copy' | 'none';
export type EncodingPreset = 'ultrafast' | 'fast' | 'medium' | 'slow' | 'veryslow';
export type MaxResolution = 'none' | 'uhd4k' | 'fhd1080p' | 'hd720p' | 'sd480p';
export type JobStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled';

export interface ConversionSettings {
  videoCodec: VideoCodec;
  crf: number;
  preset: EncodingPreset;
  maxResolution: MaxResolution;
  audioCodec: AudioCodec;
  audioBitrate: number;
  ffmpegPath: string | null;
}

export interface ConversionJob {
  id: string;
  inputPath: string;
  outputPath: string | null;
  status: JobStatus;
  outTimeMs: number;
  durationMs: number | null;
  speed: number | null;
  error: string | null;
}

export interface FileInfo {
  path: string;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
}

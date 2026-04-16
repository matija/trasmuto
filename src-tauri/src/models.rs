use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConversionSettings {
    pub video_codec: VideoCodec,
    pub crf: u8,
    pub preset: EncodingPreset,
    pub max_resolution: MaxResolution,
    pub audio_codec: AudioCodec,
    pub audio_bitrate: u32,
    pub ffmpeg_path: Option<String>,
}

impl Default for ConversionSettings {
    fn default() -> Self {
        Self {
            video_codec: VideoCodec::H264,
            crf: 23,
            preset: EncodingPreset::Medium,
            max_resolution: MaxResolution::None,
            audio_codec: AudioCodec::Aac,
            audio_bitrate: 128,
            ffmpeg_path: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum VideoCodec {
    H264,
    H264Hw,
    H265,
    H265Hw,
    Copy,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum EncodingPreset {
    Ultrafast,
    Fast,
    Medium,
    Slow,
    Veryslow,
}

impl EncodingPreset {
    pub fn as_str(&self) -> &'static str {
        match self {
            EncodingPreset::Ultrafast => "ultrafast",
            EncodingPreset::Fast => "fast",
            EncodingPreset::Medium => "medium",
            EncodingPreset::Slow => "slow",
            EncodingPreset::Veryslow => "veryslow",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MaxResolution {
    None,
    Uhd4k,
    Fhd1080p,
    Hd720p,
    Sd480p,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AudioCodec {
    Aac,
    Copy,
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileInfo {
    pub path: String,
    pub duration_ms: Option<u64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
}

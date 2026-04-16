use crate::models::{AudioCodec, ConversionSettings, EncodingPreset, MaxResolution, VideoCodec};

// TODO Phase 2: construct full ffmpeg arg list from ConversionSettings

pub fn build_args(
    input: &str,
    output: &str,
    settings: &ConversionSettings,
) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    args.extend(["-i".into(), input.to_string()]);

    // Video codec
    match &settings.video_codec {
        VideoCodec::H264 => {
            args.extend([
                "-c:v".into(), "libx264".into(),
                "-crf".into(), settings.crf.to_string(),
                "-preset".into(), settings.preset.as_str().to_string(),
            ]);
        }
        VideoCodec::H264Hw => {
            args.extend(["-c:v".into(), "h264_videotoolbox".into()]);
        }
        VideoCodec::H265 => {
            args.extend([
                "-c:v".into(), "libx265".into(),
                "-crf".into(), settings.crf.to_string(),
                "-preset".into(), settings.preset.as_str().to_string(),
            ]);
        }
        VideoCodec::H265Hw => {
            args.extend(["-c:v".into(), "hevc_videotoolbox".into()]);
        }
        VideoCodec::Copy => {
            args.extend(["-c:v".into(), "copy".into()]);
        }
    }

    // Max resolution scale filter
    let scale = match &settings.max_resolution {
        MaxResolution::Uhd4k => Some("3840"),
        MaxResolution::Fhd1080p => Some("1920"),
        MaxResolution::Hd720p => Some("1280"),
        MaxResolution::Sd480p => Some("854"),
        MaxResolution::None => None,
    };
    if let Some(w) = scale {
        args.extend([
            "-vf".into(),
            format!("scale='min({w},iw)':-2"),
        ]);
    }

    // Audio codec
    match &settings.audio_codec {
        AudioCodec::Aac => {
            args.extend([
                "-c:a".into(), "aac".into(),
                "-b:a".into(), format!("{}k", settings.audio_bitrate),
            ]);
        }
        AudioCodec::Copy => {
            args.extend(["-c:a".into(), "copy".into()]);
        }
        AudioCodec::None => {
            args.push("-an".into());
        }
    }

    // Fast-start for web-compatible MP4
    args.extend(["-movflags".into(), "+faststart".into()]);

    // Progress reporting
    args.extend(["-progress".into(), "pipe:1".into(), "-nostats".into()]);

    args.push(output.to_string());

    args
}

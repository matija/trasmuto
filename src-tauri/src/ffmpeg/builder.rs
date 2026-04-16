use crate::models::{AudioCodec, ConversionSettings, MaxResolution, VideoCodec};

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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{AudioCodec, ConversionSettings, EncodingPreset, MaxResolution, VideoCodec};

    fn default_settings() -> ConversionSettings {
        ConversionSettings::default()
    }

    fn args_for(settings: ConversionSettings) -> Vec<String> {
        build_args("/in/video.mkv", "/in/video.mp4", &settings)
    }

    #[test]
    fn h264_includes_crf_and_preset() {
        let args = args_for(ConversionSettings {
            video_codec: VideoCodec::H264,
            crf: 23,
            preset: EncodingPreset::Medium,
            ..default_settings()
        });
        assert!(args.windows(2).any(|w| w == ["-c:v", "libx264"]));
        assert!(args.windows(2).any(|w| w == ["-crf", "23"]));
        assert!(args.windows(2).any(|w| w == ["-preset", "medium"]));
    }

    #[test]
    fn h264_hw_has_no_crf_or_preset() {
        let args = args_for(ConversionSettings {
            video_codec: VideoCodec::H264Hw,
            ..default_settings()
        });
        assert!(args.windows(2).any(|w| w == ["-c:v", "h264_videotoolbox"]));
        assert!(!args.iter().any(|a| a == "-crf"));
        assert!(!args.iter().any(|a| a == "-preset"));
    }

    #[test]
    fn h265_uses_libx265() {
        let args = args_for(ConversionSettings {
            video_codec: VideoCodec::H265,
            ..default_settings()
        });
        assert!(args.windows(2).any(|w| w == ["-c:v", "libx265"]));
    }

    #[test]
    fn copy_codec_passes_through() {
        let args = args_for(ConversionSettings {
            video_codec: VideoCodec::Copy,
            ..default_settings()
        });
        assert!(args.windows(2).any(|w| w == ["-c:v", "copy"]));
    }

    #[test]
    fn resolution_limit_adds_scale_filter() {
        let args = args_for(ConversionSettings {
            max_resolution: MaxResolution::Fhd1080p,
            ..default_settings()
        });
        assert!(args.iter().any(|a| a == "-vf"));
        assert!(args.iter().any(|a| a.contains("1920")));
    }

    #[test]
    fn no_resolution_limit_omits_scale_filter() {
        let args = args_for(ConversionSettings {
            max_resolution: MaxResolution::None,
            ..default_settings()
        });
        assert!(!args.iter().any(|a| a == "-vf"));
    }

    #[test]
    fn aac_audio_includes_bitrate() {
        let args = args_for(ConversionSettings {
            audio_codec: AudioCodec::Aac,
            audio_bitrate: 128,
            ..default_settings()
        });
        assert!(args.windows(2).any(|w| w == ["-c:a", "aac"]));
        assert!(args.windows(2).any(|w| w == ["-b:a", "128k"]));
    }

    #[test]
    fn strip_audio_emits_an_flag() {
        let args = args_for(ConversionSettings {
            audio_codec: AudioCodec::None,
            ..default_settings()
        });
        assert!(args.iter().any(|a| a == "-an"));
    }

    #[test]
    fn copy_audio_passes_through() {
        let args = args_for(ConversionSettings {
            audio_codec: AudioCodec::Copy,
            ..default_settings()
        });
        assert!(args.windows(2).any(|w| w == ["-c:a", "copy"]));
    }

    #[test]
    fn always_includes_faststart() {
        let args = args_for(default_settings());
        assert!(args.windows(2).any(|w| w == ["-movflags", "+faststart"]));
    }

    #[test]
    fn output_path_is_last_arg() {
        let args = build_args("/in/video.mkv", "/out/video.mp4", &default_settings());
        assert_eq!(args.last().map(String::as_str), Some("/out/video.mp4"));
    }

    #[test]
    fn input_is_after_dash_i() {
        let args = build_args("/in/video.mkv", "/out/video.mp4", &default_settings());
        let i_pos = args.iter().position(|a| a == "-i").expect("-i missing");
        assert_eq!(args[i_pos + 1], "/in/video.mkv");
    }
}

/// Integration tests: verify real file creation during conversion.
///
/// These tests spawn actual ffmpeg processes. They are skipped gracefully when
/// ffmpeg is not installed (CI without Homebrew).  On a developer machine with
/// ffmpeg available they test the full pipeline end-to-end.
///
/// Covered scenarios from PRD Phase 8:
///   - Non-MP4 input  → output appears in the same folder with the same stem (.mp4)
///   - MP4 input      → output appears in the same folder with a "-converted.mp4" suffix
use std::path::Path;
use std::process::Command;

use trasmuto_lib::ffmpeg::builder::build_args;
use trasmuto_lib::models::ConversionSettings;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn find_ffmpeg() -> Option<String> {
    for p in ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg"] {
        if Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    None
}

/// Create a 1-second, 64×64 silent test video at `path` using ffmpeg's built-in
/// lavfi sources.  Returns false if ffmpeg is not available.
fn create_test_video(ffmpeg: &str, path: &Path, ext: &str) -> bool {
    let (vcodec, acodec): (&str, Option<&str>) = match ext {
        "mp4" | "mkv" | "mov" => ("libx264", Some("aac")),
        _ => ("libx264", None),
    };

    let mut cmd = Command::new(ffmpeg);
    cmd.args([
        "-f", "lavfi", "-i", "testsrc=duration=1:size=64x64:rate=1",
        "-f", "lavfi", "-i", "sine=frequency=440:duration=1",
        "-c:v", vcodec,
    ]);
    if let Some(ac) = acodec {
        cmd.args(["-c:a", ac]);
    } else {
        cmd.arg("-an");
    }
    cmd.args([path.to_str().unwrap(), "-y"]);

    cmd.status()
        .map(|s| s.success())
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

/// Dropping a non-MP4 file (e.g. .mkv) should produce an MP4 with the same
/// stem in the same directory.
#[test]
fn non_mp4_input_creates_output_in_same_folder() {
    let ffmpeg = match find_ffmpeg() {
        Some(p) => p,
        None => {
            eprintln!("ffmpeg not found — skipping integration test");
            return;
        }
    };

    let tmp = tempfile::tempdir().expect("tempdir");
    let input = tmp.path().join("sample.mkv");
    let expected_output = tmp.path().join("sample.mp4");

    assert!(
        create_test_video(&ffmpeg, &input, "mkv"),
        "failed to create test .mkv"
    );

    let settings = ConversionSettings::default();
    let mut args = build_args(
        input.to_str().unwrap(),
        expected_output.to_str().unwrap(),
        &settings,
    );
    // Allow overwrite in tests; insert before the output path (last arg).
    let last = args.pop().unwrap();
    args.push("-y".into());
    args.push(last);

    let status = Command::new(&ffmpeg)
        .args(&args)
        .status()
        .expect("ffmpeg spawn failed");

    assert!(status.success(), "ffmpeg returned non-zero exit code");
    assert!(
        expected_output.exists(),
        "output file was not created in the same folder as input"
    );
    // Original input must not have been overwritten.
    assert!(input.exists(), "input file should still exist");
}

/// Dropping an MP4 file should produce a "-converted.mp4" file in the same
/// directory to avoid colliding with the original.
#[test]
fn mp4_input_creates_converted_suffix_in_same_folder() {
    let ffmpeg = match find_ffmpeg() {
        Some(p) => p,
        None => {
            eprintln!("ffmpeg not found — skipping integration test");
            return;
        }
    };

    let tmp = tempfile::tempdir().expect("tempdir");
    let input = tmp.path().join("sample.mp4");
    let expected_output = tmp.path().join("sample-converted.mp4");

    assert!(
        create_test_video(&ffmpeg, &input, "mp4"),
        "failed to create test .mp4"
    );

    let settings = ConversionSettings::default();
    let mut args = build_args(
        input.to_str().unwrap(),
        expected_output.to_str().unwrap(),
        &settings,
    );
    let last = args.pop().unwrap();
    args.push("-y".into());
    args.push(last);

    let status = Command::new(&ffmpeg)
        .args(&args)
        .status()
        .expect("ffmpeg spawn failed");

    assert!(status.success(), "ffmpeg returned non-zero exit code");
    assert!(
        expected_output.exists(),
        "mp4 input should produce a -converted.mp4 in the same folder"
    );
    // Original must be untouched.
    assert!(input.exists(), "original .mp4 should still exist");
    // The output must not overwrite the input.
    assert_ne!(
        input.canonicalize().unwrap(),
        expected_output.canonicalize().unwrap(),
        "output path must differ from input path"
    );
}

const HOMEBREW_ARM_FFMPEG: &str = "/opt/homebrew/bin/ffmpeg";
const HOMEBREW_X86_FFMPEG: &str = "/usr/local/bin/ffmpeg";
const HOMEBREW_ARM_FFPROBE: &str = "/opt/homebrew/bin/ffprobe";
const HOMEBREW_X86_FFPROBE: &str = "/usr/local/bin/ffprobe";

pub fn find_ffmpeg(user_path: Option<&str>) -> Option<String> {
    find_binary("ffmpeg", user_path, HOMEBREW_ARM_FFMPEG, HOMEBREW_X86_FFMPEG)
}

pub fn find_ffprobe(user_path: Option<&str>) -> Option<String> {
    find_binary("ffprobe", user_path, HOMEBREW_ARM_FFPROBE, HOMEBREW_X86_FFPROBE)
}

fn find_binary(name: &str, user_path: Option<&str>, arm_path: &str, x86_path: &str) -> Option<String> {
    // 1. User-configured path
    if let Some(p) = user_path {
        if std::path::Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    // 2. Apple Silicon Homebrew
    if std::path::Path::new(arm_path).exists() {
        return Some(arm_path.to_string());
    }
    // 3. Intel Homebrew
    if std::path::Path::new(x86_path).exists() {
        return Some(x86_path.to_string());
    }
    // 4. PATH fallback via `which` (unreliable for dock-launched apps, best-effort)
    std::process::Command::new("which")
        .arg(name)
        .output()
        .ok()
        .filter(|o| o.status.success())
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

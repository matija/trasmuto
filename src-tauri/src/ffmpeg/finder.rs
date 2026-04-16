// TODO Phase 2: binary discovery with Homebrew path fallbacks

const HOMEBREW_ARM: &str = "/opt/homebrew/bin/ffmpeg";
const HOMEBREW_X86: &str = "/usr/local/bin/ffmpeg";

pub fn find_ffmpeg(user_path: Option<&str>) -> Option<String> {
    // 1. User-configured path
    if let Some(p) = user_path {
        if std::path::Path::new(p).exists() {
            return Some(p.to_string());
        }
    }
    // 2. Apple Silicon Homebrew
    if std::path::Path::new(HOMEBREW_ARM).exists() {
        return Some(HOMEBREW_ARM.to_string());
    }
    // 3. Intel Homebrew
    if std::path::Path::new(HOMEBREW_X86).exists() {
        return Some(HOMEBREW_X86.to_string());
    }
    // 4. PATH fallback (unreliable for dock-launched apps, best-effort)
    None
}

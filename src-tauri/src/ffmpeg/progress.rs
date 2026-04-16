// TODO Phase 2: parse -progress pipe:1 output lines from ffmpeg stdout

/// Parse a key=value line from ffmpeg `-progress pipe:1` output.
/// Returns Some((key, value)) if the line is a valid key=value pair.
pub fn parse_progress_line(line: &str) -> Option<(&str, &str)> {
    let (key, val) = line.split_once('=')?;
    Some((key.trim(), val.trim()))
}

/// Parse out_time_ms from the "out_time_ms=<n>" line.
pub fn parse_out_time_ms(value: &str) -> Option<u64> {
    value.parse().ok()
}

/// Parse speed from the "speed=<n>x" line.
pub fn parse_speed(value: &str) -> Option<f64> {
    value.trim_end_matches('x').parse().ok()
}

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_progress_line_splits_on_equals() {
        let result = parse_progress_line("out_time_ms=123456");
        assert_eq!(result, Some(("out_time_ms", "123456")));
    }

    #[test]
    fn parse_progress_line_trims_whitespace() {
        let result = parse_progress_line("speed = 1.5x");
        assert_eq!(result, Some(("speed", "1.5x")));
    }

    #[test]
    fn parse_progress_line_returns_none_without_equals() {
        assert!(parse_progress_line("no_equals_here").is_none());
    }

    #[test]
    fn parse_out_time_ms_valid_integer() {
        assert_eq!(parse_out_time_ms("5000000"), Some(5_000_000));
    }

    #[test]
    fn parse_out_time_ms_invalid_returns_none() {
        assert!(parse_out_time_ms("N/A").is_none());
    }

    #[test]
    fn parse_speed_strips_x_suffix() {
        assert_eq!(parse_speed("2.5x"), Some(2.5));
    }

    #[test]
    fn parse_speed_no_suffix() {
        assert_eq!(parse_speed("1.0"), Some(1.0));
    }

    #[test]
    fn parse_speed_na_returns_none() {
        assert!(parse_speed("N/A").is_none());
    }
}

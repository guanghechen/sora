use std::time::{SystemTime, UNIX_EPOCH};

use crate::LogLevel;

pub mod ansi {
    pub const DEBUG: &str = "\x1b[90m";
    pub const INFO: &str = "\x1b[36m";
    pub const HINT: &str = "\x1b[35m";
    pub const WARN: &str = "\x1b[33m";
    pub const ERROR: &str = "\x1b[31m";
    pub const DIM: &str = "\x1b[90m";
    pub const RESET: &str = "\x1b[0m";
}

pub fn format_tag(level: LogLevel, prefixes: &[String], color: bool) -> String {
    let fallback;
    let prefixes = if prefixes.is_empty() {
        fallback = [level.as_str().to_owned()];
        &fallback
    } else {
        prefixes
    };
    if !color {
        return format!("[{}]", prefixes.join(":"));
    }
    let color = level_color(level);
    let values = prefixes
        .iter()
        .map(|prefix| format!("{color}{prefix}{}", ansi::RESET))
        .collect::<Vec<_>>()
        .join(&format!("{}:{}", ansi::DIM, ansi::RESET));
    format!(
        "{}[{}{}{}]{}",
        ansi::DIM,
        ansi::RESET,
        values,
        ansi::DIM,
        ansi::RESET
    )
}

pub(crate) fn format_timestamp(timestamp: SystemTime, color: bool) -> String {
    let timestamp = iso_timestamp(timestamp);
    if color {
        format!("{}{timestamp}{}", ansi::DIM, ansi::RESET)
    } else {
        timestamp
    }
}

const fn level_color(level: LogLevel) -> &'static str {
    match level {
        LogLevel::Debug => ansi::DEBUG,
        LogLevel::Info => ansi::INFO,
        LogLevel::Hint => ansi::HINT,
        LogLevel::Warn => ansi::WARN,
        LogLevel::Error => ansi::ERROR,
    }
}

fn iso_timestamp(timestamp: SystemTime) -> String {
    let nanos = match timestamp.duration_since(UNIX_EPOCH) {
        Ok(duration) => {
            i128::from(duration.as_secs()) * 1_000_000_000 + i128::from(duration.subsec_nanos())
        }
        Err(error) => {
            let duration = error.duration();
            -(i128::from(duration.as_secs()) * 1_000_000_000 + i128::from(duration.subsec_nanos()))
        }
    };
    let millis = nanos.div_euclid(1_000_000);
    let days = millis.div_euclid(86_400_000);
    let day_millis = millis.rem_euclid(86_400_000);
    let (year, month, day) = civil_from_days(days);
    let hour = day_millis / 3_600_000;
    let minute = day_millis % 3_600_000 / 60_000;
    let second = day_millis % 60_000 / 1_000;
    let millisecond = day_millis % 1_000;
    format!(
        "{}-{month:02}-{day:02}T{hour:02}:{minute:02}:{second:02}.{millisecond:03}Z",
        format_year(year)
    )
}

fn civil_from_days(days: i128) -> (i128, i128, i128) {
    let shifted = days + 719_468;
    let era = shifted.div_euclid(146_097);
    let day_of_era = shifted - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let mut year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = month_prime + if month_prime < 10 { 3 } else { -9 };
    if month <= 2 {
        year += 1;
    }
    (year, month, day)
}

fn format_year(year: i128) -> String {
    match year {
        0..=9_999 => format!("{year:04}"),
        ..0 => format!("-{year:06}", year = year.unsigned_abs()),
        _ => format!("+{year:06}"),
    }
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, UNIX_EPOCH};

    use super::{format_tag, format_timestamp, iso_timestamp};
    use crate::{LogLevel, ansi};

    #[test]
    fn formats_plain_and_colored_tags() {
        assert_eq!(format_tag(LogLevel::Warn, &[], false), "[warn]");
        assert_eq!(
            format_tag(
                LogLevel::Info,
                &["app".to_owned(), "worker".to_owned()],
                false
            ),
            "[app:worker]"
        );
        let colored = format_tag(LogLevel::Error, &["app".to_owned()], true);
        assert!(colored.starts_with(ansi::DIM));
        assert!(colored.contains(ansi::ERROR));
        assert!(colored.ends_with(ansi::RESET));
    }

    #[test]
    fn formats_utc_milliseconds_across_the_unix_epoch() {
        assert_eq!(iso_timestamp(UNIX_EPOCH), "1970-01-01T00:00:00.000Z");
        assert_eq!(
            iso_timestamp(UNIX_EPOCH + Duration::from_millis(951_827_696_789)),
            "2000-02-29T12:34:56.789Z"
        );
        assert_eq!(
            iso_timestamp(UNIX_EPOCH - Duration::from_millis(1)),
            "1969-12-31T23:59:59.999Z"
        );
        assert_eq!(
            iso_timestamp(UNIX_EPOCH + Duration::from_nanos(999_999)),
            "1970-01-01T00:00:00.000Z"
        );
        assert_eq!(
            iso_timestamp(UNIX_EPOCH - Duration::from_nanos(1)),
            "1969-12-31T23:59:59.999Z"
        );
        assert_eq!(
            iso_timestamp(UNIX_EPOCH - Duration::from_nanos(1_000_001)),
            "1969-12-31T23:59:59.998Z"
        );
    }

    #[test]
    fn color_wraps_only_the_timestamp() {
        let colored = format_timestamp(UNIX_EPOCH, true);
        assert_eq!(
            colored,
            format!("{}1970-01-01T00:00:00.000Z{}", ansi::DIM, ansi::RESET)
        );
        assert_eq!(
            format_timestamp(UNIX_EPOCH, false),
            "1970-01-01T00:00:00.000Z"
        );
    }
}

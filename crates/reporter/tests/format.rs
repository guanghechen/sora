use std::time::{Duration, UNIX_EPOCH};

pub use guanghechen_reporter::LogLevel;

#[path = "../src/format.rs"]
mod format;

#[test]
fn formats_plain_and_colored_tags() {
    assert_eq!(format::format_tag(LogLevel::Warn, &[], false), "[warn]");
    assert_eq!(
        format::format_tag(
            LogLevel::Info,
            &["app".to_owned(), "worker".to_owned()],
            false,
        ),
        "[app:worker]"
    );
    assert_eq!(
        format::format_tag(
            LogLevel::Info,
            &["app".to_owned(), "worker".to_owned()],
            true,
        ),
        concat!(
            "\x1b[90m[\x1b[36mapp\x1b[39m\x1b[90m:",
            "\x1b[36mworker\x1b[39m\x1b[90m]\x1b[39m"
        )
    );

    for (level, open) in [
        (LogLevel::Debug, "\x1b[90m"),
        (LogLevel::Info, "\x1b[36m"),
        (LogLevel::Hint, "\x1b[35m"),
        (LogLevel::Warn, "\x1b[33m"),
        (LogLevel::Error, "\x1b[31m"),
    ] {
        assert_eq!(
            format::format_tag(level, &[], true),
            format!("\x1b[90m[{open}{}\x1b[39m\x1b[90m]\x1b[39m", level.as_str())
        );
    }
}

#[test]
fn formats_utc_milliseconds_across_the_unix_epoch() {
    for (timestamp, expected) in [
        (UNIX_EPOCH, "1970-01-01T00:00:00.000Z"),
        (
            UNIX_EPOCH + Duration::from_millis(951_827_696_789),
            "2000-02-29T12:34:56.789Z",
        ),
        (
            UNIX_EPOCH - Duration::from_millis(1),
            "1969-12-31T23:59:59.999Z",
        ),
        (
            UNIX_EPOCH + Duration::from_nanos(999_999),
            "1970-01-01T00:00:00.000Z",
        ),
        (
            UNIX_EPOCH - Duration::from_nanos(1),
            "1969-12-31T23:59:59.999Z",
        ),
        (
            UNIX_EPOCH - Duration::from_nanos(1_000_001),
            "1969-12-31T23:59:59.998Z",
        ),
    ] {
        assert_eq!(format::format_timestamp(timestamp, false), expected);
    }
}

#[test]
fn color_wraps_only_the_timestamp() {
    assert_eq!(
        format::format_timestamp(UNIX_EPOCH, true),
        "\x1b[90m1970-01-01T00:00:00.000Z\x1b[39m"
    );
    assert_eq!(
        format::format_timestamp(UNIX_EPOCH, false),
        "1970-01-01T00:00:00.000Z"
    );
}

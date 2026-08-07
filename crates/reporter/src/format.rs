use std::time::{SystemTime, UNIX_EPOCH};

use guanghechen_chalk::{AnsiColor, Color, ColorLevel, Renderer, Style};

use crate::LogLevel;

const DIM_STYLE: Style = Style::new().with_foreground(Color::Ansi(AnsiColor::BrightBlack));

pub fn format_tag(level: LogLevel, prefixes: &[String], color: bool) -> String {
    let fallback;
    let prefixes = if prefixes.is_empty() {
        fallback = [level.as_str().to_owned()];
        &fallback
    } else {
        prefixes
    };
    let renderer = renderer(color);
    let level_style = level_style(level);
    let values = prefixes
        .iter()
        .map(|prefix| renderer.paint(level_style, prefix))
        .collect::<Vec<_>>()
        .join(":");
    renderer.paint(DIM_STYLE, &format!("[{values}]"))
}

pub(crate) fn format_timestamp(timestamp: SystemTime, color: bool) -> String {
    let timestamp = iso_timestamp(timestamp);
    renderer(color).paint(DIM_STYLE, &timestamp)
}

const fn renderer(color: bool) -> Renderer {
    let level = if color {
        ColorLevel::Ansi16
    } else {
        ColorLevel::None
    };
    Renderer::new(level)
}

const fn level_style(level: LogLevel) -> Style {
    let color = match level {
        LogLevel::Debug => AnsiColor::BrightBlack,
        LogLevel::Info => AnsiColor::Cyan,
        LogLevel::Hint => AnsiColor::Magenta,
        LogLevel::Warn => AnsiColor::Yellow,
        LogLevel::Error => AnsiColor::Red,
    };
    Style::new().with_foreground(Color::Ansi(color))
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

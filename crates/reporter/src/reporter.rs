use std::borrow::Cow;
use std::fmt::Write as _;
use std::fmt::{self, Display, Formatter};
use std::io::{self, Write};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::SystemTime;

use crate::format::format_timestamp;
use crate::{LogLevel, format_tag};

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct ReporterFlight {
    pub date: Option<bool>,
    pub color: Option<bool>,
}

pub struct ReporterOptions {
    pub prefix: Option<String>,
    pub level: LogLevel,
    pub flight: ReporterFlight,
    pub output: Option<Arc<dyn ReporterOutput>>,
}

impl Default for ReporterOptions {
    fn default() -> Self {
        Self {
            prefix: None,
            level: LogLevel::Info,
            flight: ReporterFlight::default(),
            output: None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReporterEntry {
    pub level: LogLevel,
    pub prefixes: Vec<String>,
    pub message: String,
    pub date: SystemTime,
}

pub struct ReporterOutputRecord<'a> {
    pub level: LogLevel,
    pub parts: &'a [String],
    pub message: &'a str,
}

pub trait ReporterOutput: Send + Sync {
    fn write(&self, record: ReporterOutputRecord<'_>) -> io::Result<()>;
}

impl<F> ReporterOutput for F
where
    F: Fn(LogLevel, &[String], &str) -> io::Result<()> + Send + Sync,
{
    fn write(&self, record: ReporterOutputRecord<'_>) -> io::Result<()> {
        self(record.level, record.parts, record.message)
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReporterError(&'static str);

impl Display for ReporterError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.0)
    }
}

impl std::error::Error for ReporterError {}

struct Capture {
    generation: u64,
    entries: Vec<ReporterEntry>,
}

struct CoreState {
    level: LogLevel,
    date: bool,
    color: bool,
    capture: Option<Capture>,
    next_capture_generation: u64,
}

struct Core {
    state: Mutex<CoreState>,
    output: Arc<dyn ReporterOutput>,
}

#[derive(Clone)]
pub struct Reporter {
    core: Arc<Core>,
    prefixes: Vec<String>,
}

impl Default for Reporter {
    fn default() -> Self {
        Self::new()
    }
}

impl Reporter {
    pub fn new() -> Self {
        Self::with_options(ReporterOptions::default())
            .unwrap_or_else(|_| unreachable!("default reporter prefix is valid"))
    }

    pub fn with_options(options: ReporterOptions) -> Result<Self, ReporterError> {
        let prefixes = options.prefix.into_iter().collect::<Vec<_>>();
        for prefix in &prefixes {
            validate_prefix(prefix)?;
        }
        Ok(Self {
            core: Arc::new(Core {
                state: Mutex::new(CoreState {
                    level: options.level,
                    date: options.flight.date.unwrap_or(true),
                    color: options.flight.color.unwrap_or(true),
                    capture: None,
                    next_capture_generation: 0,
                }),
                output: options.output.unwrap_or_else(|| Arc::new(ConsoleOutput)),
            }),
            prefixes,
        })
    }

    pub fn enabled(&self, level: LogLevel) -> bool {
        level >= lock(&self.core.state).level
    }

    pub fn set_level(&self, level: LogLevel) {
        lock(&self.core.state).level = level;
    }

    pub fn set_flight(&self, flight: ReporterFlight) {
        let mut state = lock(&self.core.state);
        if let Some(date) = flight.date {
            state.date = date;
        }
        if let Some(color) = flight.color {
            state.color = color;
        }
    }

    pub fn with_prefix(&self, prefix: impl Into<String>) -> Result<Self, ReporterError> {
        let prefix = prefix.into();
        validate_prefix(&prefix)?;
        let mut prefixes = self.prefixes.clone();
        prefixes.push(prefix);
        Ok(Self {
            core: Arc::clone(&self.core),
            prefixes,
        })
    }

    pub fn mock(&self) -> &Self {
        let mut state = lock(&self.core.state);
        state.next_capture_generation = state.next_capture_generation.wrapping_add(1);
        state.capture = Some(Capture {
            generation: state.next_capture_generation,
            entries: Vec::new(),
        });
        self
    }

    pub fn collect(&self) -> Vec<ReporterEntry> {
        lock(&self.core.state)
            .capture
            .take()
            .map_or_else(Vec::new, |capture| capture.entries)
    }

    pub fn log(&self, level: LogLevel, message: impl Into<String>) -> io::Result<()> {
        self.log_lazy(level, move || message.into())
    }

    pub fn log_lazy<F>(&self, level: LogLevel, message: F) -> io::Result<()>
    where
        F: FnOnce() -> String,
    {
        let Some(snapshot) = self.snapshot(level) else {
            return Ok(());
        };
        let message = message();
        let date = SystemTime::now();
        if let Some(generation) = snapshot.capture_generation {
            let mut state = lock(&self.core.state);
            if let Some(capture) = &mut state.capture
                && capture.generation == generation
            {
                capture.entries.push(ReporterEntry {
                    level,
                    prefixes: self.prefixes.clone(),
                    message,
                    date,
                });
            }
            return Ok(());
        }
        let mut parts = Vec::with_capacity(2);
        if snapshot.date {
            parts.push(format_timestamp(date, snapshot.color));
        }
        parts.push(format_tag(level, &self.prefixes, snapshot.color));
        self.core.output.write(ReporterOutputRecord {
            level,
            parts: &parts,
            message: &message,
        })
    }

    pub fn debug(&self, message: impl Into<String>) -> io::Result<()> {
        self.log(LogLevel::Debug, message)
    }

    pub fn info(&self, message: impl Into<String>) -> io::Result<()> {
        self.log(LogLevel::Info, message)
    }

    pub fn hint(&self, message: impl Into<String>) -> io::Result<()> {
        self.log(LogLevel::Hint, message)
    }

    pub fn warn(&self, message: impl Into<String>) -> io::Result<()> {
        self.log(LogLevel::Warn, message)
    }

    pub fn error(&self, message: impl Into<String>) -> io::Result<()> {
        self.log(LogLevel::Error, message)
    }

    fn snapshot(&self, level: LogLevel) -> Option<Snapshot> {
        let state = lock(&self.core.state);
        if level < state.level {
            return None;
        }
        Some(Snapshot {
            date: state.date,
            color: state.color,
            capture_generation: state.capture.as_ref().map(|capture| capture.generation),
        })
    }
}

struct Snapshot {
    date: bool,
    color: bool,
    capture_generation: Option<u64>,
}

struct ConsoleOutput;

impl ReporterOutput for ConsoleOutput {
    fn write(&self, record: ReporterOutputRecord<'_>) -> io::Result<()> {
        match record.level {
            LogLevel::Debug | LogLevel::Info | LogLevel::Hint => {
                write_record(io::stdout().lock(), &record)
            }
            LogLevel::Warn | LogLevel::Error => write_record(io::stderr().lock(), &record),
        }
    }
}

fn write_record(mut writer: impl Write, record: &ReporterOutputRecord<'_>) -> io::Result<()> {
    for (index, part) in record.parts.iter().enumerate() {
        if index > 0 {
            writer.write_all(b" ")?;
        }
        writer.write_all(part.as_bytes())?;
    }
    if !record.parts.is_empty() && !record.message.is_empty() {
        writer.write_all(b" ")?;
    }
    writer.write_all(escape_console_message(record.message).as_bytes())?;
    writer.write_all(b"\n")
}

/// Escape message controls into visible text suitable for one physical console line.
#[must_use]
pub fn escape_console_message(message: &str) -> Cow<'_, str> {
    if !message.chars().any(char::is_control) {
        return Cow::Borrowed(message);
    }
    let mut escaped = String::with_capacity(message.len());
    let mut visible_start = 0;
    for (index, character) in message.char_indices() {
        if !character.is_control() {
            continue;
        }
        escaped.push_str(&message[visible_start..index]);
        match character {
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            _ => write!(escaped, "\\u{{{:x}}}", u32::from(character))
                .unwrap_or_else(|_| unreachable!("writing to String cannot fail")),
        }
        visible_start = index + character.len_utf8();
    }
    escaped.push_str(&message[visible_start..]);
    Cow::Owned(escaped)
}

fn validate_prefix(prefix: &str) -> Result<(), ReporterError> {
    if prefix.contains(':') {
        return Err(ReporterError("prefix cannot contain ':'"));
    }
    if prefix.chars().any(char::is_control) {
        return Err(ReporterError("prefix cannot contain control characters"));
    }
    Ok(())
}

fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

#[cfg(test)]
mod tests {
    use super::{ReporterOutputRecord, write_record};
    use crate::LogLevel;

    #[test]
    fn console_output_visibly_escapes_message_controls_on_one_line() {
        let parts = vec!["[info]".to_owned()];
        let record = ReporterOutputRecord {
            level: LogLevel::Info,
            parts: &parts,
            message: "可信\n[error:forged]\r\t\x1b]52;c;payload\x07\u{85}\0",
        };
        let mut output = Vec::new();

        write_record(&mut output, &record).unwrap();

        assert_eq!(
            String::from_utf8(output).unwrap(),
            "[info] 可信\\n[error:forged]\\r\\t\\u{1b}]52;c;payload\\u{7}\\u{85}\\u{0}\n"
        );
    }
}

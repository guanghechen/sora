#![doc = include_str!("../README.md")]

use std::fmt::{self, Display, Formatter};
use std::io::{self, Write};
use std::sync::{Arc, Mutex};

use guanghechen_commander::{Matches, Value};
use guanghechen_reporter::{
    LogLevel, Reporter, ReporterFlight, ReporterOptions, ReporterOutput, ReporterOutputRecord,
    escape_console_message,
};

const MAX_REPORT_BYTES: usize = 64 * 1024 * 1024;

/// An error returned when resolved Commander matches cannot configure a CLI reporter.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReporterConfigError(String);

impl Display for ReporterConfigError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl std::error::Error for ReporterConfigError {}

#[derive(Default)]
struct ReportBuffer {
    bytes: Mutex<Vec<u8>>,
}

#[derive(Clone, Copy)]
enum MessagePolicy {
    Escape,
    PreserveRendered,
}

struct BufferedOutput {
    buffer: Arc<ReportBuffer>,
    message_policy: MessagePolicy,
}

impl ReporterOutput for BufferedOutput {
    fn write(&self, record: ReporterOutputRecord<'_>) -> io::Result<()> {
        let mut bytes = self
            .buffer
            .bytes
            .lock()
            .map_err(|_| io::Error::other("reporter buffer lock is poisoned"))?;
        let message = match self.message_policy {
            MessagePolicy::Escape => escape_console_message(record.message),
            MessagePolicy::PreserveRendered => record.message.into(),
        };
        let additional = record_size(record.parts, &message)?;
        if exceeds_report_limit(bytes.len(), additional) {
            return Err(io::Error::other("reporter output exceeds 64 MiB"));
        }
        for (index, part) in record.parts.iter().enumerate() {
            if index > 0 {
                bytes.push(b' ');
            }
            bytes.extend_from_slice(part.as_bytes());
        }
        if !record.parts.is_empty() && !record.message.is_empty() {
            bytes.push(b' ');
        }
        bytes.extend_from_slice(message.as_bytes());
        bytes.push(b'\n');
        Ok(())
    }
}

fn record_size(parts: &[String], message: &str) -> io::Result<usize> {
    parts
        .iter()
        .map(String::len)
        .sum::<usize>()
        .checked_add(parts.len().saturating_sub(1))
        .and_then(|value| value.checked_add(usize::from(!parts.is_empty() && !message.is_empty())))
        .and_then(|value| value.checked_add(message.len()))
        .and_then(|value| value.checked_add(1))
        .ok_or_else(|| io::Error::other("reporter output size overflow"))
}

const fn exceeds_report_limit(current: usize, additional: usize) -> bool {
    current.saturating_add(additional) > MAX_REPORT_BYTES
}

/// A buffered Reporter configured from resolved Commander builtin matches.
pub struct CliReporter {
    reporter: Reporter,
    rendered_reporter: Reporter,
    output: Arc<ReportBuffer>,
    terminal: bool,
    colorful: bool,
}

/// Whether the one-shot runner should emit its final terminal error record.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum TerminalErrorDisposition {
    /// Emit the final error through Reporter.
    Report,
    /// Preserve the failure exit code but omit the final Reporter record.
    Suppress,
}

impl CliReporter {
    /// Construct a buffered reporter from resolved Commander builtin matches.
    ///
    /// # Errors
    ///
    /// Returns [`ReporterConfigError`] when `logLevel` is missing or invalid, or when Reporter
    /// rejects the supplied prefix.
    pub fn from_matches(
        prefix: &str,
        matches: &Matches,
        all_destinations_terminal: bool,
    ) -> Result<Self, ReporterConfigError> {
        let level = match matches.builtins().option("logLevel") {
            Some(Value::String(value)) => LogLevel::parse_exact(value).ok_or_else(|| {
                ReporterConfigError("--log-level has an unsupported value".to_owned())
            })?,
            _ => return Err(ReporterConfigError("--log-level is required".to_owned())),
        };
        let level = if builtin_bool(matches, "silent") {
            LogLevel::Error
        } else {
            level
        };
        let colorful = colorful(matches, all_destinations_terminal);
        let date = builtin_bool(matches, "logDate");
        let output = Arc::new(ReportBuffer::default());
        let reporter = create_reporter(
            prefix,
            level,
            date,
            colorful,
            Arc::clone(&output),
            MessagePolicy::Escape,
        )?;
        let rendered_reporter = create_reporter(
            prefix,
            level,
            date,
            colorful,
            Arc::clone(&output),
            MessagePolicy::PreserveRendered,
        )?;
        Ok(Self {
            reporter,
            rendered_reporter,
            output,
            terminal: all_destinations_terminal,
            colorful,
        })
    }

    /// Return the caller-supplied combined terminal state.
    #[must_use]
    pub const fn terminal(&self) -> bool {
        self.terminal
    }

    /// Return the effective color policy after Commander and environment resolution.
    #[must_use]
    pub const fn colorful(&self) -> bool {
        self.colorful
    }

    /// Buffer one info record.
    pub fn info(&self, message: impl Into<String>) -> io::Result<()> {
        self.reporter.info(message)
    }

    /// Buffer one warning record.
    pub fn warn(&self, message: impl Into<String>) -> io::Result<()> {
        self.reporter.warn(message)
    }

    /// Buffer one error record.
    pub fn error(&self, message: impl Into<String>) -> io::Result<()> {
        self.reporter.error(message)
    }

    /// Buffer trusted, fully sanitized semantic renderer output at info level.
    ///
    /// Unlike [`Self::info`], this method preserves multiline layout and terminal control
    /// sequences. Do not pass raw untrusted values; every interpolation must already be safe for
    /// the destination terminal.
    pub fn info_rendered(&self, message: impl Into<String>) -> io::Result<()> {
        self.rendered_reporter.info(message)
    }

    /// Buffer trusted, fully sanitized semantic renderer output at warning level.
    ///
    /// Unlike [`Self::warn`], this method preserves multiline layout and terminal control
    /// sequences. Do not pass raw untrusted values; every interpolation must already be safe for
    /// the destination terminal.
    pub fn warn_rendered(&self, message: impl Into<String>) -> io::Result<()> {
        self.rendered_reporter.warn(message)
    }

    /// Drain all currently buffered records to `output`.
    pub fn flush_to(&self, output: &mut dyn Write) -> io::Result<()> {
        let bytes = {
            let mut bytes = self
                .output
                .bytes
                .lock()
                .map_err(|_| io::Error::other("reporter buffer lock is poisoned"))?;
            std::mem::take(&mut *bytes)
        };
        output.write_all(&bytes)
    }
}

fn create_reporter(
    prefix: &str,
    level: LogLevel,
    date: bool,
    colorful: bool,
    buffer: Arc<ReportBuffer>,
    message_policy: MessagePolicy,
) -> Result<Reporter, ReporterConfigError> {
    Reporter::with_options(ReporterOptions {
        prefix: Some(prefix.to_owned()),
        level,
        flight: ReporterFlight {
            date: Some(date),
            color: Some(colorful),
        },
        output: Some(Arc::new(BufferedOutput {
            buffer,
            message_policy,
        })),
    })
    .map_err(|error| ReporterConfigError(error.to_string()))
}

/// Run one synchronous action and emit its terminal failure through a buffered Reporter.
pub fn run_reported<E>(
    matches: &Matches,
    prefix: &str,
    stderr: &mut dyn Write,
    all_destinations_terminal: bool,
    action: impl FnOnce(&CliReporter) -> Result<(), E>,
    exit_code: impl FnOnce(&E) -> u8,
) -> u8
where
    E: Display,
{
    run_reported_with_disposition(
        matches,
        prefix,
        stderr,
        all_destinations_terminal,
        action,
        exit_code,
        |_| TerminalErrorDisposition::Report,
    )
}

/// Run one synchronous action with explicit final terminal-error disposition.
pub fn run_reported_with_disposition<E>(
    matches: &Matches,
    prefix: &str,
    stderr: &mut dyn Write,
    all_destinations_terminal: bool,
    action: impl FnOnce(&CliReporter) -> Result<(), E>,
    exit_code: impl FnOnce(&E) -> u8,
    disposition: impl FnOnce(&E) -> TerminalErrorDisposition,
) -> u8
where
    E: Display,
{
    let reporter = match CliReporter::from_matches(prefix, matches, all_destinations_terminal) {
        Ok(reporter) => reporter,
        Err(error) => {
            let _ = writeln!(stderr, "Error: {error}");
            return 1;
        }
    };
    let code = match action(&reporter) {
        Ok(()) => 0,
        Err(error) => {
            let code = exit_code(&error);
            if disposition(&error) == TerminalErrorDisposition::Report
                && queue_terminal_error(&reporter, stderr, &error).is_err()
            {
                return 1;
            }
            code
        }
    };
    if reporter.flush_to(stderr).is_err() {
        1
    } else {
        code
    }
}

fn queue_terminal_error(
    reporter: &CliReporter,
    output: &mut dyn Write,
    error: &impl Display,
) -> io::Result<()> {
    let message = terminal_error_message(error);
    if reporter.error(message.as_str()).is_ok() {
        return Ok(());
    }
    reporter.flush_to(output)?;
    reporter.error(message)
}

fn builtin_bool(matches: &Matches, name: &str) -> bool {
    matches.builtins().option(name) == Some(&Value::Bool(true))
}

fn terminal_error_message(error: &impl Display) -> String {
    let message = error.to_string();
    let mut content = message.as_str();
    while let Some(remainder) = content.strip_prefix("Error:") {
        content = remainder.strip_prefix(' ').unwrap_or(remainder);
    }
    if content.is_empty() {
        "Error:".to_owned()
    } else {
        format!("Error: {content}")
    }
}

fn colorful(matches: &Matches, all_destinations_terminal: bool) -> bool {
    let enabled = builtin_bool(matches, "logColorful");
    if matches.builtins().contains("logColorful") {
        return enabled;
    }
    enabled
        && all_destinations_terminal
        && !matches.effective_environment().contains_key("NO_COLOR")
}

#[cfg(test)]
mod tests {
    use std::fmt;
    use std::io;

    use guanghechen_commander::{Command, ParseOutcome, ParseRequest};

    use super::{
        CliReporter, MAX_REPORT_BYTES, TerminalErrorDisposition, exceeds_report_limit,
        run_reported, run_reported_with_disposition,
    };

    #[test]
    fn report_limit_accepts_the_boundary_and_rejects_overflow() {
        assert!(!exceeds_report_limit(MAX_REPORT_BYTES, 0));
        assert!(!exceeds_report_limit(MAX_REPORT_BYTES - 1, 1));
        assert!(exceeds_report_limit(MAX_REPORT_BYTES, 1));
        assert!(exceeds_report_limit(MAX_REPORT_BYTES - 1, 2));
        assert!(exceeds_report_limit(usize::MAX, usize::MAX));
    }

    #[test]
    fn reporter_formats_and_drains_injected_output() {
        let command = Command::builder("test", "test").build().unwrap();
        let ParseOutcome::Matches(matches) = command.parse_from([] as [&str; 0]).unwrap() else {
            panic!("empty input should produce matches");
        };
        let reporter = CliReporter::from_matches("test", &matches, true).unwrap();
        reporter.info("ready").unwrap();
        let mut output = Vec::new();
        reporter.flush_to(&mut output).unwrap();
        let output = String::from_utf8(output).unwrap();
        assert!(output.contains("\x1b["));
        assert!(output.contains('['));
        assert!(output.contains("test"));
        assert!(output.contains("ready"));
        assert!(output.contains('T') && output.contains('Z'));
        let mut drained = Vec::new();
        reporter.flush_to(&mut drained).unwrap();
        assert!(drained.is_empty());
    }

    #[test]
    fn reporter_color_policy_uses_terminal_environment_and_explicit_override() {
        assert!(render_report(&[], &[], true).contains("\x1b["));
        assert!(!render_report(&[], &[], false).contains("\x1b["));
        assert!(!render_report(&[], &[("NO_COLOR", "1")], true).contains("\x1b["));
        assert!(render_report(&["--log-colorful"], &[("NO_COLOR", "1")], false).contains("\x1b["));
        assert!(!render_report(&["--no-log-colorful"], &[], true).contains("\x1b["));
    }

    #[test]
    fn reporter_exposes_effective_terminal_and_color_state() {
        let command = Command::builder("test", "test").build().unwrap();
        let request = ParseRequest::new(["--no-log-colorful"]);
        let ParseOutcome::Matches(matches) = command.parse(request).unwrap() else {
            panic!("reporter options should produce matches");
        };
        let reporter = CliReporter::from_matches("test", &matches, true).unwrap();
        assert!(reporter.terminal());
        assert!(!reporter.colorful());

        let request = ParseRequest::new(["--log-colorful"]);
        let ParseOutcome::Matches(matches) = command.parse(request).unwrap() else {
            panic!("reporter options should produce matches");
        };
        let reporter = CliReporter::from_matches("test", &matches, false).unwrap();
        assert!(!reporter.terminal());
        assert!(reporter.colorful());
    }

    #[test]
    fn reporter_visibly_escapes_untrusted_message_controls() {
        let command = Command::builder("test", "test").build().unwrap();
        let ParseOutcome::Matches(matches) = command
            .parse_from(["--no-log-date", "--no-log-colorful"])
            .unwrap()
        else {
            panic!("reporter options should produce matches");
        };
        let reporter = CliReporter::from_matches("test", &matches, false).unwrap();
        reporter.warn("line\n\x1b]52;c;payload\x07").unwrap();
        let mut output = Vec::new();
        reporter.flush_to(&mut output).unwrap();
        assert_eq!(
            String::from_utf8(output).unwrap(),
            r"[test] line\n\u{1b}]52;c;payload\u{7}".to_owned() + "\n"
        );
    }

    #[test]
    fn reporter_preserves_trusted_rendered_layout_controls_and_shared_order() {
        let command = Command::builder("test", "test").build().unwrap();
        let ParseOutcome::Matches(matches) = command
            .parse_from(["--no-log-date", "--no-log-colorful"])
            .unwrap()
        else {
            panic!("reporter options should produce matches");
        };
        let reporter = CliReporter::from_matches("test", &matches, false).unwrap();
        reporter.info("untrusted\n\x1b]52;c;payload\x07").unwrap();
        reporter
            .info_rendered(
                "first line\n\x1b[1;32msecond line\x1b[0m\n\x1b]8;;file:///tmp/demo\x1b\\/tmp/demo\x1b]8;;\x1b\\",
            )
            .unwrap();
        reporter.warn_rendered("final warning").unwrap();

        let mut output = Vec::new();
        reporter.flush_to(&mut output).unwrap();

        assert_eq!(
            String::from_utf8(output).unwrap(),
            "[test] untrusted\\n\\u{1b}]52;c;payload\\u{7}\n\
             [test] first line\n\
             \x1b[1;32msecond line\x1b[0m\n\
             \x1b]8;;file:///tmp/demo\x1b\\/tmp/demo\x1b]8;;\x1b\\\n\
             [test] final warning\n"
        );
    }

    #[test]
    fn run_reported_honors_flight_silent_and_exit_code() {
        let command = Command::builder("test", "test").build().unwrap();
        let ParseOutcome::Matches(matches) = command
            .parse_from(["--no-log-date", "--no-log-colorful"])
            .unwrap()
        else {
            panic!("reporter options should produce matches");
        };
        let mut output = Vec::new();
        let code = run_reported(
            &matches,
            "test",
            &mut output,
            false,
            |reporter| reporter.info("plain").map_err(TestError),
            |_| 1,
        );
        assert_eq!(code, 0);
        assert_eq!(String::from_utf8(output).unwrap(), "[test] plain\n");

        let ParseOutcome::Matches(silent) = command.parse_from(["--silent"]).unwrap() else {
            panic!("silent should produce matches");
        };
        let mut output = Vec::new();
        let code = run_reported(
            &silent,
            "test",
            &mut output,
            false,
            |reporter| {
                reporter.info("hidden").map_err(TestError)?;
                reporter
                    .info_rendered("hidden rendered info")
                    .map_err(TestError)?;
                reporter
                    .warn_rendered("hidden rendered warning")
                    .map_err(TestError)
            },
            |_| 1,
        );
        assert_eq!(code, 0);
        assert!(output.is_empty());

        let mut output = Vec::new();
        let code = run_reported(
            &matches,
            "test",
            &mut output,
            false,
            |_reporter| Err(ExpectedError),
            |_| 3,
        );
        assert_eq!(code, 3);
        assert_eq!(
            String::from_utf8(output).unwrap(),
            "[test] Error: expected failure\n"
        );

        let mut output = Vec::new();
        let code = run_reported(
            &matches,
            "test",
            &mut output,
            false,
            |_reporter| Err(RepeatedErrorMarker),
            |_| 3,
        );
        assert_eq!(code, 3);
        assert_eq!(
            String::from_utf8(output).unwrap(),
            "[test] Error: expected failure\n"
        );

        let mut output = Vec::new();
        let code = run_reported(
            &matches,
            "test",
            &mut output,
            false,
            |_reporter| Err(EmptyError),
            |_| 3,
        );
        assert_eq!(code, 3);
        assert_eq!(String::from_utf8(output).unwrap(), "[test] Error:\n");

        let mut output = Vec::new();
        let code = run_reported(
            &matches,
            "test",
            &mut output,
            false,
            |_reporter| Err(ControlledError),
            |_| 3,
        );
        assert_eq!(code, 3);
        assert_eq!(
            String::from_utf8(output).unwrap(),
            "[test] Error: failure\\n\\u{1b}]52;c;payload\\u{7}\n"
        );

        let mut output = Vec::new();
        let code = run_reported_with_disposition(
            &matches,
            "test",
            &mut output,
            false,
            |_reporter| Err(ExpectedError),
            |_| 3,
            |_| TerminalErrorDisposition::Suppress,
        );
        assert_eq!(code, 3);
        assert!(output.is_empty());
    }

    #[test]
    fn run_reported_maps_flush_failure_to_execution_failure() {
        let command = Command::builder("test", "test").build().unwrap();
        let ParseOutcome::Matches(matches) = command.parse_from([] as [&str; 0]).unwrap() else {
            panic!("empty input should produce matches");
        };
        let mut output = FailingWriter;
        let code = run_reported(
            &matches,
            "test",
            &mut output,
            false,
            |reporter| reporter.info("ready").map_err(TestError),
            |_| 3,
        );
        assert_eq!(code, 1);
    }

    #[test]
    fn run_reported_flushes_a_full_buffer_before_retrying_the_terminal_error() {
        let command = Command::builder("test", "test").build().unwrap();
        let ParseOutcome::Matches(matches) = command
            .parse_from(["--no-log-date", "--no-log-colorful"])
            .unwrap()
        else {
            panic!("reporter options should produce matches");
        };
        let mut output = TrackingWriter::default();
        let code = run_reported(
            &matches,
            "test",
            &mut output,
            false,
            |reporter| {
                let mut bytes = reporter.output.bytes.lock().unwrap();
                bytes.resize(MAX_REPORT_BYTES - 1, b'x');
                bytes.push(b'\n');
                Err(ExpectedError)
            },
            |_| 3,
        );
        let terminal_error = b"[test] Error: expected failure\n";
        assert_eq!(code, 3);
        assert_eq!(output.written, MAX_REPORT_BYTES + terminal_error.len());
        assert_eq!(output.last_write, terminal_error);
    }

    fn render_report(
        args: &[&str],
        environment: &[(&str, &str)],
        all_destinations_terminal: bool,
    ) -> String {
        let command = Command::builder("test", "test").build().unwrap();
        let request =
            ParseRequest::new(args.iter().copied()).environment(environment.iter().copied());
        let ParseOutcome::Matches(matches) = command.parse(request).unwrap() else {
            panic!("reporter options should produce matches");
        };
        let reporter =
            CliReporter::from_matches("test", &matches, all_destinations_terminal).unwrap();
        reporter.info("ready").unwrap();
        let mut output = Vec::new();
        reporter.flush_to(&mut output).unwrap();
        String::from_utf8(output).unwrap()
    }

    struct TestError(io::Error);

    impl fmt::Display for TestError {
        fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            self.0.fmt(formatter)
        }
    }

    struct ExpectedError;

    impl fmt::Display for ExpectedError {
        fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("expected failure")
        }
    }

    struct RepeatedErrorMarker;

    impl fmt::Display for RepeatedErrorMarker {
        fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("Error: Error: expected failure")
        }
    }

    struct EmptyError;

    impl fmt::Display for EmptyError {
        fn fmt(&self, _formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            Ok(())
        }
    }

    struct ControlledError;

    impl fmt::Display for ControlledError {
        fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
            formatter.write_str("failure\n\x1b]52;c;payload\x07")
        }
    }

    struct FailingWriter;

    impl io::Write for FailingWriter {
        fn write(&mut self, _buffer: &[u8]) -> io::Result<usize> {
            Err(io::Error::other("expected write failure"))
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    #[derive(Default)]
    struct TrackingWriter {
        written: usize,
        last_write: Vec<u8>,
    }

    impl io::Write for TrackingWriter {
        fn write(&mut self, buffer: &[u8]) -> io::Result<usize> {
            self.written += buffer.len();
            self.last_write.clear();
            if buffer.len() <= 1024 {
                self.last_write.extend_from_slice(buffer);
            }
            Ok(buffer.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }
}

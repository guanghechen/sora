use std::io;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Barrier, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

use guanghechen_reporter::{
    LogLevel, Reporter, ReporterFlight, ReporterOptions, ReporterOutput, resolve_log_level,
};

type CapturedRecord = (LogLevel, Vec<String>, String);

fn captured_reporter(
    prefix: Option<&str>,
    flight: ReporterFlight,
) -> (Reporter, Arc<Mutex<Vec<CapturedRecord>>>) {
    let records = Arc::new(Mutex::new(Vec::new()));
    let target = Arc::clone(&records);
    let output: Arc<dyn ReporterOutput> =
        Arc::new(move |level: LogLevel, parts: &[String], message: &str| {
            target
                .lock()
                .unwrap()
                .push((level, parts.to_vec(), message.to_owned()));
            Ok(())
        });
    let reporter = Reporter::with_options(ReporterOptions {
        prefix: prefix.map(ToOwned::to_owned),
        level: LogLevel::Info,
        flight,
        output: Some(output),
    })
    .unwrap();
    (reporter, records)
}

#[test]
fn levels_resolve_and_filter_in_order() {
    for (index, level) in LogLevel::ALL.into_iter().enumerate() {
        assert_eq!(LogLevel::parse_exact(level.as_str()), Some(level));
        assert_eq!(
            resolve_log_level(&level.as_str().to_uppercase()),
            Some(level)
        );
        assert_eq!(level.value(), index as u8 + 1);

        let reporter = Reporter::new();
        reporter.set_level(level);
        reporter.mock();
        for candidate in LogLevel::ALL {
            reporter.log(candidate, candidate.as_str()).unwrap();
        }
        assert_eq!(reporter.collect().len(), LogLevel::ALL.len() - index);
    }
    assert_eq!(LogLevel::parse_exact("INFO"), None);
    assert_eq!(resolve_log_level("verbose"), None);
}

#[test]
fn lazy_messages_run_only_after_filtering() {
    let reporter = Reporter::new();
    reporter.set_level(LogLevel::Warn);
    reporter.mock();
    let calls = AtomicUsize::new(0);
    reporter
        .log_lazy(LogLevel::Info, || {
            calls.fetch_add(1, Ordering::Relaxed);
            "hidden".to_owned()
        })
        .unwrap();
    reporter
        .log_lazy(LogLevel::Error, || {
            calls.fetch_add(1, Ordering::Relaxed);
            "visible".to_owned()
        })
        .unwrap();
    let entries = reporter.collect();
    assert_eq!(calls.load(Ordering::Relaxed), 1);
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].message, "visible");
}

#[test]
fn flight_updates_date_and_color_independently() {
    let (reporter, records) = captured_reporter(
        None,
        ReporterFlight {
            date: Some(true),
            color: Some(false),
        },
    );
    let context = reporter.with_prefix("worker").unwrap();
    reporter.info("dated").unwrap();
    context.set_flight(ReporterFlight {
        date: Some(false),
        color: None,
    });
    reporter.info("plain").unwrap();
    reporter.set_flight(ReporterFlight {
        date: None,
        color: Some(true),
    });
    context.info("colored").unwrap();

    let records = records.lock().unwrap();
    assert_eq!(records[0].1.len(), 2);
    assert!(records[0].1[0].ends_with('Z'));
    assert_eq!(records[0].1[1], "[info]");
    assert_eq!(records[1].1, ["[info]"]);
    assert!(records[2].1[0].contains("\x1b["));
}

#[test]
fn prefix_contexts_are_isolated_and_share_runtime_state() {
    let (reporter, records) = captured_reporter(
        Some("app"),
        ReporterFlight {
            date: Some(false),
            color: Some(false),
        },
    );
    let worker = reporter.with_prefix("worker").unwrap();
    let request = worker.with_prefix("request").unwrap();

    reporter.mock();
    request.info("request").unwrap();
    worker.info("worker").unwrap();
    reporter.info("app").unwrap();
    let entries = reporter.collect();
    assert_eq!(entries[0].prefixes, ["app", "worker", "request"]);
    assert_eq!(entries[1].prefixes, ["app", "worker"]);
    assert_eq!(entries[2].prefixes, ["app"]);

    worker.set_level(LogLevel::Warn);
    assert!(!reporter.enabled(LogLevel::Info));
    assert!(request.enabled(LogLevel::Warn));
    request.warn("shared").unwrap();
    let records = records.lock().unwrap();
    assert_eq!(records.len(), 1);
    assert_eq!(records[0].1, ["[app:worker:request]"]);
}

#[test]
fn concurrent_prefix_contexts_do_not_interfere() {
    let reporter = Reporter::with_options(ReporterOptions {
        prefix: Some("app".to_owned()),
        ..ReporterOptions::default()
    })
    .unwrap();
    let left = reporter.with_prefix("left").unwrap();
    let right = reporter.with_prefix("right").unwrap();
    reporter.mock();

    let barrier = Arc::new(Barrier::new(3));
    let left_worker = {
        let barrier = Arc::clone(&barrier);
        std::thread::spawn(move || {
            barrier.wait();
            left.info("left").unwrap();
        })
    };
    let right_worker = {
        let barrier = Arc::clone(&barrier);
        std::thread::spawn(move || {
            barrier.wait();
            right.info("right").unwrap();
        })
    };
    barrier.wait();
    left_worker.join().unwrap();
    right_worker.join().unwrap();

    let mut entries = reporter.collect();
    entries.sort_by(|left, right| left.message.cmp(&right.message));
    assert_eq!(entries.len(), 2);
    assert_eq!(entries[0].prefixes, ["app", "left"]);
    assert_eq!(entries[1].prefixes, ["app", "right"]);
}

#[test]
fn invalid_prefixes_leave_state_unchanged() {
    assert!(
        Reporter::with_options(ReporterOptions {
            prefix: Some("app:worker".to_owned()),
            ..ReporterOptions::default()
        })
        .is_err()
    );
    let reporter = Reporter::new();
    assert!(reporter.with_prefix("app:worker").is_err());
    reporter.mock();
    reporter.info("message").unwrap();
    assert!(reporter.collect()[0].prefixes.is_empty());
}

#[test]
fn prefixes_reject_control_characters() {
    let reporter = Reporter::new();
    for control in ['\0', '\n', '\r', '\t', '\x1b', '\x7f', '\u{85}'] {
        let prefix = format!("app{control}worker");
        let constructor_error = Reporter::with_options(ReporterOptions {
            prefix: Some(prefix.clone()),
            ..ReporterOptions::default()
        })
        .err()
        .expect("constructor prefix should be rejected");
        assert_eq!(
            constructor_error.to_string(),
            "prefix cannot contain control characters"
        );

        let derived_error = reporter
            .with_prefix(prefix)
            .err()
            .expect("derived prefix should be rejected");
        assert_eq!(
            derived_error.to_string(),
            "prefix cannot contain control characters"
        );
    }
}

#[test]
fn custom_outputs_and_capture_preserve_raw_messages() {
    let (reporter, records) = captured_reporter(
        None,
        ReporterFlight {
            date: Some(false),
            color: Some(false),
        },
    );
    let raw = "first\nsecond\x1b]52;c;payload\x07";

    reporter.info(raw).unwrap();
    assert_eq!(records.lock().unwrap()[0].2, raw);

    reporter.mock();
    reporter.info(raw).unwrap();
    assert_eq!(reporter.collect()[0].message, raw);
}

#[test]
fn mock_collect_captures_entries_and_restores_output() {
    let (reporter, records) = captured_reporter(
        Some("test"),
        ReporterFlight {
            date: Some(false),
            color: Some(false),
        },
    );
    reporter.mock();
    reporter.info("captured").unwrap();
    let entries = reporter.collect();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].level, LogLevel::Info);
    assert_eq!(entries[0].prefixes, ["test"]);
    assert_eq!(entries[0].message, "captured");
    assert!(entries[0].date >= UNIX_EPOCH && entries[0].date <= SystemTime::now());
    assert!(records.lock().unwrap().is_empty());

    reporter.info("output").unwrap();
    assert_eq!(records.lock().unwrap().len(), 1);
    assert!(reporter.collect().is_empty());
}

#[test]
fn a_finished_old_capture_cannot_publish_into_a_new_session() {
    let reporter = Reporter::new();
    reporter.mock();
    let entered = Arc::new(Barrier::new(2));
    let release = Arc::new(Barrier::new(2));
    let worker = {
        let reporter = reporter.clone();
        let entered = Arc::clone(&entered);
        let release = Arc::clone(&release);
        std::thread::spawn(move || {
            reporter
                .log_lazy(LogLevel::Info, || {
                    entered.wait();
                    release.wait();
                    "old".to_owned()
                })
                .unwrap();
        })
    };
    entered.wait();
    assert!(reporter.collect().is_empty());
    reporter.mock();
    release.wait();
    worker.join().unwrap();
    reporter.info("new").unwrap();
    let entries = reporter.collect();
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].message, "new");
}

#[test]
fn convenience_methods_cover_every_level() {
    let reporter = Reporter::new();
    reporter.set_level(LogLevel::Debug);
    reporter.mock();
    reporter.debug("debug").unwrap();
    reporter.info("info").unwrap();
    reporter.hint("hint").unwrap();
    reporter.warn("warn").unwrap();
    reporter.error("error").unwrap();
    assert_eq!(
        reporter
            .collect()
            .into_iter()
            .map(|entry| entry.level)
            .collect::<Vec<_>>(),
        LogLevel::ALL
    );
}

#[test]
fn output_failures_propagate_without_fallback() {
    let output: Arc<dyn ReporterOutput> =
        Arc::new(|_level: LogLevel, _parts: &[String], _message: &str| {
            Err(io::Error::new(io::ErrorKind::BrokenPipe, "closed"))
        });
    let reporter = Reporter::with_options(ReporterOptions {
        output: Some(output),
        ..ReporterOptions::default()
    })
    .unwrap();
    let error = reporter.info("message").unwrap_err();
    assert_eq!(error.kind(), io::ErrorKind::BrokenPipe);
}

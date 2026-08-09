use guanghechen_env::{
    EnvLimits, EnvRecord, LimitError, ParseWithLimitsError, ResolveError, ResolveFilesError,
    StringifyOptions, parse, parse_with_limits, resolve, resolve_upward, resolve_upward_files,
    resolve_upward_files_with_limits, resolve_upward_with_limits, resolve_with_limits, stringify,
    stringify_with_options,
};
use std::fmt::Write;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

static TEMP_SEQUENCE: AtomicUsize = AtomicUsize::new(0);

struct TempDir(PathBuf);

impl TempDir {
    fn new(label: &str) -> Self {
        let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "guanghechen-env-{label}-{}-{sequence}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("temporary directory should be created");
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn directory(&self, relative: &str) -> PathBuf {
        let path = self.0.join(relative);
        fs::create_dir_all(&path).expect("temporary directory should be created");
        path
    }

    fn write(&self, relative: &str, content: impl AsRef<[u8]>) -> PathBuf {
        let path = self.0.join(relative);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).expect("temporary parent should be created");
        }
        fs::write(&path, content).expect("temporary file should be written");
        path
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn parses_basic_values_comments_and_exports() {
    let env = parse("# comment\nexport NAME=myapp\nPORT=3000\nEMPTY=\nCOLOR=#fff").unwrap();
    assert_eq!(env.get("NAME").map(String::as_str), Some("myapp"));
    assert_eq!(env.get("PORT").map(String::as_str), Some("3000"));
    assert_eq!(env.get("EMPTY").map(String::as_str), Some(""));
    assert_eq!(env.get("COLOR").map(String::as_str), Some("#fff"));
}

#[test]
fn ignores_invalid_lines_and_inline_comments() {
    let env = parse(
        "NO_SEPARATOR\nNAME = value\n.key=value\nkey.=value\n-key=value\nkey-=value\n1KEY=value\nVALID=ok # note",
    )
    .unwrap();
    assert_eq!(env, EnvRecord::from([("VALID".into(), "ok".into())]));
}

#[test]
fn treats_dot_and_dash_as_literal_key_characters() {
    let env =
        parse("database.host=localhost\ndatabase-port=5432\nURL=${database.host}:${database-port}")
            .unwrap();
    assert_eq!(
        env.get("database.host").map(String::as_str),
        Some("localhost")
    );
    assert_eq!(env.get("database-port").map(String::as_str), Some("5432"));
    assert_eq!(env.get("URL").map(String::as_str), Some("localhost:5432"));

    let resolved = resolve("SERVICE.URL=${SERVICE-HOST}\nSERVICE-HOST=localhost").unwrap();
    assert_eq!(
        resolved.get("SERVICE.URL").map(String::as_str),
        Some("localhost")
    );
}

#[test]
fn accepts_standard_underscore_keys_and_crlf() {
    let env = parse("_PRIVATE=value\r\n__DOUBLE=other\rLAST=end").unwrap();
    assert_eq!(env.get("_PRIVATE").map(String::as_str), Some("value"));
    assert_eq!(env.get("__DOUBLE").map(String::as_str), Some("other"));
    assert_eq!(env.get("LAST").map(String::as_str), Some("end"));
}

#[test]
fn parses_quotes_escapes_and_colons() {
    let env = parse(
        "SINGLE='line1\\n${RAW}'\nDOUBLE=\"line1\\n\\\"quoted\\\"\\\\end\"\nURL=http://example.com:8080",
    )
    .unwrap();
    assert_eq!(
        env.get("SINGLE").map(String::as_str),
        Some("line1\\n${RAW}")
    );
    assert_eq!(
        env.get("DOUBLE").map(String::as_str),
        Some("line1\n\"quoted\"\\end")
    );
    assert_eq!(
        env.get("URL").map(String::as_str),
        Some("http://example.com:8080")
    );
}

#[test]
fn parses_multiline_single_and_double_quoted_values() {
    let env = parse(
        "NAME=world\r\nDOUBLE=\"hello ${NAME}\r\n# literal comment\r\nline3\\nend\"\r\nSINGLE='raw ${NAME}\r\n# literal comment'\r\nSPACES=\"first  \r\n  second\"\r\nNEXT=ok",
    )
    .unwrap();
    assert_eq!(
        env.get("DOUBLE").map(String::as_str),
        Some("hello world\n# literal comment\nline3\nend")
    );
    assert_eq!(
        env.get("SINGLE").map(String::as_str),
        Some("raw ${NAME}\n# literal comment")
    );
    assert_eq!(
        env.get("SPACES").map(String::as_str),
        Some("first  \n  second")
    );
    assert_eq!(env.get("NEXT").map(String::as_str), Some("ok"));
}

#[test]
fn parse_interpolates_only_preceding_declarations() {
    let env = parse("ROOT=/opt\nBIN=${ROOT}/bin\nFORWARD=${LATER}\nLATER=value").unwrap();
    assert_eq!(env.get("BIN").map(String::as_str), Some("/opt/bin"));
    assert_eq!(env.get("FORWARD").map(String::as_str), Some(""));
}

#[test]
fn parse_preserves_single_quoted_and_escaped_references() {
    let env = parse("ROOT=/opt\nSINGLE='${ROOT}/data'\nESCAPED=\\${ROOT}/data").unwrap();
    assert_eq!(env.get("SINGLE").map(String::as_str), Some("${ROOT}/data"));
    assert_eq!(env.get("ESCAPED").map(String::as_str), Some("${ROOT}/data"));
}

#[test]
fn parse_reports_unclosed_quotes_without_exposing_source_values() {
    let error = parse("VALID=ok\nNAME=\"sensitive-placeholder").unwrap_err();
    assert_eq!(error.line_number(), 2);
    assert_eq!(error.key(), "NAME");
    assert_eq!(
        error.to_string(),
        "Unclosed quote for environment variable NAME at line 2"
    );
    assert!(!format!("{error:?}").contains("sensitive-placeholder"));

    let multiline = parse("VALID=ok\nMESSAGE=\"first\nsecond-sensitive-placeholder").unwrap_err();
    assert_eq!(multiline.line_number(), 2);
    assert_eq!(multiline.key(), "MESSAGE");
    assert!(!format!("{multiline:?}").contains("second-sensitive-placeholder"));
}

#[test]
fn bounded_parse_and_resolve_stop_exponential_expansion_before_allocation() {
    let content = exponential_env(30);
    let limits = EnvLimits::new(4 * 1024)
        .with_maximum_source_bytes(1024)
        .with_maximum_value_bytes(1024);

    let parse_error = parse_with_limits(&content, &limits).unwrap_err();
    assert_eq!(
        parse_error.limit_error(),
        Some(&LimitError::ValueBytes {
            key: "V11".to_owned(),
            maximum: 1024,
        })
    );
    assert_eq!(
        parse_error.to_string(),
        "Expanded environment value V11 exceeds 1024 bytes"
    );

    let resolve_error = resolve_with_limits(&content, &limits).unwrap_err();
    assert_eq!(
        resolve_error.limit_error(),
        Some(&LimitError::ValueBytes {
            key: "V11".to_owned(),
            maximum: 1024,
        })
    );
}

#[test]
fn bounded_parse_charges_overwritten_values_and_redacts_source_values() {
    let redaction_limits = EnvLimits::new(1024).with_maximum_value_bytes(4);
    let error = parse_with_limits(
        "TOKEN=first-sensitive-placeholder\nTOKEN=next",
        &redaction_limits,
    )
    .unwrap_err();
    assert_eq!(
        error.limit_error(),
        Some(&LimitError::ValueBytes {
            key: "TOKEN".to_owned(),
            maximum: 4,
        })
    );
    assert!(!format!("{error:?}").contains("sensitive-placeholder"));

    let limits = EnvLimits::new(1024).with_maximum_total_value_bytes(4);
    let error = parse_with_limits("A=1234\nA=5678", &limits).unwrap_err();
    assert_eq!(
        error,
        ParseWithLimitsError::Limit(LimitError::TotalValueBytes { maximum: 4 })
    );
}

#[test]
fn bounded_operations_enforce_individual_and_total_source_bytes() {
    let error = parse_with_limits("A=123", &EnvLimits::new(4)).unwrap_err();
    assert_eq!(
        error,
        ParseWithLimitsError::Limit(LimitError::SourceBytes {
            source_index: 0,
            maximum: 4,
        })
    );

    let limits = EnvLimits::new(100).with_maximum_total_source_bytes(7);
    let error = resolve_upward_with_limits(["A=1\n", "B=2\n"], &limits).unwrap_err();
    assert_eq!(
        error.limit_error(),
        Some(&LimitError::TotalSourceBytes { maximum: 7 })
    );
}

#[test]
fn bounded_options_and_errors_preserve_the_underlying_contracts() {
    let limits = EnvLimits::new(1)
        .with_maximum_source_bytes(2)
        .with_maximum_total_source_bytes(3)
        .with_maximum_value_bytes(4)
        .with_maximum_total_value_bytes(5);
    assert_eq!(limits.maximum_source_bytes(), 2);
    assert_eq!(limits.maximum_total_source_bytes(), 3);
    assert_eq!(limits.maximum_value_bytes(), 4);
    assert_eq!(limits.maximum_total_value_bytes(), 5);

    let exact_limits = EnvLimits::new(6)
        .with_maximum_value_bytes(4)
        .with_maximum_total_value_bytes(4);
    let exact = parse_with_limits("A=1234", &exact_limits).unwrap();
    assert_eq!(exact.get("A").map(String::as_str), Some("1234"));

    let syntax_limits = EnvLimits::new(1024);
    let error = parse_with_limits("TOKEN='sensitive-placeholder", &syntax_limits).unwrap_err();
    assert_eq!(error.parse_error().unwrap().key(), "TOKEN");
    assert!(!format!("{error:?}").contains("sensitive-placeholder"));

    let error = resolve_with_limits("A=${A}", &syntax_limits).unwrap_err();
    assert_eq!(
        error.cycle_error().unwrap().variables(),
        ["A".to_owned(), "A".to_owned()]
    );
}

#[test]
fn resolve_supports_forward_and_transitive_references() {
    let env = resolve("A=${B}\nB=${C}\nC=resolved").unwrap();
    assert_eq!(env.get("A").map(String::as_str), Some("resolved"));
    assert_eq!(env.get("B").map(String::as_str), Some("resolved"));
    assert_eq!(env.get("C").map(String::as_str), Some("resolved"));
}

#[test]
fn resolve_uses_the_last_declaration_in_one_source() {
    let env = resolve("A=${B}\nA=${C}\nB=first\nC=last").unwrap();
    assert_eq!(env.get("A").map(String::as_str), Some("last"));
}

#[test]
fn resolve_upward_selects_declarations_before_resolving() {
    let parent = "A=${B}\nB=parent";
    let grandparent = "A=${C}\nB=grandparent\nC=grandparent";
    let env = resolve_upward([parent, grandparent]).unwrap();
    assert_eq!(env.get("A").map(String::as_str), Some("parent"));
    assert_eq!(env.get("B").map(String::as_str), Some("parent"));
    assert_eq!(env.get("C").map(String::as_str), Some("grandparent"));
}

#[test]
fn resolve_upward_resolves_ancestor_declarations_against_nearest_values() {
    let parent = "ROOT=/parent";
    let grandparent = "BIN=${ROOT}/bin";
    let env = resolve_upward([parent, grandparent]).unwrap();
    assert_eq!(env.get("BIN").map(String::as_str), Some("/parent/bin"));
}

#[test]
fn overridden_cycles_do_not_participate_in_the_final_graph() {
    let parent = "A=stable";
    let grandparent = "A=${B}\nB=${A}";
    let env = resolve_upward([parent, grandparent]).unwrap();
    assert_eq!(env.get("A").map(String::as_str), Some("stable"));
    assert_eq!(env.get("B").map(String::as_str), Some("stable"));
}

#[test]
fn resolve_reports_direct_and_transitive_cycles() {
    let direct = resolve("A=${A}").unwrap_err();
    assert_eq!(
        direct.cycle_error().unwrap().variables(),
        ["A".to_owned(), "A".to_owned()]
    );

    let transitive = resolve("A=${B}\nB=${C}\nC=${A}").unwrap_err();
    assert_eq!(
        transitive.cycle_error().unwrap().variables(),
        [
            "A".to_owned(),
            "B".to_owned(),
            "C".to_owned(),
            "A".to_owned()
        ]
    );
}

#[test]
fn resolve_handles_long_dependency_chains_iteratively() {
    let mut content = String::from("V0=resolved\n");
    for index in 1..10_000 {
        writeln!(content, "V{index}=${{V{}}}", index - 1).unwrap();
    }
    let env = resolve(&content).unwrap();
    assert_eq!(env.get("V9999").map(String::as_str), Some("resolved"));
}

#[test]
fn resolve_treats_unknown_and_literal_references_as_non_dependencies() {
    let env = resolve("UNKNOWN=${MISSING}/data\nSINGLE='${SINGLE}'\nESCAPED=\\${ESCAPED}").unwrap();
    assert_eq!(env.get("UNKNOWN").map(String::as_str), Some("/data"));
    assert_eq!(env.get("SINGLE").map(String::as_str), Some("${SINGLE}"));
    assert_eq!(env.get("ESCAPED").map(String::as_str), Some("${ESCAPED}"));
}

#[test]
fn resolve_identifies_the_failing_upward_source() {
    let error = resolve_upward(["A=valid", "B='unclosed"]).unwrap_err();
    assert_eq!(error.source_index(), Some(1));
    assert_eq!(error.parse_error().unwrap().line_number(), 1);
    assert!(matches!(error, ResolveError::Parse { .. }));
}

#[test]
fn stringify_quotes_and_escapes_special_values() {
    let env = EnvRecord::from([
        ("COLOR".into(), "#fff".into()),
        ("EMPTY".into(), String::new()),
        ("MESSAGE".into(), "line1\n\"line2\"".into()),
        ("PATH".into(), "C:\\workspace\\project".into()),
        ("PLAIN".into(), "value".into()),
        ("SPACE".into(), "hello world".into()),
    ]);
    assert_eq!(
        stringify(&env).unwrap(),
        "COLOR=\"#fff\"\nEMPTY=\nMESSAGE=\"line1\\n\\\"line2\\\"\"\nPATH=\"C:\\\\workspace\\\\project\"\nPLAIN=value\nSPACE=\"hello world\"\n"
    );
}

#[test]
fn stringify_can_exclude_keys_and_roundtrip_values() {
    let env = EnvRecord::from([
        ("COLOR".into(), "#fff".into()),
        ("MESSAGE".into(), "hello \"world\"".into()),
        ("OMIT".into(), "value".into()),
    ]);
    let options = StringifyOptions::new().exclude("OMIT");
    let content = stringify_with_options(&env, &options).unwrap();
    assert_eq!(
        parse(&content).unwrap(),
        EnvRecord::from([
            ("COLOR".into(), "#fff".into()),
            ("MESSAGE".into(), "hello \"world\"".into()),
        ])
    );
}

#[test]
fn stringify_roundtrips_values_ending_in_backslashes() {
    let env = EnvRecord::from([("TRAILING".into(), "directory\\".into())]);
    assert_eq!(parse(&stringify(&env).unwrap()).unwrap(), env);
}

#[test]
fn stringify_roundtrips_parser_sensitive_values() {
    let env = EnvRecord::from([
        ("A".into(), "resolved".into()),
        ("BACKSLASH_IN_TEMPLATE".into(), "${A\\B}".into()),
        ("DOUBLE_ESCAPED_TEMPLATE".into(), "\\\\${A}".into()),
        ("EMPTY_TEMPLATE".into(), "${}".into()),
        ("ESCAPED_TEMPLATE".into(), "\\${A}".into()),
        ("LITERAL_TEMPLATE".into(), "${A}".into()),
        ("MISSING_TEMPLATE".into(), "${MISSING}".into()),
        ("NESTED_TEMPLATE".into(), "${A${B}".into()),
        ("QUOTE_IN_TEMPLATE".into(), "${A\"B}".into()),
        ("SERVICE-HOST".into(), "localhost".into()),
        ("SERVICE.URL".into(), "https://localhost".into()),
        ("UNICODE_WHITESPACE".into(), "\u{00a0}".into()),
    ]);
    assert_eq!(parse(&stringify(&env).unwrap()).unwrap(), env);
}

#[test]
fn stringify_rejects_keys_the_parser_would_ignore() {
    for key in ["-BAD", "BAD-", ".BAD", "BAD.", "1KEY", "HAS SPACE"] {
        let env = EnvRecord::from([(key.to_owned(), "value".into())]);
        let error = stringify(&env).unwrap_err();
        assert_eq!(error.key(), key);
        assert_eq!(
            error.to_string(),
            format!("Invalid environment variable key: {key}")
        );
    }
}

#[test]
fn resolves_files_by_directory_then_file_name_priority() {
    let temp = TempDir::new("file-priority");
    let root = temp.directory("workspace");
    temp.directory("workspace/apps");
    let current = temp.directory("workspace/apps/api");
    temp.write(
        "workspace/local.conf",
        "A=root-local\nC=root-local\nROOT_ONLY=root\n",
    );
    temp.write("workspace/prod.conf", "C=root-prod\n");
    temp.write("workspace/base.conf", "A=root-base\nC=root-base\n");
    temp.write("workspace/apps/prod.conf", "A=parent-prod\nB=parent-prod\n");
    temp.write(
        "workspace/apps/base.conf",
        "A=parent-base\nB=parent-base\nDATA=${C}/data\n",
    );
    temp.write("workspace/apps/api/base.conf", "A=current-base\n");

    let env = resolve_upward_files(
        ["local.conf", "prod.conf", "base.conf"],
        &current,
        Some(&root),
    )
    .unwrap();
    assert_eq!(env.get("A").map(String::as_str), Some("current-base"));
    assert_eq!(env.get("B").map(String::as_str), Some("parent-prod"));
    assert_eq!(env.get("C").map(String::as_str), Some("root-local"));
    assert_eq!(env.get("DATA").map(String::as_str), Some("root-local/data"));
    assert_eq!(env.get("ROOT_ONLY").map(String::as_str), Some("root"));
}

#[test]
fn file_resolution_supports_optional_and_inclusive_root_directories() {
    let temp = TempDir::new("file-root");
    let boundary = temp.directory("workspace/project");
    let current = temp.directory("workspace/project/apps/api");
    temp.write("workspace/base.conf", "OUTSIDE=excluded\n");
    temp.write("workspace/project/base.conf", "BOUNDARY=included\n");

    let bounded = resolve_upward_files(["base.conf"], &current, Some(&boundary)).unwrap();
    assert_eq!(
        bounded.get("BOUNDARY").map(String::as_str),
        Some("included")
    );
    assert!(!bounded.contains_key("OUTSIDE"));

    let unbounded = resolve_upward_files(["base.conf"], &current, None).unwrap();
    assert_eq!(
        unbounded.get("OUTSIDE").map(String::as_str),
        Some("excluded")
    );
}

#[test]
fn file_resolution_rejects_paths_outside_the_same_directory() {
    let temp = TempDir::new("file-name");
    for file_name in ["", ".", "..", "../base.conf", "nested/base.conf"] {
        let error = resolve_upward_files([file_name], temp.path(), None).unwrap_err();
        assert!(matches!(error, ResolveFilesError::InvalidFileName { .. }));
    }
}

#[test]
fn file_resolution_reports_paths_without_exposing_values() {
    let temp = TempDir::new("file-errors");
    let current = temp.directory("workspace");
    let invalid = temp.write("workspace/bad.conf", "TOKEN=\"sensitive-placeholder");
    let error = resolve_upward_files(["bad.conf"], &current, Some(&current)).unwrap_err();
    let ResolveFilesError::Parse { path, error } = error else {
        panic!("expected parse error");
    };
    assert_eq!(path, fs::canonicalize(invalid).unwrap());
    assert_eq!(error.key(), "TOKEN");
    assert!(!format!("{error:?}").contains("sensitive-placeholder"));
}

#[test]
fn file_resolution_validates_directory_boundaries() {
    let first = TempDir::new("file-boundary-first");
    let second = TempDir::new("file-boundary-second");
    let file = first.write("not-a-directory", "value");
    let not_directory = resolve_upward_files(["base.conf"], &file, None).unwrap_err();
    assert!(matches!(
        not_directory,
        ResolveFilesError::NotDirectory { .. }
    ));

    let unrelated =
        resolve_upward_files(["base.conf"], first.path(), Some(second.path())).unwrap_err();
    assert!(matches!(
        unrelated,
        ResolveFilesError::RootDirectoryNotAncestor { .. }
    ));
}

#[test]
fn bounded_file_resolution_limits_loaded_and_expanded_bytes() {
    let temp = TempDir::new("file-limits");
    let current = temp.directory("workspace");
    temp.write("workspace/first.conf", "A=1\n");
    let second = temp.write("workspace/second.conf", "B=2\n");

    let source_limits = EnvLimits::new(100).with_maximum_total_source_bytes(7);
    let error = resolve_upward_files_with_limits(
        ["first.conf", "second.conf"],
        &current,
        Some(&current),
        &source_limits,
    )
    .unwrap_err();
    assert_eq!(
        error.limit_error(),
        Some(&LimitError::TotalSourceBytes { maximum: 7 })
    );
    let canonical_second = fs::canonicalize(second).unwrap();
    assert_eq!(error.limit_path(), Some(canonical_second.as_path()));

    temp.write("workspace/expanded.conf", exponential_env(30));
    let value_limits = EnvLimits::new(4 * 1024)
        .with_maximum_source_bytes(1024)
        .with_maximum_value_bytes(1024);
    let error = resolve_upward_files_with_limits(
        ["expanded.conf"],
        &current,
        Some(&current),
        &value_limits,
    )
    .unwrap_err();
    assert_eq!(
        error.limit_error(),
        Some(&LimitError::ValueBytes {
            key: "V11".to_owned(),
            maximum: 1024,
        })
    );
    assert_eq!(error.limit_path(), None);
}

#[test]
fn bounded_file_resolution_discards_invalid_utf8_source_bytes() {
    let temp = TempDir::new("file-invalid-utf8");
    let current = temp.directory("workspace");
    temp.write("workspace/invalid.conf", b"TOKEN=sensitive-placeholder\xff");

    let error = resolve_upward_files_with_limits(
        ["invalid.conf"],
        &current,
        Some(&current),
        &EnvLimits::new(1024),
    )
    .unwrap_err();
    let io_error = error
        .resolve_error()
        .and_then(ResolveFilesError::io_error)
        .expect("invalid UTF-8 should be reported as an I/O error");
    let source = io_error
        .get_ref()
        .expect("invalid UTF-8 should retain safe error metadata");

    assert!(source.downcast_ref::<std::str::Utf8Error>().is_some());
    assert!(
        source
            .downcast_ref::<std::string::FromUtf8Error>()
            .is_none()
    );
}

fn exponential_env(last: usize) -> String {
    let mut content = String::from("V0=x\n");
    for index in 1..=last {
        writeln!(content, "V{index}=${{V{}}}${{V{}}}", index - 1, index - 1).unwrap();
    }
    content
}

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

use guanghechen_commander::{
    Argument, ArgumentCardinality, Command, CompletionErrorKind, DiagnosticStage, InputSourceKind,
    OptionArity, OptionSpec, ParseErrorKind, ParseOutcome, ParseRequest, PresetConfig,
    PresetSourceState, ReasonCode, Value, ValueType, completion_command, completion_request,
};

static TEMP_SEQUENCE: AtomicUsize = AtomicUsize::new(0);

struct TempDir(PathBuf);

impl TempDir {
    fn new(label: &str) -> Self {
        let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "guanghechen-commander-preset-{label}-{}-{sequence}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("temporary directory should be created");
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
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
fn applies_profile_variant_options_and_environment_precedence() {
    let temp = TempDir::new("merge");
    temp.write(
        "base.env",
        "A=base-file\nB=base-file\nROOT=/opt\nPATH=${ROOT}/bin\n",
    );
    temp.write(
        "variant.env",
        "B=variant-file\nC=variant-file\nQUOTED=\"line1\\nline2\"\n",
    );
    let preset = temp.write(
        "preset.json",
        r#"{
          "version": 1,
          "profiles": {
            "dev": {
              "envFile": "base.env",
              "envs": {"B": "base-inline", "C": "base-inline"},
              "opts": {"mode": "fast", "retry": 2, "debug": false, "sizes": [-1, 2]},
              "defaultVariant": "local",
              "variants": {
                "local": {"opts": {"mode": "local"}},
                "staging": {
                  "envFile": "variant.env",
                  "envs": {"C": "variant-inline", "D": "variant-inline"},
                  "opts": {"retry": 4, "debug": true}
                }
              }
            }
          }
        }"#,
    );
    let command = option_command("cli", None);
    let outcome = command
        .parse_from([
            "build",
            &format!("--preset-file={}", preset.display()),
            "--preset-profile=dev:staging",
            "--retry",
            "8",
        ])
        .expect("preset should parse");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };

    assert_eq!(matches.option("mode"), Some(&Value::String("fast".into())));
    assert_eq!(matches.option("retry"), Some(&Value::Integer(8)));
    assert_eq!(matches.option("debug"), Some(&Value::Bool(true)));
    assert_eq!(matches.option("sizes"), Some(&Value::Integers(vec![-1, 2])));
    assert_eq!(matches.preset_env("A"), Some("base-file"));
    assert_eq!(matches.preset_env("B"), Some("variant-file"));
    assert_eq!(matches.preset_env("C"), Some("variant-inline"));
    assert_eq!(matches.preset_env("D"), Some("variant-inline"));
    assert_eq!(matches.preset_env("PATH"), Some("/opt/bin"));
    assert_eq!(matches.preset_env("QUOTED"), Some("line1\nline2"));
    assert_eq!(
        matches.sources().preset().state(),
        PresetSourceState::Applied
    );
    assert_eq!(
        matches.sources().preset().argv(),
        [
            "--mode=fast".to_owned(),
            "--retry=4".to_owned(),
            "--debug".to_owned(),
            "--sizes=-1".to_owned(),
            "--sizes=2".to_owned(),
        ]
    );
    assert_eq!(
        matches.effective_environment().get("C"),
        Some(&"variant-inline".to_owned())
    );
    let source = matches.preset().expect("preset source should be exposed");
    assert_eq!(source.profile(), "dev");
    assert_eq!(source.variant(), Some("staging"));
    assert_eq!(
        source.resolved_env_file(),
        Some(temp.path().join("variant.env").as_path())
    );

    let debug = format!("{matches:?}");
    assert!(debug.contains("QUOTED"));
    assert!(debug.contains("[REDACTED]"));
    assert!(!debug.contains("variant-inline"));
    assert!(!debug.contains("line1\\nline2"));
}

#[test]
fn preset_env_files_follow_the_shared_env_contract() {
    let temp = TempDir::new("env-contract");
    temp.write(
        "contract.env",
        concat!(
            "ROOT=/opt\n",
            "database.host=localhost\n",
            "database-port=5432\n",
            "URL=${database.host}:${database-port}\n",
            "EARLIER=${ROOT}/bin\n",
            "FORWARD=${LATER}/forward\n",
            "UNKNOWN=${MISSING}/data\n",
            "FROM_CALLER=${CALLER_ONLY}/data\n",
            "EMPTY_REFERENCE=${}\n",
            "UNCLOSED_REFERENCE=${ROOT\n",
            "LATER=ready\n",
            "MULTILINE=\"hello ${ROOT}\n",
            "# literal comment\n",
            "line3\"\n",
            "SINGLE='${ROOT}\n",
            "literal'\n",
            "ESCAPED=\\${ROOT}/literal\n",
            ".LEADING=ignored\n",
            "TRAILING.=ignored\n",
        ),
    );
    let preset = temp.write(
        "preset.json",
        r#"{"version":1,"profiles":{"dev":{"envFile":"contract.env"}}}"#,
    );
    let command = Command::builder("cli", "CLI")
        .build()
        .expect("command should build");
    let ParseOutcome::Matches(matches) = command
        .parse(
            ParseRequest::new([
                format!("--preset-file={}", preset.display()),
                "--preset-profile=dev".to_owned(),
            ])
            .environment([("CALLER_ONLY", "caller-value")]),
        )
        .expect("shared env syntax should parse")
    else {
        panic!("expected matches");
    };

    assert_eq!(matches.preset_env("database.host"), Some("localhost"));
    assert_eq!(matches.preset_env("database-port"), Some("5432"));
    assert_eq!(matches.preset_env("URL"), Some("localhost:5432"));
    assert_eq!(matches.preset_env("EARLIER"), Some("/opt/bin"));
    assert_eq!(matches.preset_env("FORWARD"), Some("/forward"));
    assert_eq!(matches.preset_env("UNKNOWN"), Some("/data"));
    assert_eq!(matches.preset_env("FROM_CALLER"), Some("/data"));
    assert_eq!(matches.preset_env("EMPTY_REFERENCE"), Some("${}"));
    assert_eq!(matches.preset_env("UNCLOSED_REFERENCE"), Some("${ROOT"));
    assert_eq!(
        matches.preset_env("MULTILINE"),
        Some("hello /opt\n# literal comment\nline3")
    );
    assert_eq!(matches.preset_env("SINGLE"), Some("${ROOT}\nliteral"));
    assert_eq!(matches.preset_env("ESCAPED"), Some("${ROOT}/literal"));
    assert_eq!(matches.preset_env(".LEADING"), None);
    assert_eq!(matches.preset_env("TRAILING."), None);
    assert_eq!(
        matches.effective_environment().get("CALLER_ONLY"),
        Some(&"caller-value".to_owned())
    );
}

#[test]
fn preset_env_files_reject_exponential_expansion_over_budget() {
    let temp = TempDir::new("env-expansion-limit");
    let mut content = String::from("V0=sensitive-placeholder\n");
    for index in 1..=30 {
        content.push_str(&format!(
            "V{index}=${{V{}}}${{V{}}}\n",
            index - 1,
            index - 1
        ));
    }
    temp.write("expanded.env", content);
    let preset = temp.write(
        "preset.json",
        r#"{"version":1,"profiles":{"dev":{"envFile":"expanded.env"}}}"#,
    );
    let command = Command::builder("cli", "CLI")
        .build()
        .expect("command should build");
    let error = command
        .parse_from([
            &format!("--preset-file={}", preset.display()),
            "--preset-profile=dev",
        ])
        .expect_err("expanded preset env should stop at the configured budget");

    assert_eq!(error.kind(), ParseErrorKind::Configuration);
    assert!(error.message().contains(
        "failed to parse preset env file \"expanded.env\": Expanded environment values exceed 1048576 total bytes"
    ));
    assert!(!error.message().contains("sensitive-placeholder"));
}

#[test]
fn preset_numbers_use_rust_native_string_formatting_for_cli_values() {
    let temp = TempDir::new("number-format");
    let preset = temp.write(
        "preset.json",
        r#"{"version":1,"profiles":{"dev":{"opts":{"mode":1e21}}}}"#,
    );
    let command = option_command("cli", None);
    let ParseOutcome::Matches(matches) = command
        .parse_from([
            "build",
            &format!("--preset-file={}", preset.display()),
            "--preset-profile=dev",
        ])
        .expect("numeric preset value should parse")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("mode"),
        Some(&Value::String("1000000000000000000000".into()))
    );
}

#[test]
fn resolves_command_defaults_independently_from_leaf_to_root() {
    let temp = TempDir::new("inherit");
    let preset = temp.write(
        "preset.json",
        r#"{
          "version": 1,
          "profiles": {
            "dev": {"opts": {"mode": "fast"}},
            "prod": {"opts": {"mode": "safe"}}
          }
        }"#,
    );
    let leaf = Command::builder("run", "Run")
        .preset(PresetConfig::new().profile("prod"))
        .option(OptionSpec::value(
            "mode",
            "Mode",
            ValueType::String,
            OptionArity::Required,
        ))
        .build()
        .expect("leaf should build");
    let command = Command::builder("cli", "CLI")
        .preset(PresetConfig::new().file(&preset).profile("dev"))
        .subcommand(leaf)
        .build()
        .expect("command should build");
    let ParseOutcome::Matches(matches) = command.parse_from(["run"]).expect("preset should parse")
    else {
        panic!("expected matches");
    };
    assert_eq!(matches.option("mode"), Some(&Value::String("safe".into())));

    let cli = temp.write(
        "cli.json",
        r#"{"version":1,"profiles":{"other":{"opts":{"mode":"cli"}}}}"#,
    );
    let ParseOutcome::Matches(matches) = command
        .parse_from([
            "run",
            &format!("--preset-file={}", cli.display()),
            "--preset-profile=other",
        ])
        .expect("CLI defaults should override command defaults")
    else {
        panic!("expected matches");
    };
    assert_eq!(matches.option("mode"), Some(&Value::String("cli".into())));
}

#[test]
fn missing_optional_leaf_file_falls_back_to_root_file() {
    let temp = TempDir::new("optional-fallback");
    let root_preset = temp.write(
        "root.json",
        r#"{"version":1,"profiles":{"cli.build":{"opts":{"mode":"root"}}}}"#,
    );
    let leaf = Command::builder("build", "Build")
        .preset(PresetConfig::new().optional_file(temp.path().join("missing.json")))
        .option(OptionSpec::value(
            "mode",
            "Mode",
            ValueType::String,
            OptionArity::Required,
        ))
        .build()
        .expect("leaf should build");
    let command = Command::builder("cli", "CLI")
        .preset(PresetConfig::new().optional_file(root_preset))
        .subcommand(leaf)
        .build()
        .expect("command should build");
    let ParseOutcome::Matches(matches) = command
        .parse_from(["build"])
        .expect("root preset should be selected")
    else {
        panic!("expected matches");
    };
    assert_eq!(matches.option("mode"), Some(&Value::String("root".into())));
}

#[test]
fn selects_profiles_by_canonical_command_suffix_then_manifest_fallbacks() {
    let temp = TempDir::new("selector");
    let preset = temp.write(
        "preset.json",
        r#"{
          "version": 1,
          "defaults": {"profile": "fallback"},
          "profiles": {
            "kit.build": {"opts": {"mode": "full"}},
            "build": {"opts": {"mode": "leaf"}},
            "fallback": {"opts": {"mode": "fallback"}},
            "default": {"opts": {"mode": "default"}}
          }
        }"#,
    );
    let command = option_command("kit", Some(PresetConfig::new().file(&preset)));
    let ParseOutcome::Matches(matches) = command
        .parse_from(["b"])
        .expect("alias route should select canonical suffix")
    else {
        panic!("expected matches");
    };
    assert_eq!(matches.option("mode"), Some(&Value::String("full".into())));
    assert_eq!(
        matches.preset().map(|source| source.profile()),
        Some("kit.build")
    );

    let fallback = temp.write(
        "fallback.json",
        r#"{"version":1,"defaults":{"profile":"fallback"},"profiles":{"fallback":{"opts":{"mode":"fallback"}}}}"#,
    );
    let command = option_command("kit", Some(PresetConfig::new().file(fallback)));
    let ParseOutcome::Matches(matches) = command.parse_from(["build"]).expect("fallback") else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("mode"),
        Some(&Value::String("fallback".into()))
    );
}

#[test]
fn directives_are_last_wins_and_stop_at_separator() {
    let temp = TempDir::new("directives");
    let first = temp.write(
        "first.json",
        r#"{"version":1,"profiles":{"dev":{"opts":{"mode":"first"}}}}"#,
    );
    let second = temp.write(
        "second.json",
        r#"{"version":1,"profiles":{"prod":{"opts":{"mode":"second"}}}}"#,
    );
    let command = option_command("cli", None);
    let ParseOutcome::Matches(matches) = command
        .parse_from([
            "build",
            "--preset-file",
            first.to_str().expect("UTF-8 path"),
            "--preset-profile=dev",
            &format!("--preset-file={}", second.display()),
            "--preset-profile",
            "prod",
        ])
        .expect("last directive should win")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("mode"),
        Some(&Value::String("second".into()))
    );

    let ParseOutcome::Matches(matches) = command
        .parse_from([
            "build",
            &format!("--preset-file={}", second.display()),
            "--preset-profile=@invalid",
            "--preset-profile=prod",
        ])
        .expect("a valid final profile should replace an invalid earlier value")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("mode"),
        Some(&Value::String("second".into()))
    );

    let error = command
        .parse_from([
            "build",
            &format!("--preset-file={}", second.display()),
            "--preset-profile=prod",
            "--preset-profile=@invalid",
        ])
        .expect_err("an invalid final profile should fail");
    assert_eq!(error.kind(), ParseErrorKind::Configuration);

    let ParseOutcome::Matches(matches) = command
        .parse_from([
            "build",
            "--preset-file=",
            &format!("--preset-file={}", second.display()),
            "--preset-profile=",
            "--preset-profile=prod",
        ])
        .expect("valid final directives should replace earlier empty values")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("mode"),
        Some(&Value::String("second".into()))
    );

    let error = command
        .parse_from([
            "build",
            &format!("--preset-file={}", second.display()),
            "--preset-profile=prod",
            "--preset-profile=",
        ])
        .expect_err("empty final directive should fail");
    assert_eq!(error.kind(), ParseErrorKind::Configuration);

    let error = command
        .parse_from([
            &format!("--preset-file={}", second.display()),
            "build",
            "--help",
        ])
        .expect_err("preset directives must not bypass leading-only routing");
    assert_eq!(error.kind(), ParseErrorKind::UnknownSubcommand);
    assert_eq!(error.command_path(), "cli");
    assert!(
        error
            .issues()
            .iter()
            .all(|issue| issue.reason_code() != ReasonCode::DidYouMeanSubcommand)
    );

    let data = Command::builder("cli", "CLI")
        .argument(Argument::new(
            "items",
            "Items",
            ArgumentCardinality::Variadic,
        ))
        .build()
        .expect("data command should build");
    let ParseOutcome::Matches(matches) = data
        .parse_from(["--", "--preset-file=/missing", "--preset-profile=dev"])
        .expect("directives after separator are data")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.argument("items"),
        Some(&Value::Strings(vec![
            "--preset-file=/missing".into(),
            "--preset-profile=dev".into(),
        ]))
    );
}

#[test]
fn controls_short_circuit_without_reading_preset_files() {
    let command = Command::builder("cli", "CLI")
        .version("1.0.0")
        .build()
        .expect("command should build");
    let help = command
        .parse_from(["--help", "--preset-file=/missing/preset.json"])
        .expect("help should not read preset");
    assert!(matches!(help, ParseOutcome::Help { .. }));
    assert_eq!(help.sources().preset().state(), PresetSourceState::Skipped);
    assert!(matches!(
        command
            .parse_from(["--preset-file=/missing/preset.json", "--version"])
            .expect("version should not read preset"),
        ParseOutcome::Version { .. }
    ));
}

#[test]
fn optional_command_file_can_be_absent_but_selected_files_are_required() {
    let command = Command::builder("cli", "CLI")
        .preset(PresetConfig::new().optional_file("missing.json"))
        .build()
        .expect("command should build");
    let ParseOutcome::Matches(matches) = command
        .parse_from_in([] as [&str; 0], Path::new("/definitely/missing"))
        .expect("optional file should be ignored")
    else {
        panic!("expected matches");
    };
    assert!(matches.preset().is_none());

    let error = command
        .parse_from(["--preset-file=/definitely/missing/preset.json"])
        .expect_err("CLI file is required");
    assert_eq!(error.kind(), ParseErrorKind::Configuration);
    assert!(error.message().contains("failed to read preset file"));

    let error = command
        .parse_from_in(["--preset-profile=dev"], Path::new("/definitely/missing"))
        .expect_err("CLI profile still requires an available file");
    assert_eq!(error.kind(), ParseErrorKind::Configuration);
    assert!(error.message().contains("cannot use \"--preset-profile\""));

    let profile_only = Command::builder("cli", "CLI")
        .preset(PresetConfig::new().profile("dev"))
        .build()
        .expect("command should build");
    let error = profile_only
        .parse_from([] as [&str; 0])
        .expect_err("profile requires a file");
    assert_eq!(error.kind(), ParseErrorKind::Configuration);
}

#[test]
fn rejects_invalid_manifest_selectors_and_generated_tokens() {
    let temp = TempDir::new("invalid");
    let invalid_default = temp.write(
        "invalid-default.json",
        r#"{"version":1,"profiles":{"dev":{"defaultVariant":"missing","variants":{"local":{}}}}}"#,
    );
    let command = option_command("cli", None);
    let error = command
        .parse_from([
            "build",
            &format!("--preset-file={}", invalid_default.display()),
            "--preset-profile=dev",
        ])
        .expect_err("invalid default variant should fail");
    assert_eq!(error.kind(), ParseErrorKind::Configuration);
    assert!(error.message().contains("is not found in variants"));

    let literal = temp.write(
        "literal.json",
        r#"{"version":1,"profiles":{"dev":{"opts":{"mode":"--preset-file=other.json"}}}}"#,
    );
    let ParseOutcome::Matches(matches) = command
        .parse_from([
            "build",
            &format!("--preset-file={}", literal.display()),
            "--preset-profile=dev",
        ])
        .expect("directive-shaped option value should remain literal")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("mode"),
        Some(&Value::String("--preset-file=other.json".into()))
    );

    let selector = command
        .parse_from([
            "build",
            &format!("--preset-file={}", literal.display()),
            "--preset-profile=dev:a:b",
        ])
        .expect_err("invalid selector should fail before reading profile");
    assert_eq!(selector.kind(), ParseErrorKind::Configuration);
    assert!(selector.message().contains("<profile>:<variant>"));
}

#[test]
fn preset_values_cannot_be_retokenized_as_options_or_controls() {
    let temp = TempDir::new("attached-values");
    let preset = temp.write(
        "preset.json",
        r#"{
          "version":1,
          "profiles":{
            "dev":{
              "opts":{
                "mode":"--debug",
                "items":["--debug","help","--preset-profile=other"]
              }
            }
          }
        }"#,
    );
    let command = Command::builder("cli", "CLI")
        .option(OptionSpec::value(
            "mode",
            "Mode",
            ValueType::String,
            OptionArity::Optional,
        ))
        .option(OptionSpec::value(
            "items",
            "Items",
            ValueType::String,
            OptionArity::Variadic,
        ))
        .option(OptionSpec::flag("debug", "Debug"))
        .build()
        .expect("command should build");
    let ParseOutcome::Matches(matches) = command
        .parse_from([
            &format!("--preset-file={}", preset.display()),
            "--preset-profile=dev",
        ])
        .expect("attached preset values should parse as data")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("mode"),
        Some(&Value::String("--debug".into()))
    );
    assert_eq!(
        matches.option("items"),
        Some(&Value::Strings(vec![
            "--debug".into(),
            "help".into(),
            "--preset-profile=other".into(),
        ]))
    );
    assert!(!matches.contains_option("debug"));
}

#[test]
fn rejects_malformed_manifest_shapes_with_configuration_errors() {
    let temp = TempDir::new("schema");
    let command = Command::builder("cli", "CLI")
        .build()
        .expect("command should build");
    let cases = [
        ("root.json", "[]", "root must be an object"),
        (
            "version.json",
            r#"{"version":2,"profiles":{}}"#,
            "\"version\" must be 1",
        ),
        (
            "defaults.json",
            r#"{"version":1,"defaults":[],"profiles":{}}"#,
            "\"defaults\" must be an object",
        ),
        (
            "default-profile.json",
            r#"{"version":1,"defaults":{"profile":1},"profiles":{}}"#,
            "\"defaults.profile\" must be a string",
        ),
        (
            "profiles.json",
            r#"{"version":1,"profiles":[]}"#,
            "\"profiles\" must be an object",
        ),
        (
            "profile.json",
            r#"{"version":1,"profiles":{"dev":[]}}"#,
            "profile \"dev\" must be an object",
        ),
        (
            "profile-envs.json",
            r#"{"version":1,"profiles":{"dev":{"envs":[]}}}"#,
            "profile \"dev\".envs must be an object",
        ),
        (
            "profile-opts.json",
            r#"{"version":1,"profiles":{"dev":{"opts":[]}}}"#,
            "profile \"dev\".opts must be an object",
        ),
        (
            "variants.json",
            r#"{"version":1,"profiles":{"dev":{"variants":[]}}}"#,
            "profile \"dev\".variants must be an object",
        ),
        (
            "variant.json",
            r#"{"version":1,"profiles":{"dev":{"variants":{"local":[]}}}}"#,
            "variants[\"local\"] must be an object",
        ),
        (
            "variant-env.json",
            r#"{"version":1,"profiles":{"dev":{"variants":{"local":{"envFile":1}}}}}"#,
            "variants[\"local\"].envFile must be a string",
        ),
        (
            "option.json",
            r#"{"version":1,"profiles":{"dev":{"opts":{"bad":{"nested":true}}}}}"#,
            "must be boolean|string|number|(string|number)[]",
        ),
        (
            "array.json",
            r#"{"version":1,"profiles":{"dev":{"opts":{"bad":["ok",true]}}}}"#,
            "must be a string or finite number",
        ),
    ];
    for (name, content, expected) in cases {
        let file = temp.write(name, content);
        let error = command
            .parse_from([
                &format!("--preset-file={}", file.display()),
                "--preset-profile=dev",
            ])
            .expect_err("invalid manifest should fail");
        assert_eq!(error.kind(), ParseErrorKind::Configuration, "{name}");
        assert!(
            error.message().contains(expected),
            "{name}: {}",
            error.message()
        );
    }
}

#[test]
fn preset_diagnostics_escape_decoded_json_controls() {
    let temp = TempDir::new("diagnostic-controls");
    let preset = temp.write(
        "preset.json",
        br#"{"version":1,"profiles":{"bad\nError: forged\u001b]52;c;payload\u0007":{}}}"#,
    );
    let command = Command::builder("cli", "CLI")
        .build()
        .expect("command should build");

    let error = command
        .parse_from([&format!("--preset-file={}", preset.display())])
        .expect_err("control-bearing profile name should fail");

    assert!(
        error
            .message()
            .contains(r"bad\nError: forged\u{1b}]52;c;payload\u{7}")
    );
    assert!(
        error
            .message()
            .chars()
            .all(|character| !character.is_control())
    );
    assert_eq!(error.to_string().lines().count(), 2);
}

#[test]
fn ignores_unknown_manifest_fields_for_forward_compatibility() {
    let temp = TempDir::new("unknown-fields");
    let preset = temp.write(
        "preset.json",
        r#"{
          "$schema":"https://example.invalid/preset.schema.json",
          "version":1,
          "futureRoot":true,
          "profiles":{
            "dev":{
              "futureProfile":{},
              "variants":{"local":{"futureVariant":1}}
            }
          }
        }"#,
    );
    let command = Command::builder("cli", "CLI")
        .build()
        .expect("command should build");
    let ParseOutcome::Matches(matches) = command
        .parse_from([
            &format!("--preset-file={}", preset.display()),
            "--preset-profile=dev:local",
        ])
        .expect("unknown manifest fields should be ignored")
    else {
        panic!("expected matches");
    };
    assert_eq!(matches.preset().map(|source| source.profile()), Some("dev"));
}

#[test]
fn controls_skip_preset_directive_validation() {
    let command = Command::builder("cli", "CLI")
        .build()
        .expect("command should build");
    for args in [
        vec!["--help", "--preset-file"],
        vec!["--help", "--preset-profile=@invalid"],
    ] {
        assert!(matches!(
            command.parse_from(args).expect("help should short-circuit"),
            ParseOutcome::Help { .. }
        ));
    }
}

#[test]
fn rejects_unknown_profiles_variants_and_missing_selection() {
    let temp = TempDir::new("unknown-selector");
    let preset = temp.write(
        "preset.json",
        r#"{"version":1,"profiles":{"dev":{"variants":{"local":{}}}}}"#,
    );
    let command = Command::builder("cli", "CLI")
        .build()
        .expect("command should build");
    for (selector, expected) in [
        ("prod", "unknown preset profile \"prod\""),
        ("dev:missing", "unknown preset variant \"missing\""),
    ] {
        let error = command
            .parse_from([
                &format!("--preset-file={}", preset.display()),
                &format!("--preset-profile={selector}"),
            ])
            .expect_err("unknown selector should fail");
        assert_eq!(error.kind(), ParseErrorKind::Configuration);
        assert!(error.message().contains(expected), "{}", error.message());
    }

    let missing = temp.write("missing.json", r#"{"version":1,"profiles":{"named":{}}}"#);
    let error = command
        .parse_from([&format!("--preset-file={}", missing.display())])
        .expect_err("manifest without a selectable profile should fail");
    assert!(error.message().contains("missing profile for preset file"));
}

#[test]
fn validates_only_selected_env_files_and_enforces_file_bounds() {
    let temp = TempDir::new("env-errors");
    temp.write("good.env", "NAME=good\n");
    let preset = temp.write(
        "preset.json",
        r#"{
          "version":1,
          "defaults":{"profile":"good"},
          "profiles":{
            "unused":{"envFile":"missing.env"},
            "good":{"envFile":"good.env"},
            "broken":{"envFile":"broken.env"}
          }
        }"#,
    );
    temp.write(
        "broken.env",
        "VALID=ok\nBROKEN=\"sensitive-placeholder\nsecond-sensitive-placeholder",
    );
    let command = Command::builder("cli", "CLI")
        .build()
        .expect("command should build");
    let ParseOutcome::Matches(matches) = command
        .parse_from([&format!("--preset-file={}", preset.display())])
        .expect("unselected missing env file should not be read")
    else {
        panic!("expected matches");
    };
    assert_eq!(matches.preset_env("NAME"), Some("good"));

    let error = command
        .parse_from([
            &format!("--preset-file={}", preset.display()),
            "--preset-profile=broken",
        ])
        .expect_err("broken selected env file should fail");
    assert_eq!(error.kind(), ParseErrorKind::Configuration);
    assert!(error.message().contains(
        "failed to parse preset env file \"broken.env\": Unclosed quote for environment variable BROKEN at line 2"
    ));
    assert!(!error.message().contains("sensitive-placeholder"));
    assert!(!format!("{error:?}").contains("sensitive-placeholder"));

    let oversized = temp.write("oversized.json", vec![b' '; 1024 * 1024 + 1]);
    let error = command
        .parse_from([&format!("--preset-file={}", oversized.display())])
        .expect_err("oversized manifest should fail");
    assert_eq!(error.kind(), ParseErrorKind::Configuration);
    assert!(error.message().contains("file exceeds 1048576 bytes"));
    assert_eq!(
        error.issues()[0].preset().map(|preset| preset.file()),
        Some(oversized.as_path())
    );
}

#[test]
fn preset_origin_is_reported_for_invalid_generated_argv() {
    let temp = TempDir::new("origin");
    let preset = temp.write(
        "preset.json",
        r#"{"version":1,"profiles":{"dev":{"opts":{"quiet":["orphan"]}}}}"#,
    );
    let command = Command::builder("cli", "CLI")
        .option(OptionSpec::flag("quiet", "Quiet"))
        .build()
        .expect("command should build");
    let error = command
        .parse_from([
            &format!("--preset-file={}", preset.display()),
            "--preset-profile=dev",
        ])
        .expect_err("orphan preset value should fail");
    assert_eq!(error.kind(), ParseErrorKind::InvalidBooleanValue);
    assert_eq!(error.hints().len(), 1);
    assert!(error.hints()[0].contains("preset.json#dev.opts"));
    let primary = &error.issues()[0];
    assert_eq!(
        primary.source().and_then(|source| source.primary()),
        Some(InputSourceKind::Preset)
    );
    assert_eq!(
        primary.preset().and_then(|preset| preset.profile()),
        Some("dev")
    );
    assert_eq!(primary.origin_stage(), Some(DiagnosticStage::Preset));
    assert_eq!(
        primary.preset().and_then(|preset| preset.option()),
        Some("quiet")
    );
    assert_eq!(
        error.issues()[1].reason_code(),
        ReasonCode::PresetTokenInjected
    );
}

#[test]
fn completion_conflicts_retain_mixed_user_and_preset_sources() {
    let temp = TempDir::new("mixed-completion");
    let preset = temp.write(
        "preset.json",
        r#"{"version":1,"defaults":{"profile":"dev"},"profiles":{"dev":{"opts":{"bash":true}}}}"#,
    );
    let completion = completion_command().expect("completion command should build");
    let root = Command::builder("cli", "CLI")
        .subcommand(completion)
        .build()
        .expect("root should build");
    let ParseOutcome::Matches(matches) = root
        .parse_from([
            "completion",
            &format!("--preset-file={}", preset.display()),
            "--fish",
        ])
        .expect("preset and user shell options should parse")
    else {
        panic!("expected matches");
    };

    let error = completion_request(&matches).expect_err("shell options should conflict");
    assert_eq!(error.kind(), CompletionErrorKind::ConflictingShells);
    let primary = &error.issues()[0];
    assert_eq!(primary.reason_code(), ReasonCode::OptionConflict);
    assert_eq!(primary.origin_stage(), Some(DiagnosticStage::Preset));
    let sources = primary
        .source()
        .expect("conflict should have source metadata");
    assert!(sources.related().contains(&InputSourceKind::User));
    assert!(sources.related().contains(&InputSourceKind::Preset));
    assert_eq!(
        primary.preset().and_then(|preset| preset.profile()),
        Some("dev")
    );
    assert_eq!(
        primary.preset().and_then(|preset| preset.option()),
        Some("bash")
    );
    assert!(
        error
            .issues()
            .iter()
            .any(|issue| issue.reason_code() == ReasonCode::MixedSourceConflict)
    );
    assert!(
        error
            .issues()
            .iter()
            .any(|issue| issue.reason_code() == ReasonCode::PresetTokenInjected)
    );
    let rendered = error.to_string();
    assert!(
        rendered
            .contains("Hint: option conflict involves both user input and preset-injected tokens")
    );
    assert!(
        rendered
            .contains("Hint: preset profile options contributed to the completion option conflict")
    );
}

#[test]
fn completion_conflicts_ignore_unrelated_applied_presets() {
    let temp = TempDir::new("unrelated-completion");
    let preset = temp.write(
        "preset.json",
        r#"{"version":1,"defaults":{"profile":"dev"},"profiles":{"dev":{"envs":{"MODE":"preset"}}}}"#,
    );
    let completion = completion_command().expect("completion command should build");
    let root = Command::builder("cli", "CLI")
        .subcommand(completion)
        .build()
        .expect("root should build");
    let ParseOutcome::Matches(matches) = root
        .parse_from([
            "completion",
            &format!("--preset-file={}", preset.display()),
            "--bash",
            "--fish",
        ])
        .expect("unrelated preset and user shell options should parse")
    else {
        panic!("expected matches");
    };

    let error = completion_request(&matches).expect_err("user shell options should conflict");
    let primary = &error.issues()[0];
    assert_eq!(
        primary.source().and_then(|source| source.primary()),
        Some(InputSourceKind::User)
    );
    assert_eq!(primary.origin_stage(), None);
    assert_eq!(primary.preset(), None);
    assert_eq!(error.issues().len(), 1);
}

#[test]
fn relative_manifest_and_env_paths_use_explicit_parse_directory() {
    let temp = TempDir::new("relative");
    temp.write("config/dev.env", "NAME=relative\n");
    temp.write(
        "config/preset.json",
        r#"{"version":1,"profiles":{"dev":{"envFile":"dev.env","opts":{"mode":"relative"}}}}"#,
    );
    let command = option_command("cli", None);
    let ParseOutcome::Matches(matches) = command
        .parse_from_in(
            [
                "build",
                "--preset-file=config/preset.json",
                "--preset-profile=dev",
            ],
            temp.path(),
        )
        .expect("relative files should resolve")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("mode"),
        Some(&Value::String("relative".into()))
    );
    assert_eq!(matches.preset_env("NAME"), Some("relative"));
    assert_eq!(
        matches.preset().map(|source| source.file()),
        Some(temp.path().join("config/preset.json").as_path())
    );
}

#[test]
fn relative_preset_paths_require_an_absolute_base_directory() {
    let command = option_command("cli", None);
    let error = command
        .parse_from_in(
            ["build", "--preset-file=config/preset.json"],
            Path::new("relative-base"),
        )
        .expect_err("relative base directories would implicitly depend on process cwd");
    assert_eq!(error.kind(), ParseErrorKind::Configuration);
    assert!(error.message().contains("non-absolute base directory"));
}

fn option_command(name: &str, preset: Option<PresetConfig>) -> Command {
    let child = Command::builder("build", "Build")
        .alias("b")
        .option(
            OptionSpec::value("mode", "Mode", ValueType::String, OptionArity::Required)
                .default(Value::String("safe".into())),
        )
        .option(
            OptionSpec::value("retry", "Retry", ValueType::Integer, OptionArity::Required)
                .default(Value::Integer(1)),
        )
        .option(OptionSpec::flag("debug", "Debug").default(Value::Bool(false)))
        .option(OptionSpec::value(
            "sizes",
            "Sizes",
            ValueType::Integer,
            OptionArity::Variadic,
        ))
        .build()
        .expect("child should build");
    let mut builder = Command::builder(name, "CLI").subcommand(child);
    if let Some(preset) = preset {
        builder = builder.preset(preset);
    }
    builder.build().expect("command should build")
}

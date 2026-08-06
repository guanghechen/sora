use std::io::Write;
use std::process::{Command as ProcessCommand, Stdio};

use guanghechen_commander::{
    Argument, ArgumentCardinality, Command, CompletionDestination, CompletionErrorKind,
    CompletionMode, CompletionPaths, DiagnosticStage, IssueScope, Matches, OptionArity, OptionSpec,
    ParseOutcome, ReasonCode, Shell, ValueType, complete, complete_bash_line, complete_request,
    completion_command, completion_request, generate_completion, resolve_home_path,
};

#[test]
fn completion_command_exposes_shell_write_and_query_words() {
    let command = completion_command().expect("completion command should build");
    let names = command
        .options()
        .iter()
        .map(OptionSpec::long)
        .collect::<Vec<_>>();

    assert_eq!(names, ["bash", "fish", "pwsh", "write"]);
    let write = command
        .options()
        .iter()
        .find(|option| option.long() == "write")
        .expect("write option should exist");
    assert_eq!(write.short_name(), Some('w'));
    assert_eq!(write.arity(), OptionArity::Optional);
    assert_eq!(command.arguments().len(), 1);
    assert_eq!(
        command.arguments()[0].cardinality(),
        ArgumentCardinality::Variadic
    );
}

#[test]
fn completion_request_requires_exactly_one_shell() {
    let command = command_tree();
    let missing = completion_matches(&command, ["completion"]);
    let error = completion_request(&missing).expect_err("shell should be required");
    assert_eq!(error.kind(), CompletionErrorKind::MissingShell);
    assert_eq!(error.command_path(), "kit completion");
    assert_eq!(error.issues()[0].stage(), DiagnosticStage::Completion);
    assert_eq!(error.issues()[0].scope(), IssueScope::Completion);
    assert_eq!(error.issues()[0].reason_code(), ReasonCode::CompletionError);

    let conflicting = completion_matches(&command, ["completion", "--bash", "--fish"]);
    let error = completion_request(&conflicting).expect_err("shells should be exclusive");
    assert_eq!(error.kind(), CompletionErrorKind::ConflictingShells);
}

#[test]
fn completion_request_preserves_write_and_query_modes() {
    let command = command_tree();
    let stdout = completion_request(&completion_matches(&command, ["completion", "--bash"]))
        .expect("stdout request should parse");
    assert_eq!(stdout.shell(), Shell::Bash);
    assert_eq!(
        stdout.destination(),
        Some(&CompletionDestination::StandardOutput)
    );
    assert!(stdout.words().is_empty());

    for args in [
        vec!["completion", "--fish", "--write"],
        vec!["completion", "--fish", "--write="],
        vec!["completion", "--fish", "-w"],
    ] {
        let request = completion_request(&completion_matches(&command, args))
            .expect("default-path write request should parse");
        assert_eq!(
            request.destination(),
            Some(&CompletionDestination::File { path: None })
        );
    }

    let custom = completion_request(&completion_matches(
        &command,
        ["completion", "--pwsh", "-w", "custom.ps1"],
    ))
    .expect("custom write path should parse");
    assert_eq!(
        custom.destination(),
        Some(&CompletionDestination::File {
            path: Some("custom.ps1".to_owned())
        })
    );

    let query = completion_request(&completion_matches(
        &command,
        ["completion", "--bash", "--", "repo", ""],
    ))
    .expect("query should parse");
    assert_eq!(query.words(), ["repo", ""]);
    assert!(matches!(query.mode(), CompletionMode::Query { .. }));

    let empty_query = completion_request(&completion_matches(
        &command,
        ["completion", "--bash", "--"],
    ))
    .expect("separator alone should select query mode");
    assert!(matches!(
        empty_query.mode(),
        CompletionMode::Query { words } if words.is_empty()
    ));

    let missing_separator = completion_request(&completion_matches(
        &command,
        ["completion", "--bash", "repo"],
    ))
    .expect_err("query words require an explicit separator");
    assert_eq!(
        missing_separator.kind(),
        CompletionErrorKind::QueryWithoutSeparator
    );

    let invalid = completion_request(&completion_matches(
        &command,
        ["completion", "--bash", "--write", "--", "repo", ""],
    ))
    .expect_err("query and write should be exclusive");
    assert_eq!(invalid.kind(), CompletionErrorKind::QueryWithWrite);

    let empty_invalid = completion_request(&completion_matches(
        &command,
        ["completion", "--bash", "--write", "--"],
    ))
    .expect_err("write and empty query should remain exclusive");
    assert_eq!(empty_invalid.kind(), CompletionErrorKind::QueryWithWrite);
}

#[test]
fn completion_paths_resolve_shell_defaults() {
    let paths = CompletionPaths::for_program("kit");
    assert_eq!(
        paths.path(Shell::Bash),
        "~/.local/share/bash-completion/completions/kit"
    );
    assert_eq!(
        paths.path(Shell::Fish),
        "~/.config/fish/completions/kit.fish"
    );
    assert_eq!(
        paths.path(Shell::PowerShell),
        "~/.config/pwsh/completions/kit.ps1"
    );

    let custom = CompletionPaths::new("bash", "fish", "pwsh");
    assert_eq!(custom.path(Shell::Bash), "bash");
    assert_eq!(custom.path(Shell::Fish), "fish");
    assert_eq!(custom.path(Shell::PowerShell), "pwsh");

    let hostile = CompletionPaths::for_program("../../.bashrc");
    for shell in [Shell::Bash, Shell::Fish, Shell::PowerShell] {
        assert!(!hostile.path(shell).contains(".."));
        assert!(!hostile.path(shell).contains("/.bashrc"));
    }
}

#[test]
fn completion_io_errors_expose_normalized_issues() {
    let error = resolve_home_path("~/completion", None)
        .expect_err("home expansion should require an explicit home directory");
    assert_eq!(error.issues()[0].stage(), DiagnosticStage::Completion);
    assert_eq!(error.issues()[0].scope(), IssueScope::Runtime);
    assert_eq!(error.issues()[0].reason_code(), ReasonCode::IoError);
}

#[test]
fn completion_metadata_contains_inherited_options_controls_and_aliases() {
    let meta = command_tree().completion_meta();
    let repo = meta
        .subcommands()
        .iter()
        .find(|subcommand| subcommand.name() == "repo")
        .expect("repo metadata should exist");
    let option_names = repo
        .options()
        .iter()
        .map(|option| option.long())
        .collect::<Vec<_>>();

    assert!(option_names.contains(&"format"));
    assert!(option_names.contains(&"help"));
    assert!(option_names.contains(&"version"));
    assert_eq!(repo.aliases(), ["r"]);
    assert!(
        !repo
            .options()
            .iter()
            .find(|option| option.long() == "help")
            .expect("help option should exist")
            .can_negate()
    );
}

#[test]
fn rust_engine_routes_only_leading_nested_commands() {
    let command = command_tree();
    assert_eq!(
        complete(&command, &words(["repo", "clone", "o"])),
        ["origin"]
    );
    assert_eq!(
        complete(&command, &words(["r", "clone", "u"])),
        ["upstream"]
    );
    assert!(complete(&command, &words(["--format", "fast", "repo", "clone", "o"])).is_empty());
}

#[test]
fn bash_line_query_is_cursor_scoped_and_quote_aware() {
    let command = command_tree();
    let line = "kit repo clone --format fast oXYZ";
    let point = line.find("oXYZ").expect("partial token should exist") + 1;
    assert_eq!(complete_bash_line(&command, line, point), ["origin"]);

    let quoted = "kit 'repo' clone u";
    assert_eq!(
        complete_bash_line(&command, quoted, quoted.len()),
        ["upstream"]
    );

    let request = completion_request(&completion_matches(
        &command,
        [
            "completion",
            "--bash",
            "--",
            "__guanghechen_commander_bash_line_v1__",
            quoted,
            &quoted.len().to_string(),
        ],
    ))
    .expect("Bash line request should parse");
    assert_eq!(
        complete_request(&command, &request).expect("Bash line request should complete"),
        ["upstream"]
    );

    let escapes = Command::builder("tool", "Test tool")
        .argument(
            Argument::new("value", "Value", ArgumentCardinality::Required).choices([r"a\q", "a q"]),
        )
        .build()
        .expect("escape command should build");
    let double_quoted = r#"tool "a\q"#;
    assert_eq!(
        complete_bash_line(&escapes, double_quoted, double_quoted.len()),
        [r"a\q"]
    );
    let escaped_space = r"tool a\ q";
    assert_eq!(
        complete_bash_line(&escapes, escaped_space, escaped_space.len()),
        ["a q"]
    );

    let ansi_c = r"tool $'a\x20q'";
    assert_eq!(complete_bash_line(&escapes, ansi_c, ansi_c.len()), ["a q"]);

    let nbsp = "a\u{00a0}b";
    let unicode_space = Command::builder("tool", "Test tool")
        .argument(Argument::new("value", "Value", ArgumentCardinality::Required).choices([nbsp]))
        .build()
        .expect("unicode-space command should build");
    let unicode_line = format!("tool {nbsp}");
    assert_eq!(
        complete_bash_line(&unicode_space, &unicode_line, unicode_line.len()),
        [nbsp]
    );
}

#[test]
fn bash_line_sentinel_is_scoped_to_bash_requests() {
    let command = command_tree();
    for shell in ["--fish", "--pwsh"] {
        let request = completion_request(&completion_matches(
            &command,
            [
                "completion",
                shell,
                "--",
                "__guanghechen_commander_bash_line_v1__",
                "repo",
                "",
            ],
        ))
        .expect("non-Bash query should parse");
        let candidates = complete_request(&command, &request)
            .expect("non-Bash sentinel should remain argv data");
        assert!(!candidates.contains(&"clone".to_owned()));
    }
}

#[test]
fn completion_queries_describe_options_and_subcommands_but_not_choices() {
    let command = command_tree();
    for shell in ["--bash", "--fish", "--pwsh"] {
        let request = completion_request(&completion_matches(
            &command,
            ["completion", shell, "--", "--v"],
        ))
        .expect("described option query should parse");
        assert_eq!(
            complete_request(&command, &request).expect("option query should complete"),
            [
                "--verbose\tVerbose output",
                "--version\tShow version number"
            ]
        );
    }

    for (words, expected) in [
        (
            vec!["r"],
            vec!["r\tRepository operations", "repo\tRepository operations"],
        ),
        (
            vec!["-v"],
            vec!["-V\tShow version number", "-v\tVerbose output"],
        ),
        (vec!["--no-v"], vec!["--no-verbose\tVerbose output"]),
        (vec!["--format", "f"], vec!["fast"]),
    ] {
        let mut args = vec!["completion", "--fish", "--"];
        args.extend(words);
        let request = completion_request(&completion_matches(&command, args))
            .expect("described query should parse");
        assert_eq!(
            complete_request(&command, &request).expect("described query should complete"),
            expected
        );
    }
}

#[test]
fn completion_query_records_normalize_description_delimiters() {
    let completion = completion_command().expect("completion should build");
    let command = Command::builder("tool", "Test tool")
        .option(OptionSpec::flag(
            "unsafe",
            "Unsafe\tline\nbreak\rcarriage\0nul",
        ))
        .option(
            OptionSpec::value("mode", "Mode", ValueType::String, OptionArity::Required)
                .choices(["bad\tvalue"]),
        )
        .subcommand(completion)
        .build()
        .expect("unsafe description command should build");
    let request = completion_request(&completion_matches(
        &command,
        ["completion", "--fish", "--", "--unsafe"],
    ))
    .expect("unsafe description query should parse");

    assert_eq!(
        complete_request(&command, &request).expect("unsafe description query should complete"),
        ["--unsafe\tUnsafe line break carriage nul"]
    );

    let request = completion_request(&completion_matches(
        &command,
        ["completion", "--fish", "--", "--mode", "bad"],
    ))
    .expect("unsafe candidate query should parse");
    assert!(
        complete_request(&command, &request)
            .expect("unsafe candidate query should complete")
            .is_empty()
    );
}

#[test]
fn rust_engine_completes_option_arity_and_choices() {
    let command = command_tree();
    assert_eq!(complete(&command, &words(["--format", "f"])), ["fast"]);
    assert_eq!(
        complete(&command, &words(["--format=f"])),
        ["--format=fast"]
    );
    assert_eq!(
        complete(&command, &words(["--FORMAT=f"])),
        ["--format=fast"]
    );
    assert_eq!(complete(&command, &words(["--FORMAT", "f"])), ["fast"]);
    assert_eq!(complete(&command, &words(["--tag", "one", "t"])), ["two"]);

    let optional_options = complete(&command, &words(["--output", "--v"]));
    assert_eq!(optional_options, ["--verbose", "--version"]);
    let variadic_options = complete(&command, &words(["--tag", "one", "--v"]));
    assert_eq!(variadic_options, ["--verbose", "--version"]);
    // An optional or variadic value list may already be complete, so an empty prefix still offers
    // options instead of dead-ending on an option that declares no choices.
    assert!(
        complete(&command, &words(["--output", ""])).contains(&"--verbose".to_owned()),
        "empty prefix after an optional value must still offer options"
    );
    assert!(
        complete(&command, &words(["--tag", "one", ""])).contains(&"--verbose".to_owned()),
        "empty prefix after a variadic value must still offer options"
    );
    assert!(complete(&command, &words(["--offset", "-"])).is_empty());
    assert_eq!(
        complete(&command, &words(["--offset=-"])),
        ["--offset=-1", "--offset=-2"]
    );

    let dash_choice = Command::builder("tool", "Test tool")
        .option(
            OptionSpec::value("mode", "Mode", ValueType::String, OptionArity::Required)
                .choices(["--literal"]),
        )
        .build()
        .expect("dash choice command should build");
    assert!(complete(&dash_choice, &words(["--mode", "--"])).is_empty());
    assert_eq!(
        complete(&dash_choice, &words(["--mode=--"])),
        ["--mode=--literal"]
    );
}

#[test]
fn rust_engine_completes_argument_choices_after_separator() {
    let command = command_tree();
    assert_eq!(
        complete(&command, &words(["repo", "clone", "--", "o"])),
        ["origin"]
    );
}

#[test]
fn generated_scripts_use_safe_runtime_transport() {
    let data_command = Command::builder("kit", "Unified tools")
        .argument(
            Argument::new("value", "Value", ArgumentCardinality::Required).choices([
                "$(printf CHOICE_EVAL)",
                "two words",
                "bad\tvalue",
                "bad\nvalue",
            ]),
        )
        .build()
        .expect("choice data should build");
    assert_eq!(
        complete(&data_command, &words(["$"])),
        ["$(printf CHOICE_EVAL)"]
    );
    assert_eq!(complete(&data_command, &words(["two"])), ["two words"]);
    assert_eq!(complete(&data_command, &words(["bad"])), ["bad\tvalue"]);

    let hostile_program = "kit; printf INJECTED\nprintf HEADER_INJECTED";
    let bash = generate_completion(hostile_program, Shell::Bash);
    let fish = generate_completion(hostile_program, Shell::Fish);
    let powershell = generate_completion(hostile_program, Shell::PowerShell);

    for script in [&bash, &fish, &powershell] {
        assert!(script.contains(" completion --"));
        assert!(!script.contains("\nprintf HEADER_INJECTED\n"));
        assert!(!script.contains("$(printf CHOICE_EVAL)"));
        assert!(!script.contains("two words"));
    }
    assert!(bash.contains("'kit; printf INJECTED\nprintf HEADER_INJECTED'"));
    assert!(fish.contains("'kit; printf INJECTED\nprintf HEADER_INJECTED'"));
    assert!(powershell.contains("'kit; printf INJECTED\nprintf HEADER_INJECTED'"));
    assert!(bash.contains("\"$COMP_LINE\" \"$COMP_POINT\""));
    assert!(!bash.contains("${COMP_WORDS"));
    assert!(bash.contains("IFS=$'\\t' read -r candidate _description"));
    assert!(fish.contains("$words \"$current\""));
    assert!(fish.contains("string split -m 1 \\t -- $record"));
    assert!(fish.contains("printf '%s\\t%s\\n' $candidate \"$fields[2]\""));
    assert!(powershell.contains("$_.Extent.EndOffset -lt $cursorPosition"));
    assert!(powershell.contains("Select-Object -Skip 1"));
    assert!(!powershell.contains("$completed[-1] -eq $wordToComplete"));
    assert!(powershell.contains("StringConstantExpressionAst"));
    assert!(powershell.contains("$_.Value"));
    assert!(powershell.contains("$fields = $record -split \"`t\", 2"));
    assert!(powershell.contains("$candidate.Replace(\"'\", \"''\")"));
    assert!(powershell.contains(
        "CompletionResult]::new($completionText, $candidate, 'ParameterValue', $description)"
    ));
}

#[test]
fn generated_scripts_are_deterministic_and_parse_in_installed_shells() {
    for shell in [Shell::Bash, Shell::Fish, Shell::PowerShell] {
        assert_eq!(
            generate_completion("kit", shell),
            generate_completion("kit", shell)
        );
    }
    assert_shell_syntax("bash", &["-n"], generate_completion("kit", Shell::Bash));
    assert_shell_syntax("fish", &["-n"], generate_completion("kit", Shell::Fish));
    assert_shell_syntax(
        "pwsh",
        &["-NoProfile", "-NonInteractive", "-Command", "-"],
        generate_completion("kit", Shell::PowerShell),
    );
}

#[cfg(unix)]
#[test]
fn generated_shells_forward_cursor_scoped_words_at_runtime() {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;

    let temp = std::env::temp_dir().join(format!("kit-completion-{}", std::process::id()));
    fs::create_dir_all(&temp).expect("temp directory should be created");
    let executable = temp.join("kit-completion-probe");
    let log = temp.join("args.log");
    fs::write(
        &executable,
        "#!/bin/sh\nprintf '%s\\n' \"$@\" > \"$KIT_COMPLETION_LOG\"\nprintf 'candidate\\tCandidate description\\n'\n",
    )
    .expect("probe executable should be written");
    let mut permissions = fs::metadata(&executable)
        .expect("probe metadata should exist")
        .permissions();
    permissions.set_mode(0o755);
    fs::set_permissions(&executable, permissions).expect("probe should be executable");
    let path = format!(
        "{}:{}",
        temp.display(),
        std::env::var("PATH").unwrap_or_default()
    );

    let bash_prefix = "kit-completion-probe repo clone --format fast o";
    let bash_script = format!(
        "{}\nprefix='{bash_prefix}'\nCOMP_LINE=\"$prefix trailing\"\nCOMP_POINT=${{#prefix}}\n_kit_completion_probe_completions\n",
        generate_completion("kit-completion-probe", Shell::Bash)
    );
    run_shell_script("bash", &bash_script, &path, &log);
    assert_eq!(
        fs::read_to_string(&log).expect("bash probe log should exist"),
        format!(
            "completion\n--bash\n--\n__guanghechen_commander_bash_line_v1__\n{bash_prefix} trailing\n{}\n",
            bash_prefix.len()
        )
    );
    fs::remove_file(&log).expect("bash probe log should be removed");

    let fish_script = format!(
        "{}\nfunction commandline\n  if contains -- -opc $argv\n    printf '%s\\n' kit-completion-probe repo clone\n  else if contains -- -ct $argv\n    printf ''\n  end\nend\n__kit_completion_probe_complete >/dev/null\n",
        generate_completion("kit-completion-probe", Shell::Fish)
    );
    run_shell_script("fish", &fish_script, &path, &log);
    assert_eq!(
        fs::read_to_string(&log).expect("fish probe log should exist"),
        "completion\n--fish\n--\nrepo\nclone\n\n"
    );

    fs::remove_dir_all(&temp).expect("temp directory should be removed");
}

#[cfg(unix)]
fn run_shell_script(program: &str, script: &str, path: &str, log: &std::path::Path) {
    let mut command = ProcessCommand::new(program);
    if program == "fish" {
        command.arg("--no-config");
    }
    let mut child = match command
        .env("PATH", path)
        .env("KIT_COMPLETION_LOG", log)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => panic!("failed to launch {program}: {error}"),
    };
    child
        .stdin
        .take()
        .expect("piped stdin should exist")
        .write_all(script.as_bytes())
        .expect("script should write to shell stdin");
    let output = child.wait_with_output().expect("shell probe should finish");
    assert!(
        output.status.success(),
        "{program} runtime probe failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

fn assert_shell_syntax(program: &str, args: &[&str], script: String) {
    let mut child = match ProcessCommand::new(program)
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return,
        Err(error) => panic!("failed to launch {program}: {error}"),
    };
    child
        .stdin
        .take()
        .expect("piped stdin should exist")
        .write_all(script.as_bytes())
        .expect("script should write to shell stdin");
    let output = child
        .wait_with_output()
        .expect("shell syntax check should finish");
    assert!(
        output.status.success(),
        "{program} rejected generated script: {}",
        String::from_utf8_lossy(&output.stderr)
    );
}

fn completion_matches<I, T>(command: &Command, args: I) -> Matches
where
    I: IntoIterator<Item = T>,
    T: Into<std::ffi::OsString>,
{
    let outcome = command
        .parse_from(args)
        .expect("completion args should parse");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };
    matches
}

fn words<const N: usize>(words: [&str; N]) -> Vec<String> {
    words.into_iter().map(ToOwned::to_owned).collect()
}

fn command_tree() -> Command {
    let clone = Command::builder("clone", "Clone a repository")
        .argument(
            Argument::new("remote", "Remote", ArgumentCardinality::Required)
                .choices(["origin", "upstream"]),
        )
        .build()
        .expect("clone should build");
    let repo = Command::builder("repo", "Repository operations")
        .version("0.1.0")
        .alias("r")
        .subcommand(clone)
        .build()
        .expect("repo should build");
    let completion = completion_command().expect("completion should build");

    Command::builder("kit", "Unified tools")
        .version("0.1.0")
        .option(OptionSpec::flag("verbose", "Verbose output").short('v'))
        .option(
            OptionSpec::value(
                "format",
                "Output format",
                ValueType::String,
                OptionArity::Required,
            )
            .short('f')
            .choices(["fast", "safe"]),
        )
        .option(
            OptionSpec::value("tag", "Tags", ValueType::String, OptionArity::Variadic)
                .choices(["one", "two"]),
        )
        .option(
            OptionSpec::value(
                "offset",
                "Offsets",
                ValueType::Integer,
                OptionArity::Variadic,
            )
            .choices(["-1", "-2"]),
        )
        .option(
            OptionSpec::value("output", "Output", ValueType::String, OptionArity::Optional)
                .choices(["file"]),
        )
        .subcommand(repo)
        .subcommand(completion)
        .build()
        .expect("root should build")
}

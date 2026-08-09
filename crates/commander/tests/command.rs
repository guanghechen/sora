use guanghechen_commander::{
    Argument, ArgumentCardinality, Builtins, ColorLevel, Command, DefinitionErrorKind,
    DiagnosticStage, IssueKind, IssueScope, OptionArity, OptionSpec, ParseErrorKind, ParseOutcome,
    ParseRequest, PresetSourceState, ReasonCode, Value, ValueType,
};

#[test]
fn rejects_invalid_definition_combinations() {
    let invalid_option = Command::builder("tool", "Test tool")
        .option(OptionSpec::value(
            "verbose",
            "Verbose output",
            ValueType::Boolean,
            OptionArity::Required,
        ))
        .build()
        .expect_err("boolean value option should be rejected");
    assert_eq!(invalid_option.kind(), DefinitionErrorKind::InvalidOption);

    let child = Command::builder("child", "Child")
        .option(OptionSpec::flag("quiet", "Quiet").short('v'))
        .build()
        .expect("child definition should be valid alone");
    let conflict = Command::builder("tool", "Test tool")
        .option(OptionSpec::flag("verbose", "Verbose").short('v'))
        .subcommand(child)
        .build()
        .expect_err("inherited short conflict should be rejected");
    assert_eq!(conflict.kind(), DefinitionErrorKind::OptionConflict);
    assert_eq!(conflict.command_path(), "tool child");
    assert!(conflict.hints().is_empty());
    assert_eq!(conflict.issues()[0].kind(), IssueKind::Error);
    assert_eq!(conflict.issues()[0].stage(), DiagnosticStage::Definition);
    assert_eq!(conflict.issues()[0].scope(), IssueScope::Option);
    assert_eq!(
        conflict.issues()[0].reason_code(),
        ReasonCode::OptionConflict
    );
    assert_eq!(
        conflict.to_string(),
        concat!(
            "Error: short option \"-v\" conflicts between \"--verbose\" and \"--quiet\"\n",
            "Run \"tool child --help\" for usage.",
        )
    );

    let invalid_default = Command::builder("tool", "Test tool")
        .option(
            OptionSpec::value("mode", "Mode", ValueType::String, OptionArity::Required)
                .choices(["fast", "safe"])
                .default(Value::String("unknown".to_owned())),
        )
        .build()
        .expect_err("default outside choices should be rejected");
    assert_eq!(invalid_default.kind(), DefinitionErrorKind::InvalidOption);

    let invalid_choice = Command::builder("tool", "Test tool")
        .option(
            OptionSpec::value("count", "Count", ValueType::Integer, OptionArity::Required)
                .choices(["one"]),
        )
        .build()
        .expect_err("choice incompatible with value type should be rejected");
    assert_eq!(invalid_choice.kind(), DefinitionErrorKind::InvalidOption);

    let boolean_coercer = Command::builder("tool", "Test tool")
        .option(OptionSpec::flag("verbose", "Verbose").coerce(|_| Ok(Value::Bool(true))))
        .build()
        .expect_err("boolean coercion has no raw scalar input");
    assert_eq!(boolean_coercer.kind(), DefinitionErrorKind::InvalidOption);

    let empty_example = Command::builder("tool", "Test tool")
        .example(guanghechen_commander::Example::new(" ", "--help", "Help"))
        .build()
        .expect_err("example fields should be non-empty after trimming");
    assert_eq!(empty_example.kind(), DefinitionErrorKind::InvalidCommand);
}

#[test]
fn definition_diagnostics_escape_controls_without_changing_command_path_data() {
    let command_path = "bad\nError: forged\r\t\x1b]52;c;payload\x07\u{85}";
    let escaped = r"bad\nError: forged\r\t\u{1b}]52;c;payload\u{7}\u{85}";
    let error = Command::builder(command_path, "Test tool")
        .build()
        .expect_err("control-bearing command name should be rejected");

    assert_eq!(error.command_path(), command_path);
    assert_eq!(
        error.message(),
        format!("invalid command name \"{escaped}\"")
    );
    assert_eq!(
        error.to_string(),
        format!("Error: invalid command name \"{escaped}\"\nRun \"{escaped} --help\" for usage.")
    );
}

#[test]
fn parse_diagnostics_escape_controls_without_changing_parsed_values() {
    let raw = "中文😀bad\nError: forged\r\t\x1b]52;c;payload\x07\u{85}\u{2028}\u{2029}\u{202e}\u{2066}\u{2069}\u{200b}";
    let escaped = r"中文😀bad\nError: forged\r\t\u{1b}]52;c;payload\u{7}\u{85}\u{2028}\u{2029}\u{202e}\u{2066}\u{2069}\u{200b}";
    let coercer_message = raw.to_owned();
    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .option(OptionSpec::value(
            "count",
            "Count",
            ValueType::Integer,
            OptionArity::Required,
        ))
        .option(OptionSpec::value(
            "label",
            "Label",
            ValueType::String,
            OptionArity::Required,
        ))
        .option(
            OptionSpec::value(
                "coerced",
                "Coerced",
                ValueType::String,
                OptionArity::Required,
            )
            .coerce(move |_| Err(coercer_message.clone())),
        )
        .build()
        .expect("command should build");

    let error = command
        .parse_from([format!("--count={raw}")])
        .expect_err("invalid integer should fail");
    assert_eq!(
        error.message(),
        format!("invalid integer \"{escaped}\" for option \"--count\"")
    );
    assert_eq!(error.issues()[0].message(), error.message());
    let rendered = error.to_string();
    assert_eq!(rendered.lines().count(), 2);
    assert_eq!(
        rendered
            .lines()
            .filter(|line| line.starts_with("Error:"))
            .count(),
        1
    );
    assert_eq!(
        rendered
            .chars()
            .filter(|character| character.is_control())
            .collect::<Vec<_>>(),
        ['\n']
    );

    let coercer_error = command
        .parse_from(["--coerced=value"])
        .expect_err("custom coercer should fail");
    assert_eq!(coercer_error.message(), escaped);

    let ParseOutcome::Matches(matches) = command
        .parse_from([format!("--label={raw}")])
        .expect("string value should parse unchanged")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("label"),
        Some(&Value::String(raw.to_owned()))
    );
}

#[test]
fn validates_required_options_and_scalar_coercers() {
    let invalid_required_flag = Command::builder("tool", "Test tool")
        .option(OptionSpec::flag("token", "Token").required())
        .build()
        .expect_err("required presence needs a value-taking option");
    assert_eq!(
        invalid_required_flag.kind(),
        DefinitionErrorKind::InvalidOption
    );

    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .option(
            OptionSpec::value("mode", "Mode", ValueType::String, OptionArity::Required)
                .required()
                .choices(["FAST"])
                .coerce(|raw| Ok(Value::String(raw.to_ascii_uppercase()))),
        )
        .build()
        .expect("required coerced option should build");

    let missing = command
        .parse_from([] as [&str; 0])
        .expect_err("required option should be present");
    assert_eq!(missing.kind(), ParseErrorKind::MissingRequiredOption);

    let outcome = command
        .parse_from(["--mode", "fast"])
        .expect("coercion should run before choices validation");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("mode"),
        Some(&Value::String("FAST".to_owned()))
    );
}

#[test]
fn supports_argument_defaults_and_scalar_coercion() {
    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .argument(
            Argument::new("count", "Count", ArgumentCardinality::Optional)
                .choices(["2", "4"])
                .default(Value::Integer(2))
                .coerce(|raw| {
                    raw.parse::<i64>()
                        .map(Value::Integer)
                        .map_err(|_| format!("invalid count \"{raw}\""))
                }),
        )
        .build()
        .expect("optional coerced argument should build");

    let ParseOutcome::Matches(defaulted) = command
        .parse_from([] as [&str; 0])
        .expect("argument default should apply")
    else {
        panic!("expected matches");
    };
    assert_eq!(defaulted.argument("count"), Some(&Value::Integer(2)));

    let ParseOutcome::Matches(parsed) = command
        .parse_from(["4"])
        .expect("argument should be coerced")
    else {
        panic!("expected matches");
    };
    assert_eq!(parsed.argument("count"), Some(&Value::Integer(4)));
    assert_eq!(parsed.raw_arguments(), ["4"]);

    let invalid = command
        .parse_from(["not-a-number"])
        .expect_err("coercion failure should retain invalid-type semantics");
    assert_eq!(invalid.kind(), ParseErrorKind::InvalidArgumentType);
    assert_eq!(invalid.issues()[0].reason_code(), ReasonCode::InvalidType);
}

#[test]
fn rejects_non_finite_argument_defaults() {
    for default in [f64::NAN, f64::INFINITY, f64::NEG_INFINITY] {
        let error = Command::builder("tool", "Test tool")
            .argument(
                Argument::new("value", "Value", ArgumentCardinality::Optional)
                    .default(Value::Number(default)),
            )
            .build()
            .expect_err("non-finite argument default should be rejected");
        assert_eq!(error.kind(), DefinitionErrorKind::InvalidArgument);
        assert_eq!(error.message(), "invalid default for argument \"value\"");
    }
}

#[test]
fn separates_local_effective_and_builtin_option_views() {
    let child = Command::builder("child", "Child")
        .option(OptionSpec::flag("target", "Target"))
        .build()
        .expect("child should build");
    let command = Command::builder("tool", "Test tool")
        .option(OptionSpec::flag("verbose", "Verbose"))
        .subcommand(child)
        .build()
        .expect("command should build");

    let ParseOutcome::Matches(matches) = command
        .parse_from(["child", "--verbose", "--target", "--no-color"])
        .expect("options should parse")
    else {
        panic!("expected matches");
    };
    assert_eq!(matches.option("verbose"), None);
    assert_eq!(matches.option("target"), Some(&Value::Bool(true)));
    assert_eq!(
        matches.effective_option("verbose"),
        Some(&Value::Bool(true))
    );
    assert!(matches.contains_effective_option("verbose"));
    assert_eq!(
        matches.builtins().option("color"),
        Some(&Value::Bool(false))
    );
    assert!(matches.builtins().contains("color"));
}

#[test]
fn resolves_fine_grained_builtins_and_devmode_log_level() {
    let command = Command::builder("tool", "Test tool")
        .version("1.0.0")
        .builtins(
            Builtins::disabled()
                .color(true)
                .devmode(true)
                .log_level(true),
        )
        .build()
        .expect("fine-grained builtins should build");

    let ParseOutcome::Matches(devmode) = command
        .parse_from(["--devmode"])
        .expect("enabled builtin should parse")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        devmode.builtins().option("logLevel"),
        Some(&Value::String("debug".to_owned()))
    );

    let ParseOutcome::Matches(explicit) = command
        .parse_from(["--devmode", "--log-level", "warn"])
        .expect("explicit log level should win")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        explicit.builtins().option("logLevel"),
        Some(&Value::String("warn".to_owned()))
    );

    for disabled in ["--silent", "--version"] {
        let error = command
            .parse_from([disabled])
            .expect_err("disabled builtin should be unknown");
        assert_eq!(error.kind(), ParseErrorKind::UnknownOption);
    }
}

#[test]
fn parse_request_exposes_input_snapshots_and_resolves_color_policy() {
    let command = command_tree();
    let request = ParseRequest::new(["c", "-e", "1"])
        .environment([("MODE", "test"), ("NO_COLOR", "1")])
        .max_color_level(ColorLevel::Ansi256);
    let ParseOutcome::Matches(matches) = command.parse(request).expect("request should parse")
    else {
        panic!("expected matches");
    };

    assert_eq!(matches.sources().user().command_path(), ["c"]);
    assert_eq!(
        matches.sources().user().canonical_command_path(),
        ["kit", "calc"]
    );
    assert_eq!(matches.sources().user().argv(), ["-e", "1"]);
    assert_eq!(
        matches.sources().user().environment().get("MODE"),
        Some(&"test".to_owned())
    );
    assert_eq!(matches.sources().preset().state(), PresetSourceState::None);
    assert_eq!(
        matches.effective_environment().get("MODE"),
        Some(&"test".to_owned())
    );
    assert_eq!(matches.builtins().color_level(), ColorLevel::None);
    assert_eq!(
        matches.builtins().option("color"),
        Some(&Value::Bool(false))
    );

    let ParseOutcome::Matches(explicit) = command
        .parse(
            ParseRequest::new(["calc", "-e", "1", "--color"])
                .environment([("NO_COLOR", "1")])
                .max_color_level(ColorLevel::Ansi256),
        )
        .expect("explicit color should override NO_COLOR")
    else {
        panic!("expected matches");
    };
    assert_eq!(explicit.builtins().color_level(), ColorLevel::Ansi256);
    assert_eq!(
        explicit.builtins().option("color"),
        Some(&Value::Bool(true))
    );
}

#[test]
fn debug_redacts_environment_values_across_parse_types() {
    const ENVIRONMENT_KEY: &str = "COMMANDER_DEBUG_SECRET";
    const ENVIRONMENT_VALUE: &str = "commander-debug-secret-value";

    let request = ParseRequest::new(["calc", "-e", "visible-expression"])
        .environment([(ENVIRONMENT_KEY, ENVIRONMENT_VALUE)]);
    assert_redacted_debug(&request, ENVIRONMENT_KEY, ENVIRONMENT_VALUE);
    assert!(format!("{request:?}").contains("visible-expression"));

    let command = command_tree();
    for argv in [
        vec!["calc", "-e", "visible-expression"],
        vec!["calc", "--help"],
        vec!["calc", "--version"],
    ] {
        let outcome = command
            .parse(ParseRequest::new(argv).environment([(ENVIRONMENT_KEY, ENVIRONMENT_VALUE)]))
            .expect("request should produce a debug-formattable outcome");
        assert_redacted_debug(&outcome, ENVIRONMENT_KEY, ENVIRONMENT_VALUE);
        assert_eq!(
            outcome.sources().user().environment().get(ENVIRONMENT_KEY),
            Some(&ENVIRONMENT_VALUE.to_owned())
        );
    }
}

fn assert_redacted_debug(
    value: &impl std::fmt::Debug,
    environment_key: &str,
    environment_value: &str,
) {
    let output = format!("{value:?}");
    assert!(output.contains(environment_key));
    assert!(output.contains("[REDACTED]"));
    assert!(!output.contains(environment_value));
}

#[cfg(unix)]
#[test]
fn parse_request_rejects_invalid_unicode_in_environment() {
    use std::os::unix::ffi::OsStringExt;

    let command = Command::builder("tool", "Test tool")
        .build()
        .expect("command should build");
    let error = command
        .parse(ParseRequest::new([] as [&str; 0]).environment([(
            std::ffi::OsString::from("KEY"),
            std::ffi::OsString::from_vec(vec![0xff]),
        )]))
        .expect_err("invalid UTF-8 environment should fail at the boundary");
    assert_eq!(error.kind(), ParseErrorKind::InvalidUnicode);
    assert!(error.message().contains("environment values"));
}

#[test]
fn numeric_choices_compare_typed_values() {
    let command = Command::builder("tool", "Test tool")
        .option(
            OptionSpec::value(
                "integer",
                "Integer",
                ValueType::Integer,
                OptionArity::Required,
            )
            .choices(["01"])
            .default(Value::Integer(1)),
        )
        .option(
            OptionSpec::value("number", "Number", ValueType::Number, OptionArity::Required)
                .choices(["1.0"])
                .default(Value::Number(1.0)),
        )
        .build()
        .expect("typed-equivalent numeric defaults should build");

    let outcome = command
        .parse_from(["--integer", "1", "--number", "1"])
        .expect("typed-equivalent numeric choices should parse");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };
    assert_eq!(matches.option("integer"), Some(&Value::Integer(1)));
    assert_eq!(matches.option("number"), Some(&Value::Number(1.0)));
}

#[test]
fn parses_javascript_compatible_numeric_literals() {
    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .option(
            OptionSpec::value(
                "integer",
                "Integer",
                ValueType::Integer,
                OptionArity::Required,
            )
            .choices(["-0x10", "1e3"]),
        )
        .option(
            OptionSpec::value("number", "Number", ValueType::Number, OptionArity::Required)
                .choices(["0b101", "1_2.5_0e+1"]),
        )
        .build()
        .expect("numeric literal choices should build");

    let ParseOutcome::Matches(radix) = command
        .parse_from(["--integer=-0x10", "--number", "0b101"])
        .expect("radix literals should parse")
    else {
        panic!("expected matches");
    };
    assert_eq!(radix.option("integer"), Some(&Value::Integer(-16)));
    assert_eq!(radix.option("number"), Some(&Value::Number(5.0)));

    let ParseOutcome::Matches(exponent) = command
        .parse_from(["--integer", "1_000", "--number", "12.50e1"])
        .expect("typed-equivalent decimal literals should match choices")
    else {
        panic!("expected matches");
    };
    assert_eq!(exponent.option("integer"), Some(&Value::Integer(1_000)));
    assert_eq!(exponent.option("number"), Some(&Value::Number(125.0)));

    for invalid in ["1__0", "0x_10", "1.5", "9223372036854775808"] {
        let error = command
            .parse_from([&format!("--integer={invalid}"), "--number", "5"])
            .expect_err("invalid integer literal should fail");
        assert_eq!(error.kind(), ParseErrorKind::InvalidOptionValue);
    }

    let exact = Command::builder("exact", "Exact integer")
        .builtins(Builtins::disabled())
        .option(OptionSpec::value(
            "integer",
            "Integer",
            ValueType::Integer,
            OptionArity::Required,
        ))
        .build()
        .expect("exact integer command should build");
    let ParseOutcome::Matches(matches) = exact
        .parse_from(["--integer=9007199254740993.0"])
        .expect("decimal integer conversion must not round through f64")
    else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("integer"),
        Some(&Value::Integer(9_007_199_254_740_993))
    );
}

#[test]
fn rejects_names_shadowed_by_control_and_negation_syntax() {
    let reserved_option = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .option(OptionSpec::flag("help", "Conflicting help"))
        .build()
        .expect_err("help option must remain reserved when extended builtins are disabled");
    assert_eq!(reserved_option.kind(), DefinitionErrorKind::OptionConflict);

    let negation = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .option(OptionSpec::flag("noColor", "Ambiguous negation"))
        .build()
        .expect_err("no-prefixed option should conflict with negation syntax");
    assert_eq!(negation.kind(), DefinitionErrorKind::OptionConflict);

    let help_command = Command::builder("help", "Conflicting help command")
        .build()
        .expect("help is valid only as a root command name");
    let reserved_subcommand = Command::builder("tool", "Test tool")
        .subcommand(help_command)
        .build()
        .expect_err("help subcommand should remain reserved");
    assert_eq!(
        reserved_subcommand.kind(),
        DefinitionErrorKind::DuplicateName
    );

    let help_alias = Command::builder("child", "Child")
        .alias("help")
        .build()
        .expect("help alias is valid only before attachment");
    let reserved_alias = Command::builder("tool", "Test tool")
        .subcommand(help_alias)
        .build()
        .expect_err("help subcommand alias should remain reserved");
    assert_eq!(reserved_alias.kind(), DefinitionErrorKind::DuplicateName);
}

#[test]
fn rejects_ambiguous_arguments_and_subcommand_names() {
    let arguments = Command::builder("tool", "Test tool")
        .argument(Argument::new(
            "optional",
            "Optional",
            ArgumentCardinality::Optional,
        ))
        .argument(Argument::new(
            "required",
            "Required",
            ArgumentCardinality::Required,
        ))
        .build()
        .expect_err("required arguments must precede optional arguments");
    assert_eq!(arguments.kind(), DefinitionErrorKind::InvalidArgument);

    let optional_variadic = Command::builder("tool", "Test tool")
        .argument(Argument::new(
            "optional",
            "Optional",
            ArgumentCardinality::Optional,
        ))
        .argument(Argument::new(
            "files",
            "Files",
            ArgumentCardinality::OneOrMore,
        ))
        .build()
        .expect_err("optional arguments must not precede variadic arguments");
    assert_eq!(
        optional_variadic.kind(),
        DefinitionErrorKind::InvalidArgument
    );

    let child = Command::builder("child", "Child")
        .build()
        .expect("child should build");
    let mixed_grammar = Command::builder("tool", "Test tool")
        .argument(Argument::new(
            "input",
            "Input",
            ArgumentCardinality::Required,
        ))
        .subcommand(child)
        .build()
        .expect_err("positionals and subcommands must be mutually exclusive");
    assert_eq!(mixed_grammar.kind(), DefinitionErrorKind::InvalidCommand);

    let first = Command::builder("first", "First")
        .alias("shared")
        .build()
        .expect("first command should build");
    let second = Command::builder("shared", "Second")
        .build()
        .expect("second command should build");
    let duplicate = Command::builder("tool", "Test tool")
        .subcommand(first)
        .subcommand(second)
        .build()
        .expect_err("subcommand alias conflict should be rejected");
    assert_eq!(duplicate.kind(), DefinitionErrorKind::DuplicateName);
}

#[test]
fn routes_only_leading_consecutive_subcommands() {
    let command = command_tree();
    let error = command
        .parse_from(["--config", "calc", "calc", "-e", "1 + 2"])
        .expect_err("an option must close subcommand routing");
    assert_eq!(error.kind(), ParseErrorKind::UnknownOption);
    assert_eq!(error.command_path(), "kit");

    let outcome = command
        .parse_from(["calc", "--config", "calc", "-e", "1 + 2"])
        .expect("leading subcommand path should parse");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };

    assert_eq!(matches.command_path(), ["kit", "calc"]);
    assert_eq!(
        matches.effective_option("config"),
        Some(&Value::String("calc".to_owned()))
    );
    assert_eq!(
        matches.option("expression"),
        Some(&Value::String("1 + 2".to_owned()))
    );
}

#[test]
fn routes_aliases_to_canonical_command_path() {
    let command = command_tree();
    let outcome = command
        .parse_from(["c", "--expression=2+2"])
        .expect("alias route should parse");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };

    assert_eq!(matches.command_path(), ["kit", "calc"]);
}

#[test]
fn descendant_override_preserves_inherited_short_option() {
    let child = Command::builder("child", "Child")
        .option(
            OptionSpec::value(
                "output",
                "Child output",
                ValueType::String,
                OptionArity::Required,
            )
            .short('o'),
        )
        .option(OptionSpec::flag("verbose", "Child verbose").short('v'))
        .build()
        .expect("child should build");
    let command = Command::builder("tool", "Test tool")
        .option(
            OptionSpec::value(
                "output",
                "Root output",
                ValueType::String,
                OptionArity::Required,
            )
            .short('o'),
        )
        .subcommand(child)
        .build()
        .expect("compatible override should build");

    let outcome = command
        .parse_from(["child", "-o", "file", "-v"])
        .expect("child options should parse");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("output"),
        Some(&Value::String("file".to_owned()))
    );
    assert_eq!(matches.option("verbose"), Some(&Value::Bool(true)));
}

#[test]
fn rejects_option_shadow_that_changes_consumption_contract() {
    let child = Command::builder("child", "Child")
        .option(OptionSpec::flag("mode", "Child mode"))
        .build()
        .expect("child should build in isolation");
    let error = Command::builder("tool", "Test tool")
        .option(OptionSpec::value(
            "mode",
            "Root mode",
            ValueType::String,
            OptionArity::Required,
        ))
        .subcommand(child)
        .build()
        .expect_err("shadow must preserve value type and arity");

    assert_eq!(error.kind(), DefinitionErrorKind::OptionConflict);
    assert_eq!(error.command_path(), "tool child");

    let child = Command::builder("child", "Child")
        .option(
            OptionSpec::value(
                "output",
                "Child output",
                ValueType::String,
                OptionArity::Required,
            )
            .short('c'),
        )
        .build()
        .expect("child should build in isolation");
    let short_error = Command::builder("tool", "Test tool")
        .option(
            OptionSpec::value(
                "output",
                "Root output",
                ValueType::String,
                OptionArity::Required,
            )
            .short('o'),
        )
        .subcommand(child)
        .build()
        .expect_err("shadow must preserve short name");
    assert_eq!(short_error.kind(), DefinitionErrorKind::OptionConflict);

    let child = Command::builder("child", "Child")
        .build()
        .expect("child should build in isolation");
    let builtin_error = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .option(
            OptionSpec::value(
                "color",
                "Color name",
                ValueType::String,
                OptionArity::Required,
            )
            .short('c'),
        )
        .subcommand(child)
        .build()
        .expect_err("child builtins must not bypass inherited shadow validation");
    assert_eq!(builtin_error.kind(), DefinitionErrorKind::OptionConflict);
}

#[test]
fn selected_leaf_uses_shadowed_choices() {
    let child = Command::builder("child", "Child")
        .option(
            OptionSpec::value(
                "mode",
                "Child mode",
                ValueType::String,
                OptionArity::Required,
            )
            .short('m')
            .choices(["child"]),
        )
        .build()
        .expect("child should build");
    let command = Command::builder("tool", "Test tool")
        .option(
            OptionSpec::value(
                "mode",
                "Root mode",
                ValueType::String,
                OptionArity::Required,
            )
            .short('m')
            .choices(["root"]),
        )
        .subcommand(child)
        .build()
        .expect("compatible choice shadow should build");

    for args in [
        vec!["child", "--mode", "child"],
        vec!["child", "-m", "child"],
    ] {
        let outcome = command
            .parse_from(args)
            .expect("selected leaf should use its local choices");
        let ParseOutcome::Matches(matches) = outcome else {
            panic!("expected matches");
        };
        assert_eq!(matches.command_path(), ["tool", "child"]);
        assert_eq!(
            matches.option("mode"),
            Some(&Value::String("child".to_owned()))
        );
    }
}

#[test]
fn selected_leaf_uses_builtin_shadow_choices() {
    let child = Command::builder("child", "Child")
        .build()
        .expect("child should build");
    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .option(
            OptionSpec::value(
                "logLevel",
                "Root log level",
                ValueType::String,
                OptionArity::Required,
            )
            .choices(["trace"]),
        )
        .subcommand(child)
        .build()
        .expect("compatible builtin shadow should build");

    let outcome = command
        .parse_from(["child", "--log-level", "info"])
        .expect("selected leaf should use builtin choices");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };
    assert_eq!(matches.command_path(), ["tool", "child"]);
    assert_eq!(
        matches.builtins().option("logLevel"),
        Some(&Value::String("info".to_owned()))
    );
}

#[test]
fn invalid_option_before_subcommand_keeps_root_diagnostic_path() {
    let command = command_tree();
    let error = command
        .parse_from(["-xc", "value", "calc"])
        .expect_err("unknown short option should stop routing");

    assert_eq!(error.kind(), ParseErrorKind::UnknownOption);
    assert_eq!(error.command_path(), "kit");
}

#[test]
fn help_and_version_controls_short_circuit() {
    let command = command_tree();

    let help = command
        .parse_from(["calc", "--version", "--help"])
        .expect("help should win over version");
    let ParseOutcome::Help {
        command_path, text, ..
    } = help
    else {
        panic!("expected help outcome");
    };
    assert_eq!(command_path, ["kit", "calc"]);
    assert!(text.starts_with("Calculator\n\nUsage: kit calc"));

    let routed_help = command
        .parse_from(["help", "calc"])
        .expect("help subcommand should route to calc");
    assert!(matches!(
        routed_help,
        ParseOutcome::Help { command_path, .. } if command_path == ["kit", "calc"]
    ));

    let version = command
        .parse_from(["calc", "-V"])
        .expect("version should parse");
    assert_eq!(version.text(), Some("kit calc 0.1.0\n"));

    let unknown = command
        .parse_from(["bogus", "--help"])
        .expect_err("help must not hide an unknown subcommand");
    assert_eq!(unknown.kind(), ParseErrorKind::UnknownSubcommand);

    let extra = command
        .parse_from(["calc", "extra", "-V"])
        .expect_err("version must not hide an unexpected argument");
    assert_eq!(extra.kind(), ParseErrorKind::UnexpectedArgument);

    // `--` declares the rest to be data, so a token after it is an unexpected argument on a command
    // that takes none — never a mistyped subcommand.
    let after_separator = command
        .parse_from(["--help", "--", "extra"])
        .expect_err("help must validate positionals after the separator");
    assert_eq!(after_separator.kind(), ParseErrorKind::UnexpectedArgument);

    let version_after_separator = command
        .parse_from(["calc", "--version", "--", "extra"])
        .expect_err("version must validate positionals after the separator");
    assert_eq!(
        version_after_separator.kind(),
        ParseErrorKind::UnexpectedArgument
    );

    let help_after_separator = command
        .parse_from(["help", "--", "bogus"])
        .expect_err("help keyword must validate targets after the separator");
    assert_eq!(
        help_after_separator.kind(),
        ParseErrorKind::UnknownSubcommand
    );

    let positional = Command::builder("tool", "Test tool")
        .argument(Argument::new(
            "input",
            "Input",
            ArgumentCardinality::Required,
        ))
        .build()
        .expect("positional command should build");
    assert!(matches!(
        positional
            .parse_from(["--help"])
            .expect("help may omit required positional arguments"),
        ParseOutcome::Help { .. }
    ));
}

#[test]
fn help_keyword_wins_independent_of_control_order() {
    let command = command_tree();

    for args in [
        vec!["--version", "--help"],
        vec!["--help", "--version"],
        vec!["help", "--version"],
    ] {
        let outcome = command
            .parse_from(args)
            .expect("help should win over version regardless of order");
        assert!(matches!(
            outcome,
            ParseOutcome::Help { command_path, .. } if command_path == ["kit"]
        ));
    }

    let extra = command
        .parse_from(["help", "calc", "extra"])
        .expect_err("help should reject more than one command target");
    assert_eq!(extra.kind(), ParseErrorKind::TooManyArguments);

    let unknown_before_help = command
        .parse_from(["bogus", "help"])
        .expect_err("help keyword must preserve unknown subcommand classification");
    assert_eq!(
        unknown_before_help.kind(),
        ParseErrorKind::UnknownSubcommand
    );

    let positional = Command::builder("tool", "Test tool")
        .argument(
            Argument::new("mode", "Mode", ArgumentCardinality::Required).choices(["fast", "safe"]),
        )
        .build()
        .expect("positional command should build");
    let invalid_choice = positional
        .parse_from(["slow", "help"])
        .expect_err("help keyword must preserve positional choice diagnostics");
    assert_eq!(invalid_choice.kind(), ParseErrorKind::InvalidArgumentValue);

    for args in [
        vec!["help", "--bogus"],
        vec!["help", "calc", "--bogus"],
        vec!["--bogus", "--help"],
        vec!["--bogus", "--version"],
        vec!["--bogus", "help"],
    ] {
        let unknown = command
            .parse_from(args)
            .expect_err("help should preserve unknown options for diagnostics");
        assert_eq!(unknown.kind(), ParseErrorKind::UnknownOption);
    }
}

#[test]
fn option_values_named_help_are_not_controls() {
    let command = command_tree();

    let inherited = command
        .parse_from(["calc", "--config", "help", "-e", "1"])
        .expect("inherited option value should not become a help control");
    let ParseOutcome::Matches(inherited) = inherited else {
        panic!("expected matches");
    };
    assert_eq!(
        inherited.effective_option("config"),
        Some(&Value::String("help".to_owned()))
    );

    let local = command
        .parse_from(["calc", "-e", "help"])
        .expect("local option value should not become a help control");
    let ParseOutcome::Matches(local) = local else {
        panic!("expected matches");
    };
    assert_eq!(
        local.option("expression"),
        Some(&Value::String("help".to_owned()))
    );
}

#[test]
fn only_leading_help_is_a_control() {
    let command = Command::builder("store", "Store a value")
        .version("0.1.0")
        .argument(Argument::new("key", "Key", ArgumentCardinality::Required))
        .argument(Argument::new(
            "value",
            "Value",
            ArgumentCardinality::Optional,
        ))
        .build()
        .expect("command should build");

    assert!(
        matches!(
            command
                .parse_from(["help"])
                .expect("help reaches the help text"),
            ParseOutcome::Help { .. }
        ),
        "a required argument must not swallow the help keyword"
    );

    let outcome = command
        .parse_from(["foo", "help"])
        .expect("non-leading help should stay positional data");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.argument("key"),
        Some(&Value::String("foo".to_owned()))
    );
    assert_eq!(
        matches.argument("value"),
        Some(&Value::String("help".to_owned()))
    );
}

#[test]
fn required_option_reports_an_option_shaped_value_instead_of_a_missing_one() {
    let command = command_tree();
    let error = command
        .parse_from(["calc", "-e", "-1+2"])
        .expect_err("an option-shaped value is refused");
    assert_eq!(error.kind(), ParseErrorKind::MissingOptionValue);
    let rendered = error.to_string();
    assert!(
        rendered.contains("\"-1+2\" is an option token"),
        "{rendered}"
    );
    assert!(rendered.contains("use \"--expression=-1+2\""), "{rendered}");

    // The suggested escape actually works.
    let outcome = command
        .parse_from(["calc", "--expression=-1+2"])
        .expect("inline form carries the value");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("expression"),
        Some(&Value::String("-1+2".to_owned()))
    );
}

#[test]
fn parses_long_short_negative_and_repeated_options() {
    let command = command_tree();
    let outcome = command
        .parse_from([
            "calc",
            "--EXPRESSION=1+1",
            "--precision=-2",
            "--no-color",
            "-vq",
            "--expression",
            "2+2",
        ])
        .expect("options should parse");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };

    assert_eq!(
        matches.option("expression"),
        Some(&Value::String("2+2".to_owned()))
    );
    assert_eq!(matches.option("precision"), Some(&Value::Integer(-2)));
    assert_eq!(
        matches.builtins().option("color"),
        Some(&Value::Bool(false))
    );
    assert_eq!(matches.option("verbose"), Some(&Value::Bool(true)));
    assert_eq!(matches.option("quiet"), Some(&Value::Bool(true)));
}

#[test]
fn numeric_options_reject_separate_negative_values() {
    let command = command_tree();
    for args in [
        vec!["calc", "-e", "1", "-p", "-2"],
        vec!["calc", "-e", "1", "--precision", "-3"],
    ] {
        let error = command
            .parse_from(args)
            .expect_err("separate negative values should be rejected");
        assert_eq!(error.kind(), ParseErrorKind::MissingOptionValue);
        assert!(error.message().contains("=-"));
    }
}

#[test]
fn out_of_range_attached_negative_numbers_report_invalid_values() {
    let command = command_tree();
    let error = command
        .parse_from(["calc", "-e", "1", "--precision=-9223372036854775809"])
        .expect_err("out-of-range negative integer should fail conversion");
    assert_eq!(error.kind(), ParseErrorKind::InvalidOptionValue);
}

#[test]
fn preserves_optional_option_presence_and_empty_values() {
    let command = command_tree();
    let absent = command
        .parse_from(["calc", "-e", "1"])
        .expect("command should parse");
    let ParseOutcome::Matches(absent) = absent else {
        panic!("expected matches");
    };
    assert!(!absent.contains_option("write"));

    let without_value = command
        .parse_from(["calc", "-e", "1", "--write"])
        .expect("optional value should be omittable");
    let ParseOutcome::Matches(without_value) = without_value else {
        panic!("expected matches");
    };
    assert!(without_value.contains_option("write"));
    assert_eq!(without_value.option("write"), Some(&Value::None));

    let empty = command
        .parse_from(["calc", "-e", "1", "--write="])
        .expect("explicit empty value should parse");
    let ParseOutcome::Matches(empty) = empty else {
        panic!("expected matches");
    };
    assert_eq!(empty.option("write"), Some(&Value::String(String::new())));
}

#[test]
fn defaults_do_not_imply_presence_or_pollute_explicit_variadic_values() {
    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .option(
            OptionSpec::value(
                "write",
                "Write output",
                ValueType::String,
                OptionArity::Optional,
            )
            .default(Value::String("default.txt".to_owned())),
        )
        .option(
            OptionSpec::value("items", "Items", ValueType::String, OptionArity::Variadic)
                .default(Value::Strings(vec!["base".to_owned()])),
        )
        .build()
        .expect("command should build");

    let defaults = command
        .parse_from([] as [&str; 0])
        .expect("defaults should resolve");
    let ParseOutcome::Matches(defaults) = defaults else {
        panic!("expected matches");
    };
    assert!(!defaults.contains_option("write"));
    assert_eq!(
        defaults.option("write"),
        Some(&Value::String("default.txt".to_owned()))
    );
    assert!(!defaults.contains_option("items"));
    assert_eq!(
        defaults.option("items"),
        Some(&Value::Strings(vec!["base".to_owned()]))
    );

    let explicit = command
        .parse_from(["--items", "x"])
        .expect("explicit variadic values should parse");
    let ParseOutcome::Matches(explicit) = explicit else {
        panic!("expected matches");
    };
    assert!(explicit.contains_option("items"));
    assert_eq!(
        explicit.option("items"),
        Some(&Value::Strings(vec!["x".to_owned()]))
    );
}

#[test]
fn variadic_inline_value_stops_greedy_consumption() {
    let child = Command::builder("collect", "Collect values")
        .builtins(Builtins::disabled())
        .option(OptionSpec::value(
            "items",
            "Items",
            ValueType::String,
            OptionArity::Variadic,
        ))
        .argument(Argument::new(
            "rest",
            "Remaining values",
            ArgumentCardinality::Variadic,
        ))
        .build()
        .expect("child should build");
    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .subcommand(child)
        .build()
        .expect("root should build");

    let outcome = command
        .parse_from(["collect", "--items=first", "second", "third"])
        .expect("variadic option should parse");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.option("items"),
        Some(&Value::Strings(vec!["first".to_owned()]))
    );
    assert_eq!(
        matches.argument("rest"),
        Some(&Value::Strings(vec![
            "second".to_owned(),
            "third".to_owned()
        ]))
    );
}

#[test]
fn end_of_options_preserves_control_tokens_as_arguments() {
    let command = Command::builder("tool", "Test tool")
        .argument(Argument::new(
            "values",
            "Values",
            ArgumentCardinality::Variadic,
        ))
        .build()
        .expect("command should build");
    let outcome = command
        .parse_from(["--", "--help", "-V"])
        .expect("control tokens after separator should be positional");
    let ParseOutcome::Matches(matches) = outcome else {
        panic!("expected matches");
    };
    assert_eq!(
        matches.argument("values"),
        Some(&Value::Strings(vec!["--help".to_owned(), "-V".to_owned()]))
    );
}

#[test]
fn validates_argument_choices_and_cardinality() {
    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .argument(
            Argument::new("mode", "Mode", ArgumentCardinality::Required).choices(["fast", "safe"]),
        )
        .argument(Argument::new(
            "files",
            "Files",
            ArgumentCardinality::OneOrMore,
        ))
        .build()
        .expect("command should build");

    let invalid = command
        .parse_from(["slow", "file.txt"])
        .expect_err("unknown choice should fail");
    assert_eq!(invalid.kind(), ParseErrorKind::InvalidArgumentValue);

    let missing = command
        .parse_from(["fast"])
        .expect_err("one-or-more argument should require a value");
    assert_eq!(missing.kind(), ParseErrorKind::MissingArgument);
}

#[test]
fn reports_unknown_subcommand_with_unique_suggestion() {
    let command = command_tree();
    let error = command
        .parse_from(["clac"])
        .expect_err("unknown route should fail");

    assert_eq!(error.kind(), ParseErrorKind::UnknownSubcommand);
    assert_eq!(
        error.hints(),
        [
            "did you mean \"calc\"?",
            "command \"kit\" does not accept positional arguments",
        ]
    );
    assert_eq!(error.issues()[0].stage(), DiagnosticStage::Route);
    assert_eq!(error.issues()[0].scope(), IssueScope::Command);
    assert_eq!(
        error.issues()[0].reason_code(),
        ReasonCode::UnknownSubcommand
    );
    assert_eq!(error.issues()[1].kind(), IssueKind::Hint);
    assert_eq!(
        error.issues()[1].reason_code(),
        ReasonCode::DidYouMeanSubcommand
    );
    assert_eq!(
        error.issues()[2].reason_code(),
        ReasonCode::CommandDoesNotAcceptPositionalArguments
    );
    assert_eq!(
        error.to_string(),
        "Error: unknown subcommand \"clac\" for command \"kit\"\n\
Hint: did you mean \"calc\"?\n\
Hint: command \"kit\" does not accept positional arguments\n\
Run \"kit --help\" for usage."
    );

    // Subcommand lookup is case-sensitive, so a token that differs only in case still lands here —
    // and it is the one case where the caller is closest to the name they wanted.
    let shouted = command
        .parse_from(["CALC"])
        .expect_err("a shouted subcommand is still unknown");
    assert_eq!(
        shouted.hints(),
        [
            "did you mean \"calc\"?",
            "command \"kit\" does not accept positional arguments",
        ]
    );
}

#[test]
fn reports_strict_option_errors() {
    let command = command_tree();

    let missing = command
        .parse_from(["calc", "--expression"])
        .expect_err("missing value should fail");
    assert_eq!(missing.kind(), ParseErrorKind::MissingOptionValue);

    let attached = command
        .parse_from(["calc", "-e=1"])
        .expect_err("short equals syntax should fail");
    assert_eq!(attached.kind(), ParseErrorKind::UnsupportedShortSyntax);

    let malformed = command
        .parse_from(["calc", "--log_level=info"])
        .expect_err("underscore option should fail");
    assert_eq!(malformed.kind(), ParseErrorKind::InvalidOptionFormat);
}

#[test]
fn parses_boolean_inline_values_and_classifies_boolean_errors() {
    let command = command_tree();
    let ParseOutcome::Matches(matches) = command
        .parse_from(["calc", "-e", "1", "--verbose=false"])
        .expect("boolean inline false should parse")
    else {
        panic!("expected matches");
    };
    assert_eq!(matches.option("verbose"), Some(&Value::Bool(false)));

    let invalid = command
        .parse_from(["calc", "-e", "1", "--verbose=auto"])
        .expect_err("invalid inline boolean should fail");
    assert_eq!(invalid.kind(), ParseErrorKind::InvalidBooleanValue);
    assert_eq!(
        invalid.issues()[0].reason_code(),
        ReasonCode::InvalidBooleanValue
    );

    let negative_value = command
        .parse_from(["calc", "-e", "1", "--no-color=true"])
        .expect_err("negative option cannot take a value");
    assert_eq!(
        negative_value.kind(),
        ParseErrorKind::NegativeOptionWithValue
    );
    assert_eq!(
        negative_value.issues()[0].reason_code(),
        ReasonCode::NegativeOptionWithValue
    );
}

#[test]
fn renders_deterministic_help() {
    let child = Command::builder("run", "Run work")
        .builtins(Builtins::disabled())
        .build()
        .expect("child should build");
    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled())
        .option(
            OptionSpec::value(
                "output",
                "Output file",
                ValueType::String,
                OptionArity::Required,
            )
            .short('o'),
        )
        .subcommand(child)
        .build()
        .expect("command should build");

    let outcome = command.parse_from(["--help"]).expect("help should render");
    assert_eq!(
        outcome.text(),
        Some(concat!(
            "Test tool\n\n",
            "Usage: tool [options] [command]\n\n",
            "Options:\n",
            "  -h, --help                Show help information\n",
            "  -o, --output <value>      Output file\n\n",
            "Preset Directives:\n",
            "  --preset-file <value>     Load preset manifest file\n",
            "  --preset-profile <value>  Select preset profile: <profile> or <profile>:<variant>\n\n",
            "Commands:\n",
            "  help                      Show help for a command\n",
            "  run                       Run work\n",
        ))
    );
}

#[test]
fn exposes_rich_help_data_examples_and_explicit_chalk_rendering() {
    let command = Command::builder("tool", "Test tool")
        .builtins(Builtins::disabled().color(true))
        .option(
            OptionSpec::value(
                "token",
                "API token",
                ValueType::String,
                OptionArity::Required,
            )
            .required(),
        )
        .option(
            OptionSpec::value("mode", "Mode", ValueType::String, OptionArity::Required)
                .choices(["fast", "safe"])
                .default(Value::String("safe".to_owned())),
        )
        .argument(
            Argument::new("input", "Input", ArgumentCardinality::Optional)
                .choices(["src", "test"])
                .default(Value::String("src".to_owned())),
        )
        .example(guanghechen_commander::Example::new(
            "Fast mode",
            "--token secret --mode fast",
            "Run with the fast profile",
        ))
        .build()
        .expect("help fixture should build");

    let data = command.help_data();
    assert_eq!(data.usage(), "Usage: tool [options] [input]");
    assert_eq!(data.options()[0].label(), "-h, --help");
    assert_eq!(data.options()[1].label(), "--token <value>");
    assert!(data.options()[1].description().contains("[required]"));
    assert!(
        data.options()[3]
            .description()
            .contains("[default: \"safe\"]")
    );
    assert!(
        data.options()[3]
            .description()
            .contains("[choices: \"fast\", \"safe\"]")
    );
    assert!(
        data.arguments()[0]
            .description()
            .contains("[default: \"src\"]")
    );
    assert_eq!(
        data.examples()[0].usage(),
        "tool --token secret --mode fast"
    );

    let plain = command.format_help();
    assert!(!plain.contains('\x1b'));
    assert!(plain.contains("Examples:\n  - Fast mode"));
    let styled = command.format_help_with(ColorLevel::Ansi16);
    assert!(styled.contains('\x1b'));

    let no_color = command
        .parse(
            ParseRequest::new(["--help"])
                .environment([("NO_COLOR", "1")])
                .max_color_level(ColorLevel::Ansi16),
        )
        .expect("help should render");
    assert!(!no_color.text().expect("help text").contains('\x1b'));
    let explicit_color = command
        .parse(
            ParseRequest::new(["--help", "--color"])
                .environment([("NO_COLOR", "1")])
                .max_color_level(ColorLevel::Ansi16),
        )
        .expect("explicit color should render");
    assert!(explicit_color.text().expect("help text").contains('\x1b'));

    let inline_disabled = command
        .parse(ParseRequest::new(["--help", "--color=false"]).max_color_level(ColorLevel::Ansi16))
        .expect("inline color false should render plain help");
    assert!(!inline_disabled.text().expect("help text").contains('\x1b'));
}

fn command_tree() -> Command {
    let calc = Command::builder("calc", "Calculator")
        .version("0.1.0")
        .alias("c")
        .option(
            OptionSpec::value(
                "expression",
                "Expression",
                ValueType::String,
                OptionArity::Required,
            )
            .short('e'),
        )
        .option(
            OptionSpec::value(
                "precision",
                "Precision",
                ValueType::Integer,
                OptionArity::Required,
            )
            .short('p')
            .default(Value::Integer(10)),
        )
        .option(OptionSpec::flag("verbose", "Verbose").short('v'))
        .option(OptionSpec::flag("quiet", "Quiet").short('q'))
        .option(OptionSpec::value(
            "write",
            "Write output",
            ValueType::String,
            OptionArity::Optional,
        ))
        .build()
        .expect("calc should build");

    Command::builder("kit", "Unified tools")
        .version("0.1.0")
        .option(
            OptionSpec::value(
                "config",
                "Config path",
                ValueType::String,
                OptionArity::Required,
            )
            .short('c'),
        )
        .subcommand(calc)
        .build()
        .expect("command tree should build")
}

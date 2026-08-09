use std::collections::{BTreeMap, BTreeSet};
use std::ffi::OsString;
use std::fmt::{self, Debug, Formatter};
use std::path::PathBuf;

use guanghechen_chalk::ColorLevel;

use crate::command::{
    ArgumentCardinality, Command, OptionArity, OptionOrigin, OptionSpec, ValueType,
    effective_option_entries, os_to_string,
};
use crate::error::{InputSourceKind, ParseError, ParseErrorKind, ReasonCode};
use crate::help::{command_path, render_help, render_version};
use crate::matches::{
    BuiltinMatches, Controls, InputSources, MatchesData, PresetInputSource, PresetSourceState,
    UserInputSource,
};
use crate::numeric::{parse_integer_literal, parse_number_literal};
use crate::preset;
use crate::redaction::{RedactedMap, RedactedSlice};
use crate::{Matches, Value};

#[derive(Clone, Debug, PartialEq)]
pub enum ParseOutcome {
    Help {
        command_path: Vec<String>,
        text: String,
        controls: Controls,
        sources: InputSources,
    },
    Version {
        command_path: Vec<String>,
        text: String,
        controls: Controls,
        sources: InputSources,
    },
    Matches(Matches),
}

impl ParseOutcome {
    #[must_use]
    pub fn command_path(&self) -> &[String] {
        match self {
            Self::Help { command_path, .. } | Self::Version { command_path, .. } => command_path,
            Self::Matches(matches) => matches.command_path(),
        }
    }

    #[must_use]
    pub fn text(&self) -> Option<&str> {
        match self {
            Self::Help { text, .. } | Self::Version { text, .. } => Some(text),
            Self::Matches(_) => None,
        }
    }

    #[must_use]
    pub fn controls(&self) -> Controls {
        match self {
            Self::Help { controls, .. } | Self::Version { controls, .. } => *controls,
            Self::Matches(matches) => matches.controls(),
        }
    }

    #[must_use]
    pub fn sources(&self) -> &InputSources {
        match self {
            Self::Help { sources, .. } | Self::Version { sources, .. } => sources,
            Self::Matches(matches) => matches.sources(),
        }
    }
}

#[derive(Clone)]
pub struct ParseRequest {
    argv: Vec<OsString>,
    environment: BTreeMap<OsString, OsString>,
    base_directory: Option<PathBuf>,
    max_color_level: ColorLevel,
}

impl Debug for ParseRequest {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("ParseRequest")
            .field("argv", &RedactedSlice::new(&self.argv))
            .field("environment", &RedactedMap::new(&self.environment))
            .field("base_directory", &self.base_directory)
            .field("max_color_level", &self.max_color_level)
            .finish()
    }
}

impl ParseRequest {
    #[must_use]
    pub fn new<I, T>(argv: I) -> Self
    where
        I: IntoIterator<Item = T>,
        T: Into<OsString>,
    {
        Self {
            argv: argv.into_iter().map(Into::into).collect(),
            environment: BTreeMap::new(),
            base_directory: None,
            max_color_level: ColorLevel::None,
        }
    }

    #[must_use]
    pub fn environment<I, K, V>(mut self, environment: I) -> Self
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<OsString>,
        V: Into<OsString>,
    {
        self.environment = environment
            .into_iter()
            .map(|(key, value)| (key.into(), value.into()))
            .collect();
        self
    }

    #[must_use]
    pub fn base_directory(mut self, base_directory: impl Into<PathBuf>) -> Self {
        self.base_directory = Some(base_directory.into());
        self
    }

    #[must_use]
    pub const fn max_color_level(mut self, max_color_level: ColorLevel) -> Self {
        self.max_color_level = max_color_level;
        self
    }
}

struct Route<'a> {
    chain: Vec<&'a Command>,
    user_path: Vec<String>,
    tail: Vec<String>,
}

struct ControlTokens<'a> {
    before_separator: Vec<&'a str>,
    after_separator: Vec<&'a str>,
}

struct OptionValueState<'a> {
    values: &'a mut BTreeMap<String, Value>,
    present_options: &'a mut BTreeSet<String>,
    option_sources: &'a mut BTreeMap<String, BTreeSet<InputSourceKind>>,
    source: InputSourceKind,
    validate_values: bool,
}

pub(crate) fn parse(root: &Command, request: ParseRequest) -> Result<ParseOutcome, ParseError> {
    let root_path = root.name.clone();
    let args = request
        .argv
        .into_iter()
        .map(|value| os_to_string(&value, &root_path, "command-line arguments"))
        .collect::<Result<Vec<_>, _>>()?;
    let environment = request
        .environment
        .into_iter()
        .map(|(key, value)| {
            let key = os_to_string(&key, &root_path, "environment keys")?;
            let value = os_to_string(&value, &root_path, "environment values")?;
            Ok((key, value))
        })
        .collect::<Result<BTreeMap<_, _>, ParseError>>()?;
    let mut route = route(root, args);
    let directives = preset::scan_directives(std::mem::take(&mut route.tail));
    route.tail = directives.clean_args.clone();
    let user_source = UserInputSource::new(
        canonical_path(&route.chain),
        route.user_path.clone(),
        route.tail.clone(),
        environment.clone(),
    );
    let skipped_sources = InputSources::new(
        user_source.clone(),
        PresetInputSource::new(
            PresetSourceState::Skipped,
            Vec::new(),
            BTreeMap::new(),
            None,
        ),
    );

    if let Some(outcome) = scan_control(&route, &skipped_sources, request.max_color_level)? {
        return Ok(outcome);
    }

    let path = command_path(&route.chain);
    directives
        .validate(&path)
        .map_err(|error| error.with_input_source(InputSourceKind::User))?;
    let resolved = preset::resolve(
        &route.chain,
        &directives,
        &path,
        request.base_directory.as_deref(),
    )?;
    let sources = match resolved.as_ref() {
        None => InputSources::new(
            user_source.clone(),
            PresetInputSource::new(PresetSourceState::None, Vec::new(), BTreeMap::new(), None),
        ),
        Some(preset) => InputSources::new(
            user_source,
            PresetInputSource::new(
                PresetSourceState::Applied,
                preset.argv.clone(),
                preset.envs.clone(),
                Some(preset.source.clone()),
            ),
        ),
    };
    if let Some(preset) = &resolved {
        let validation_route = Route {
            chain: route.chain.clone(),
            user_path: route.user_path.clone(),
            tail: preset.argv.clone(),
        };
        if let Err(error) = parse_match_data(
            validation_route,
            false,
            BTreeMap::new(),
            sources.clone(),
            request.max_color_level,
        ) {
            return Err(error.with_preset_source(&preset.source).with_hint(
                ReasonCode::PresetTokenInjected,
                format!(
                    "preset options were loaded from \"{}\"",
                    preset.source.option_source_label()
                ),
            ));
        }
        let mut merged = preset.argv.clone();
        merged.extend(route.tail);
        route.tail = merged;
    }
    let mut effective_environment = environment;
    if let Some(preset) = &resolved {
        effective_environment.extend(preset.envs.clone());
    }
    parse_matches(
        route,
        effective_environment,
        sources,
        request.max_color_level,
    )
}

fn route(root: &Command, args: Vec<String>) -> Route<'_> {
    let mut chain = vec![root];
    let mut user_path = Vec::new();
    let mut tail = args;

    loop {
        let current = chain
            .last()
            .copied()
            .expect("command chain always contains the root");
        let Some(token) = tail.first().cloned() else {
            break;
        };
        if token == "help" || is_option_token(&token) {
            break;
        }
        let Some(subcommand) = current.find_subcommand(&token) else {
            break;
        };
        tail.remove(0);
        user_path.push(token);
        chain.push(subcommand);
    }

    Route {
        chain,
        user_path,
        tail,
    }
}

fn scan_control(
    route: &Route<'_>,
    sources: &InputSources,
    max_color_level: ColorLevel,
) -> Result<Option<ParseOutcome>, ParseError> {
    let control_tokens = control_tokens(route)?;
    let before_separator = &control_tokens.before_separator;
    let control_sources = sources
        .clone()
        .with_user_argv(clean_control_argv(&route.tail));

    // `help` reaches the help text from anywhere ahead of the separator, including on a command that
    // takes positional values: asking a command for help is overwhelmingly likelier than naming a
    // value `help`, and guessing the other way is silent — `kit copy help` would copy the word.
    // `--` is the escape for the rare command that really does mean the literal value.
    if route.tail.first().is_some_and(|token| token == "help") {
        let help_index = 0;
        let supplied_before_help = before_separator[..help_index]
            .iter()
            .filter(|token| !is_control_flag(token))
            .map(|token| (*token).to_owned())
            .collect::<Vec<_>>();
        let leaf = route
            .chain
            .last()
            .copied()
            .expect("command chain always contains the root");
        parse_arguments(leaf, &route.chain, &supplied_before_help, false, None)?;

        let mut targets: Vec<&str> = Vec::new();
        for token in &before_separator[help_index + 1..] {
            if is_control_flag(token) {
                continue;
            }
            if is_option_token(token) {
                return Err(ParseError::new(
                    ParseErrorKind::UnknownOption,
                    command_path(&route.chain),
                    format!(
                        "unknown option \"{token}\" for help control on command \"{}\"",
                        command_path(&route.chain)
                    ),
                ));
            }
            targets.push(*token);
        }
        targets.extend(control_tokens.after_separator.iter().copied());
        if targets.len() > 1 {
            return Err(ParseError::new(
                ParseErrorKind::TooManyArguments,
                command_path(&route.chain),
                format!("help accepts at most one command, got {}", targets.len()),
            ));
        }

        let mut target_chain = route.chain.clone();
        if let Some(target) = targets.first() {
            let leaf = target_chain
                .last()
                .copied()
                .expect("command chain always contains the root");
            let Some(subcommand) = leaf.find_subcommand(target) else {
                return Err(unknown_subcommand_error(&target_chain, target));
            };
            target_chain.push(subcommand);
        }
        let color_level = resolve_help_color(
            &target_chain,
            &route.tail,
            sources.user().environment(),
            max_color_level,
        );
        return Ok(Some(help_outcome(
            &target_chain,
            control_sources,
            color_level,
        )));
    }

    let help = before_separator
        .iter()
        .any(|token| matches!(*token, "--help" | "-h"));
    let version = before_separator
        .iter()
        .any(|token| matches!(*token, "--version" | "-V"));
    if help || version {
        let mut supplied = before_separator
            .iter()
            .filter(|token| !is_control_flag(token))
            .map(|token| (*token).to_owned())
            .collect::<Vec<_>>();
        let separator_at = Some(supplied.len());
        supplied.extend(
            control_tokens
                .after_separator
                .iter()
                .map(|token| (*token).to_owned()),
        );
        let leaf = route
            .chain
            .last()
            .copied()
            .expect("command chain always contains the root");
        parse_arguments(leaf, &route.chain, &supplied, false, separator_at)?;
    }
    if help {
        let color_level = resolve_help_color(
            &route.chain,
            &route.tail,
            sources.user().environment(),
            max_color_level,
        );
        return Ok(Some(help_outcome(
            &route.chain,
            control_sources,
            color_level,
        )));
    }
    if version && let Some(text) = render_version(&route.chain) {
        return Ok(Some(ParseOutcome::Version {
            command_path: canonical_path(&route.chain),
            text,
            controls: Controls::new(false, true),
            sources: control_sources,
        }));
    }

    Ok(None)
}

fn clean_control_argv(argv: &[String]) -> Vec<String> {
    let mut clean = Vec::new();
    let mut index = 0;
    let mut after_separator = false;
    if argv.first().is_some_and(|token| token == "help") {
        index = 1;
        if argv.get(index).is_some_and(|token| !is_option_token(token)) {
            index += 1;
        }
    }
    while index < argv.len() {
        let token = &argv[index];
        if token == "--" {
            after_separator = true;
            clean.push(token.clone());
        } else if after_separator || !is_control_flag(token) {
            clean.push(token.clone());
        }
        index += 1;
    }
    clean
}

fn control_tokens<'a>(route: &'a Route<'_>) -> Result<ControlTokens<'a>, ParseError> {
    let path = command_path(&route.chain);
    let option_entries = effective_option_entries(&route.chain);
    let options = option_entries
        .iter()
        .map(|entry| entry.spec.clone())
        .collect::<Vec<_>>();
    let long_options = options
        .iter()
        .map(|option| (option.cli_long(), option))
        .collect::<BTreeMap<_, _>>();
    let short_options = options
        .iter()
        .filter_map(|option| option.short_name().map(|short| (short, option)))
        .collect::<BTreeMap<_, _>>();
    let mut values = BTreeMap::new();
    let mut present_options = BTreeSet::new();
    let mut option_sources = BTreeMap::new();
    let mut before_separator = Vec::new();
    let mut after_separator = Vec::new();
    let mut reached_separator = false;
    let mut index = 0;
    while index < route.tail.len() {
        let token = route.tail[index].as_str();
        if reached_separator {
            after_separator.push(token);
            index += 1;
            continue;
        }
        if token == "--" {
            reached_separator = true;
            index += 1;
            continue;
        }
        if is_control_flag(token) || !is_option_token(token) {
            before_separator.push(token);
            index += 1;
            continue;
        }
        if token.starts_with("--") {
            let mut state = OptionValueState {
                values: &mut values,
                present_options: &mut present_options,
                option_sources: &mut option_sources,
                source: InputSourceKind::User,
                validate_values: true,
            };
            index = parse_long_option(&route.tail, index, &path, &long_options, &mut state)?;
        } else {
            let mut state = OptionValueState {
                values: &mut values,
                present_options: &mut present_options,
                option_sources: &mut option_sources,
                source: InputSourceKind::User,
                validate_values: true,
            };
            index = parse_short_options(&route.tail, index, &path, &short_options, &mut state)?;
        }
    }
    Ok(ControlTokens {
        before_separator,
        after_separator,
    })
}

fn help_outcome(
    chain: &[&Command],
    sources: InputSources,
    color_level: ColorLevel,
) -> ParseOutcome {
    ParseOutcome::Help {
        command_path: canonical_path(chain),
        text: render_help(chain, color_level),
        controls: Controls::new(true, false),
        sources,
    }
}

fn resolve_help_color(
    chain: &[&Command],
    tail: &[String],
    environment: &BTreeMap<String, String>,
    max_color_level: ColorLevel,
) -> ColorLevel {
    let supports_color = effective_option_entries(chain)
        .iter()
        .any(|entry| entry.spec.long == "color" && entry.origin == OptionOrigin::Builtin);
    if !supports_color || max_color_level == ColorLevel::None {
        return ColorLevel::None;
    }

    let mut enabled = !environment.contains_key("NO_COLOR");
    for token in tail.iter().take_while(|token| token.as_str() != "--") {
        match token.to_ascii_lowercase().as_str() {
            "--color" => enabled = true,
            "--no-color" => enabled = false,
            "--color=true" => enabled = true,
            "--color=false" => enabled = false,
            _ => {}
        }
    }
    if enabled {
        max_color_level
    } else {
        ColorLevel::None
    }
}

fn parse_matches(
    route: Route<'_>,
    effective_environment: BTreeMap<String, String>,
    sources: InputSources,
    max_color_level: ColorLevel,
) -> Result<ParseOutcome, ParseError> {
    parse_match_data(route, true, effective_environment, sources, max_color_level)
        .map(ParseOutcome::Matches)
}

fn parse_match_data(
    route: Route<'_>,
    require_all_arguments: bool,
    effective_environment: BTreeMap<String, String>,
    sources: InputSources,
    max_color_level: ColorLevel,
) -> Result<Matches, ParseError> {
    let path = command_path(&route.chain);
    let option_entries = effective_option_entries(&route.chain);
    let options = option_entries
        .iter()
        .map(|entry| entry.spec.clone())
        .collect::<Vec<_>>();
    let long_options = options
        .iter()
        .map(|option| (option.cli_long(), option))
        .collect::<BTreeMap<_, _>>();
    let short_options = options
        .iter()
        .filter_map(|option| option.short_name().map(|short| (short, option)))
        .collect::<BTreeMap<_, _>>();
    let mut values = BTreeMap::new();
    let mut present_options = BTreeSet::new();
    let mut option_sources = BTreeMap::new();
    let mut positionals = Vec::new();
    let mut after_separator = false;
    // How many positionals precede `--`, so a token after it is never mistaken for a subcommand.
    let mut separator_at = None;
    let mut index = 0;
    let preset_token_count = sources.preset().argv().len().min(route.tail.len());

    while index < route.tail.len() {
        let token = &route.tail[index];
        if after_separator {
            positionals.push(token.clone());
            index += 1;
            continue;
        }
        if token == "--" {
            separator_at = Some(positionals.len());
            after_separator = true;
            index += 1;
            continue;
        }
        let source = if index < preset_token_count {
            InputSourceKind::Preset
        } else {
            InputSourceKind::User
        };
        let mut state = OptionValueState {
            values: &mut values,
            present_options: &mut present_options,
            option_sources: &mut option_sources,
            source,
            validate_values: true,
        };
        if token.starts_with("--") {
            index = parse_long_option(&route.tail, index, &path, &long_options, &mut state)?;
            continue;
        }
        if is_short_option_token(token) {
            index = parse_short_options(&route.tail, index, &path, &short_options, &mut state)?;
            continue;
        }
        positionals.push(token.clone());
        index += 1;
    }

    for option in &options {
        if !present_options.contains(&option.long)
            && let Some(default) = &option.default
        {
            values.insert(option.long.clone(), default.clone());
        }
    }

    if require_all_arguments {
        for option in &options {
            if option.required && !present_options.contains(&option.long) {
                return Err(ParseError::new(
                    ParseErrorKind::MissingRequiredOption,
                    &path,
                    format!("missing required option \"--{}\"", option.cli_long()),
                ));
            }
        }
    }

    let builtin_longs = option_entries
        .iter()
        .filter_map(|entry| {
            (entry.origin == OptionOrigin::Builtin).then_some(entry.spec.long.as_str())
        })
        .collect::<BTreeSet<_>>();
    if builtin_longs.contains("devmode")
        && builtin_longs.contains("logLevel")
        && values.get("devmode") == Some(&Value::Bool(true))
        && !present_options.contains("logLevel")
    {
        values.insert("logLevel".to_owned(), Value::String("debug".to_owned()));
    }
    let color_level = if builtin_longs.contains("color") {
        let explicit_color = present_options.contains("color");
        let color_enabled = values.get("color") == Some(&Value::Bool(true))
            && (explicit_color || !effective_environment.contains_key("NO_COLOR"))
            && max_color_level != ColorLevel::None;
        values.insert("color".to_owned(), Value::Bool(color_enabled));
        if color_enabled {
            max_color_level
        } else {
            ColorLevel::None
        }
    } else {
        ColorLevel::None
    };

    let leaf = route
        .chain
        .last()
        .copied()
        .expect("command chain always contains the root");
    let arguments = parse_arguments(
        leaf,
        &route.chain,
        &positionals,
        require_all_arguments,
        separator_at,
    )?;

    let leaf_depth = route.chain.len() - 1;
    let mut local_options = BTreeMap::new();
    let mut effective_options = BTreeMap::new();
    let mut user_present = BTreeSet::new();
    let mut builtin_values = BTreeMap::new();
    let mut builtin_present = BTreeSet::new();
    for entry in option_entries {
        let Some(value) = values.get(&entry.spec.long).cloned() else {
            continue;
        };
        match entry.origin {
            OptionOrigin::Builtin => {
                if present_options.contains(&entry.spec.long) {
                    builtin_present.insert(entry.spec.long.clone());
                }
                builtin_values.insert(entry.spec.long, value);
            }
            OptionOrigin::User { depth } => {
                if present_options.contains(&entry.spec.long) {
                    user_present.insert(entry.spec.long.clone());
                }
                if depth == leaf_depth {
                    local_options.insert(entry.spec.long.clone(), value.clone());
                }
                effective_options.insert(entry.spec.long, value);
            }
        }
    }
    Ok(Matches::new(MatchesData {
        command_path: canonical_path(&route.chain),
        local_options,
        effective_options,
        present_options: user_present,
        builtins: BuiltinMatches::new(builtin_values, builtin_present, color_level),
        option_sources,
        arguments,
        raw_arguments: positionals,
        had_separator: after_separator,
        effective_environment,
        sources,
    }))
}

fn parse_long_option(
    tokens: &[String],
    index: usize,
    command_path: &str,
    options: &BTreeMap<String, &OptionSpec>,
    state: &mut OptionValueState<'_>,
) -> Result<usize, ParseError> {
    let token = &tokens[index];
    let body = token.strip_prefix("--").unwrap_or_default();
    let (raw_name, inline_value) = body
        .split_once('=')
        .map_or((body, None), |(name, value)| (name, Some(value)));
    let normalized = raw_name.to_ascii_lowercase();
    if normalized == "no-" {
        return Err(ParseError::new(
            ParseErrorKind::InvalidNegativeOption,
            command_path,
            "negative option \"--no-\" is missing its option name",
        ));
    }
    validate_long_name(&normalized, command_path).map_err(|error| error.with_option(raw_name))?;
    let (negative, name) = normalized
        .strip_prefix("no-")
        .map_or((false, normalized.as_str()), |name| (true, name));
    let Some(option) = options.get(name).copied() else {
        return Err(ParseError::new(
            ParseErrorKind::UnknownOption,
            command_path,
            format!("unknown option \"--{raw_name}\" for command \"{command_path}\""),
        )
        .with_option(name));
    };

    if negative {
        if inline_value.is_some() {
            return Err(ParseError::new(
                ParseErrorKind::NegativeOptionWithValue,
                command_path,
                format!("negative option \"--{raw_name}\" does not accept a value"),
            )
            .with_option(option.long()));
        }
        if option.value_type() != ValueType::Boolean {
            return Err(ParseError::new(
                ParseErrorKind::NegativeOptionType,
                command_path,
                format!("option \"--{}\" is not boolean", option.cli_long()),
            )
            .with_option(option.long()));
        }
        if state.validate_values {
            state.values.insert(option.long.clone(), Value::Bool(false));
            state.present_options.insert(option.long.clone());
            record_option_source(state.option_sources, option.long(), state.source);
        }
        return Ok(index + 1);
    }

    parse_option_value(tokens, index, inline_value, command_path, option, state)
}

fn parse_short_options(
    tokens: &[String],
    index: usize,
    command_path: &str,
    options: &BTreeMap<char, &OptionSpec>,
    state: &mut OptionValueState<'_>,
) -> Result<usize, ParseError> {
    let token = &tokens[index];
    if token.contains('=') {
        return Err(ParseError::new(
            ParseErrorKind::UnsupportedShortSyntax,
            command_path,
            format!("invalid short option syntax \"{token}\""),
        ));
    }
    let shorts = token.strip_prefix('-').unwrap_or_default();
    let count = shorts.chars().count();
    for (position, short) in shorts.chars().enumerate() {
        let Some(option) = options.get(&short).copied() else {
            return Err(ParseError::new(
                ParseErrorKind::UnknownOption,
                command_path,
                format!("unknown option \"-{short}\" for command \"{command_path}\""),
            ));
        };
        if option.arity() == OptionArity::None {
            if state.validate_values {
                state.values.insert(option.long.clone(), Value::Bool(true));
                state.present_options.insert(option.long.clone());
                record_option_source(state.option_sources, option.long(), state.source);
            }
            continue;
        }
        if position + 1 != count {
            return Err(ParseError::new(
                ParseErrorKind::UnsupportedShortSyntax,
                command_path,
                format!("value-taking option \"-{short}\" must be last in a short-option cluster"),
            ));
        }
        return parse_option_value(tokens, index, None, command_path, option, state);
    }
    Ok(index + 1)
}

fn parse_option_value(
    tokens: &[String],
    index: usize,
    inline_value: Option<&str>,
    command_path: &str,
    option: &OptionSpec,
    state: &mut OptionValueState<'_>,
) -> Result<usize, ParseError> {
    if option.arity() == OptionArity::None {
        let parsed = match inline_value {
            None => true,
            Some("true") => true,
            Some("false") => false,
            Some(value) => {
                return Err(ParseError::new(
                    ParseErrorKind::InvalidBooleanValue,
                    command_path,
                    format!(
                        "invalid value \"{value}\" for boolean option \"--{}\"; use \"true\" or \"false\"",
                        option.cli_long()
                    ),
                )
                .with_option(option.long()));
            }
        };
        if state.validate_values {
            state
                .values
                .insert(option.long.clone(), Value::Bool(parsed));
            state.present_options.insert(option.long.clone());
            record_option_source(state.option_sources, option.long(), state.source);
        }
        return Ok(index + 1);
    }

    if let Some(inline) = inline_value {
        if state.validate_values {
            let value = convert_value(inline, option, command_path)?;
            insert_value(state.values, option, value);
            state.present_options.insert(option.long.clone());
            record_option_source(state.option_sources, option.long(), state.source);
        }
        return Ok(index + 1);
    }

    match option.arity() {
        OptionArity::Required => {
            let Some(raw) = tokens.get(index + 1) else {
                return Err(missing_option_value(command_path, option));
            };
            if !is_option_value(raw, option) {
                return Err(option_shaped_value(command_path, option, raw));
            }
            if state.validate_values {
                let value = convert_value(raw, option, command_path)?;
                insert_value(state.values, option, value);
                state.present_options.insert(option.long.clone());
                record_option_source(state.option_sources, option.long(), state.source);
            }
            Ok(index + 2)
        }
        OptionArity::Optional => {
            if let Some(raw) = tokens
                .get(index + 1)
                .filter(|token| is_option_value(token, option))
            {
                if state.validate_values {
                    let value = convert_value(raw, option, command_path)?;
                    insert_value(state.values, option, value);
                    state.present_options.insert(option.long.clone());
                    record_option_source(state.option_sources, option.long(), state.source);
                }
                Ok(index + 2)
            } else {
                if state.validate_values {
                    state.values.insert(option.long.clone(), Value::None);
                    state.present_options.insert(option.long.clone());
                    record_option_source(state.option_sources, option.long(), state.source);
                }
                Ok(index + 1)
            }
        }
        OptionArity::Variadic => {
            let mut cursor = index + 1;
            let mut converted = Vec::new();
            while let Some(raw) = tokens
                .get(cursor)
                .filter(|token| is_option_value(token, option))
            {
                if state.validate_values {
                    converted.push(convert_value(raw, option, command_path)?);
                }
                cursor += 1;
            }
            if state.validate_values {
                insert_variadic_values(state.values, option, converted);
                state.present_options.insert(option.long.clone());
                record_option_source(state.option_sources, option.long(), state.source);
            }
            Ok(cursor)
        }
        OptionArity::None => unreachable!("no-value options return before value parsing"),
    }
}

fn convert_value(raw: &str, option: &OptionSpec, command_path: &str) -> Result<Value, ParseError> {
    let value = if let Some(coercer) = &option.coercer {
        coercer.coerce(raw).map_err(|message| {
            ParseError::new(ParseErrorKind::InvalidOptionValue, command_path, message)
                .with_option(option.long())
        })?
    } else {
        match option.value_type() {
            ValueType::Boolean => unreachable!("boolean options do not consume values"),
            ValueType::String => Value::String(raw.to_owned()),
            ValueType::Integer => {
                parse_integer_literal(raw)
                    .map(Value::Integer)
                    .ok_or_else(|| {
                        ParseError::new(
                            ParseErrorKind::InvalidOptionValue,
                            command_path,
                            format!(
                                "invalid integer \"{raw}\" for option \"--{}\"",
                                option.cli_long()
                            ),
                        )
                        .with_option(option.long())
                    })?
            }
            ValueType::Number => parse_number_literal(raw)
                .map(Value::Number)
                .ok_or_else(|| {
                    ParseError::new(
                        ParseErrorKind::InvalidOptionValue,
                        command_path,
                        format!(
                            "invalid finite number \"{raw}\" for option \"--{}\"",
                            option.cli_long()
                        ),
                    )
                    .with_option(option.long())
                })?,
        }
    };
    if !value_matches_scalar_type(&value, option.value_type()) {
        return Err(ParseError::new(
            ParseErrorKind::InvalidOptionValue,
            command_path,
            format!(
                "coercer for option \"--{}\" returned an incompatible value",
                option.cli_long()
            ),
        )
        .with_option(option.long()));
    }
    if !option.accepts_value(&value) {
        return Err(ParseError::new(
            ParseErrorKind::InvalidChoice,
            command_path,
            format!(
                "invalid value \"{raw}\" for option \"--{}\"; allowed: {}",
                option.cli_long(),
                option.choices.join(", ")
            ),
        )
        .with_option(option.long()));
    }
    Ok(value)
}

fn insert_value(values: &mut BTreeMap<String, Value>, option: &OptionSpec, value: Value) {
    if option.arity() == OptionArity::Variadic {
        insert_variadic_values(values, option, vec![value]);
    } else {
        values.insert(option.long.clone(), value);
    }
}

fn record_option_source(
    sources: &mut BTreeMap<String, BTreeSet<InputSourceKind>>,
    option: &str,
    source: InputSourceKind,
) {
    sources.entry(option.to_owned()).or_default().insert(source);
}

fn insert_variadic_values(
    values: &mut BTreeMap<String, Value>,
    option: &OptionSpec,
    incoming: Vec<Value>,
) {
    match option.value_type() {
        ValueType::String => {
            let mut result = match values.remove(&option.long) {
                Some(Value::Strings(values)) => values,
                _ => Vec::new(),
            };
            result.extend(incoming.into_iter().filter_map(|value| match value {
                Value::String(value) => Some(value),
                _ => None,
            }));
            values.insert(option.long.clone(), Value::Strings(result));
        }
        ValueType::Integer => {
            let mut result = match values.remove(&option.long) {
                Some(Value::Integers(values)) => values,
                _ => Vec::new(),
            };
            result.extend(incoming.into_iter().filter_map(|value| match value {
                Value::Integer(value) => Some(value),
                _ => None,
            }));
            values.insert(option.long.clone(), Value::Integers(result));
        }
        ValueType::Number => {
            let mut result = match values.remove(&option.long) {
                Some(Value::Numbers(values)) => values,
                _ => Vec::new(),
            };
            result.extend(incoming.into_iter().filter_map(|value| match value {
                Value::Number(value) => Some(value),
                _ => None,
            }));
            values.insert(option.long.clone(), Value::Numbers(result));
        }
        ValueType::Boolean => {}
    }
}

fn parse_arguments(
    command: &Command,
    chain: &[&Command],
    raw: &[String],
    require_all: bool,
    separator_at: Option<usize>,
) -> Result<BTreeMap<String, Value>, ParseError> {
    if command.arguments.is_empty() {
        if let Some(first) = raw.first() {
            // `--` declares everything after it to be data, so it can never name a subcommand.
            let after_separator = separator_at == Some(0);
            if !command.subcommands.is_empty() && !after_separator {
                return Err(unknown_subcommand_error(chain, first));
            }
            return Err(ParseError::new(
                ParseErrorKind::UnexpectedArgument,
                command_path(chain),
                format!("unexpected argument \"{first}\""),
            ));
        }
        return Ok(BTreeMap::new());
    }

    let mut arguments = BTreeMap::new();
    let mut cursor = 0;
    for argument in &command.arguments {
        match argument.cardinality {
            ArgumentCardinality::Required => {
                let Some(value) = raw.get(cursor) else {
                    if require_all {
                        return Err(ParseError::new(
                            ParseErrorKind::MissingArgument,
                            command_path(chain),
                            format!("missing required argument \"{}\"", argument.name),
                        ));
                    }
                    break;
                };
                let value = convert_argument_value(argument, value, chain)?;
                arguments.insert(argument.name.clone(), value);
                cursor += 1;
            }
            ArgumentCardinality::Optional => {
                if let Some(value) = raw.get(cursor) {
                    let value = convert_argument_value(argument, value, chain)?;
                    arguments.insert(argument.name.clone(), value);
                    cursor += 1;
                } else if require_all && let Some(default) = &argument.default {
                    arguments.insert(argument.name.clone(), default.clone());
                }
            }
            ArgumentCardinality::Variadic | ArgumentCardinality::OneOrMore => {
                let values = raw[cursor..].to_vec();
                if require_all
                    && argument.cardinality == ArgumentCardinality::OneOrMore
                    && values.is_empty()
                {
                    return Err(ParseError::new(
                        ParseErrorKind::MissingArgument,
                        command_path(chain),
                        format!("missing required argument \"{}\"", argument.name),
                    ));
                }
                let values = values
                    .iter()
                    .map(|value| convert_argument_value(argument, value, chain))
                    .collect::<Result<Vec<_>, _>>()?;
                if !values.is_empty() || require_all {
                    arguments.insert(
                        argument.name.clone(),
                        collect_argument_values(argument, values, chain)?,
                    );
                }
                cursor = raw.len();
            }
        }
    }

    if cursor < raw.len() {
        return Err(ParseError::new(
            ParseErrorKind::TooManyArguments,
            command_path(chain),
            format!(
                "too many arguments: expected at most {}, got {}",
                command.arguments.len(),
                raw.len()
            ),
        ));
    }
    Ok(arguments)
}

fn convert_argument_value(
    argument: &crate::Argument,
    raw: &str,
    chain: &[&Command],
) -> Result<Value, ParseError> {
    let value = if let Some(coercer) = &argument.coercer {
        coercer.coerce(raw).map_err(|message| {
            ParseError::new(
                ParseErrorKind::InvalidArgumentType,
                command_path(chain),
                message,
            )
        })?
    } else {
        Value::String(raw.to_owned())
    };
    if !is_scalar_value(&value) {
        return Err(ParseError::new(
            ParseErrorKind::InvalidArgumentType,
            command_path(chain),
            format!(
                "coercer for argument \"{}\" returned a non-scalar value",
                argument.name
            ),
        ));
    }
    if argument.choices.is_empty()
        || argument
            .choices
            .iter()
            .any(|choice| scalar_equals_choice(&value, choice))
    {
        return Ok(value);
    }
    Err(ParseError::new(
        ParseErrorKind::InvalidArgumentValue,
        command_path(chain),
        format!(
            "invalid value \"{raw}\" for argument \"{}\"; allowed: {}",
            argument.name,
            argument.choices.join(", ")
        ),
    ))
}

fn collect_argument_values(
    argument: &crate::Argument,
    values: Vec<Value>,
    chain: &[&Command],
) -> Result<Value, ParseError> {
    let incompatible = || {
        ParseError::new(
            ParseErrorKind::InvalidArgumentType,
            command_path(chain),
            format!(
                "coercer for variadic argument \"{}\" returned inconsistent value types",
                argument.name
            ),
        )
    };
    let Some(first) = values.first() else {
        return Ok(Value::Strings(Vec::new()));
    };
    match first {
        Value::Bool(_) => values
            .into_iter()
            .map(|value| match value {
                Value::Bool(value) => Ok(value),
                _ => Err(incompatible()),
            })
            .collect::<Result<Vec<_>, _>>()
            .map(Value::Bools),
        Value::String(_) => values
            .into_iter()
            .map(|value| match value {
                Value::String(value) => Ok(value),
                _ => Err(incompatible()),
            })
            .collect::<Result<Vec<_>, _>>()
            .map(Value::Strings),
        Value::Integer(_) => values
            .into_iter()
            .map(|value| match value {
                Value::Integer(value) => Ok(value),
                _ => Err(incompatible()),
            })
            .collect::<Result<Vec<_>, _>>()
            .map(Value::Integers),
        Value::Number(_) => values
            .into_iter()
            .map(|value| match value {
                Value::Number(value) => Ok(value),
                _ => Err(incompatible()),
            })
            .collect::<Result<Vec<_>, _>>()
            .map(Value::Numbers),
        Value::None
        | Value::Bools(_)
        | Value::Strings(_)
        | Value::Integers(_)
        | Value::Numbers(_) => Err(incompatible()),
    }
}

fn value_matches_scalar_type(value: &Value, value_type: ValueType) -> bool {
    match (value, value_type) {
        (Value::Bool(_), ValueType::Boolean)
        | (Value::String(_), ValueType::String)
        | (Value::Integer(_), ValueType::Integer) => true,
        (Value::Number(value), ValueType::Number) => value.is_finite(),
        _ => false,
    }
}

fn is_scalar_value(value: &Value) -> bool {
    match value {
        Value::Bool(_) | Value::String(_) | Value::Integer(_) => true,
        Value::Number(value) => value.is_finite(),
        Value::None
        | Value::Bools(_)
        | Value::Strings(_)
        | Value::Integers(_)
        | Value::Numbers(_) => false,
    }
}

fn scalar_equals_choice(value: &Value, choice: &str) -> bool {
    match value {
        Value::Bool(value) => choice.parse::<bool>().ok() == Some(*value),
        Value::String(value) => value == choice,
        Value::Integer(value) => parse_integer_literal(choice) == Some(*value),
        Value::Number(value) => parse_number_literal(choice) == Some(*value),
        Value::None
        | Value::Bools(_)
        | Value::Strings(_)
        | Value::Integers(_)
        | Value::Numbers(_) => false,
    }
}

fn validate_long_name(name: &str, command_path: &str) -> Result<(), ParseError> {
    let positive = name.strip_prefix("no-").unwrap_or(name);
    let valid = !positive.is_empty()
        && positive.split('-').all(|segment| {
            !segment.is_empty()
                && segment
                    .as_bytes()
                    .first()
                    .is_some_and(u8::is_ascii_lowercase)
                && segment.bytes().all(|byte| byte.is_ascii_alphanumeric())
        });
    if valid {
        return Ok(());
    }
    Err(ParseError::new(
        ParseErrorKind::InvalidOptionFormat,
        command_path,
        format!("invalid option format \"--{name}\""),
    ))
}

fn missing_option_value(command_path: &str, option: &OptionSpec) -> ParseError {
    ParseError::new(
        ParseErrorKind::MissingOptionValue,
        command_path,
        format!("missing value for option \"--{}\"", option.cli_long()),
    )
    .with_option(option.long())
}

/// A separated value that starts with `-` is refused so a mistyped option cannot be swallowed as
/// data. The token is present, though, so saying the value is missing would be wrong.
fn option_shaped_value(command_path: &str, option: &OptionSpec, token: &str) -> ParseError {
    let long = option.cli_long();
    ParseError::new(
        ParseErrorKind::MissingOptionValue,
        command_path,
        format!(
            "option \"--{long}\" requires a value, but \"{token}\" is an option token; use \"--{long}={token}\" to pass it as a value"
        ),
    )
    .with_option(option.long())
}

fn unknown_subcommand_error(chain: &[&Command], token: &str) -> ParseError {
    let command = chain
        .last()
        .copied()
        .expect("command chain always contains the root");
    let path = command_path(chain);
    let mut error = ParseError::new(
        ParseErrorKind::UnknownSubcommand,
        &path,
        format!("unknown subcommand \"{token}\" for command \"{path}\""),
    );
    if let Some(candidate) = unique_suggestion(token, &command.subcommands) {
        error = error.with_hint(
            ReasonCode::DidYouMeanSubcommand,
            format!("did you mean \"{}\"?", candidate.name),
        );
    }
    error = error.with_hint(
        ReasonCode::CommandDoesNotAcceptPositionalArguments,
        format!("command \"{path}\" does not accept positional arguments"),
    );
    error
}

fn unique_suggestion<'a>(token: &str, commands: &'a [Command]) -> Option<&'a Command> {
    let mut best = None;
    let mut best_distance = usize::MAX;
    let mut unique = false;
    for command in commands {
        let distance = levenshtein(&token.to_ascii_lowercase(), &command.name);
        if distance < best_distance {
            best = Some(command);
            best_distance = distance;
            unique = true;
        } else if distance == best_distance {
            unique = false;
        }
    }
    if best_distance <= 2 && unique {
        best.filter(|candidate| candidate.name != token)
    } else {
        None
    }
}

fn levenshtein(left: &str, right: &str) -> usize {
    let right_chars = right.chars().collect::<Vec<_>>();
    let mut previous = (0..=right_chars.len()).collect::<Vec<_>>();
    for (row, left_char) in left.chars().enumerate() {
        let mut current = vec![row + 1];
        for (column, right_char) in right_chars.iter().enumerate() {
            let substitution = previous[column] + usize::from(left_char != *right_char);
            current.push(
                (current[column] + 1)
                    .min(previous[column + 1] + 1)
                    .min(substitution),
            );
        }
        previous = current;
    }
    previous[right_chars.len()]
}

fn canonical_path(chain: &[&Command]) -> Vec<String> {
    chain.iter().map(|command| command.name.clone()).collect()
}

fn is_option_token(token: &str) -> bool {
    token.len() > 1 && token.starts_with('-')
}

fn is_option_value(token: &str, _option: &OptionSpec) -> bool {
    !is_option_token(token)
}

fn is_control_flag(token: &str) -> bool {
    matches!(token, "--help" | "-h" | "--version" | "-V")
}

fn is_short_option_token(token: &str) -> bool {
    token.len() > 1 && token.starts_with('-') && !token.starts_with("--")
}

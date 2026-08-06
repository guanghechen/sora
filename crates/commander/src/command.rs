use std::collections::{BTreeMap, BTreeSet};
use std::ffi::{OsStr, OsString};
use std::fmt::{self, Debug, Formatter};
use std::path::Path;
use std::sync::Arc;

use guanghechen_chalk::ColorLevel;

use crate::Value;
use crate::error::{DefinitionError, DefinitionErrorKind, ParseError};
use crate::help;
use crate::numeric::{parse_integer_literal, parse_number_literal};
use crate::parser::{self, ParseOutcome, ParseRequest};
use crate::preset::PresetConfig;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ValueType {
    Boolean,
    String,
    Integer,
    Number,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum OptionArity {
    None,
    Required,
    Optional,
    Variadic,
}

type CoerceFn = dyn Fn(&str) -> Result<Value, String> + Send + Sync;

#[derive(Clone)]
pub struct ScalarCoercer(Arc<CoerceFn>);

impl ScalarCoercer {
    fn new<F>(coercer: F) -> Self
    where
        F: Fn(&str) -> Result<Value, String> + Send + Sync + 'static,
    {
        Self(Arc::new(coercer))
    }

    pub(crate) fn coerce(&self, raw: &str) -> Result<Value, String> {
        (self.0)(raw)
    }
}

impl Debug for ScalarCoercer {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str("ScalarCoercer(..)")
    }
}

impl PartialEq for ScalarCoercer {
    fn eq(&self, other: &Self) -> bool {
        Arc::ptr_eq(&self.0, &other.0)
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct OptionSpec {
    pub(crate) long: String,
    pub(crate) short: Option<char>,
    pub(crate) description: String,
    pub(crate) value_type: ValueType,
    pub(crate) arity: OptionArity,
    pub(crate) choices: Vec<String>,
    pub(crate) default: Option<Value>,
    pub(crate) required: bool,
    pub(crate) coercer: Option<ScalarCoercer>,
}

impl OptionSpec {
    #[must_use]
    pub fn flag(long: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            long: long.into(),
            short: None,
            description: description.into(),
            value_type: ValueType::Boolean,
            arity: OptionArity::None,
            choices: Vec::new(),
            default: None,
            required: false,
            coercer: None,
        }
    }

    #[must_use]
    pub fn value(
        long: impl Into<String>,
        description: impl Into<String>,
        value_type: ValueType,
        arity: OptionArity,
    ) -> Self {
        Self {
            long: long.into(),
            short: None,
            description: description.into(),
            value_type,
            arity,
            choices: Vec::new(),
            default: None,
            required: false,
            coercer: None,
        }
    }

    #[must_use]
    pub fn short(mut self, short: char) -> Self {
        self.short = Some(short);
        self
    }

    #[must_use]
    pub fn choices<I, T>(mut self, choices: I) -> Self
    where
        I: IntoIterator<Item = T>,
        T: Into<String>,
    {
        self.choices = choices.into_iter().map(Into::into).collect();
        self
    }

    #[must_use]
    pub fn default(mut self, default: Value) -> Self {
        self.default = Some(default);
        self
    }

    #[must_use]
    pub fn required(mut self) -> Self {
        self.required = true;
        self
    }

    #[must_use]
    pub fn coerce<F>(mut self, coercer: F) -> Self
    where
        F: Fn(&str) -> Result<Value, String> + Send + Sync + 'static,
    {
        self.coercer = Some(ScalarCoercer::new(coercer));
        self
    }

    #[must_use]
    pub fn long(&self) -> &str {
        &self.long
    }

    #[must_use]
    pub fn short_name(&self) -> Option<char> {
        self.short
    }

    #[must_use]
    pub fn description(&self) -> &str {
        &self.description
    }

    #[must_use]
    pub fn value_type(&self) -> ValueType {
        self.value_type
    }

    #[must_use]
    pub fn arity(&self) -> OptionArity {
        self.arity
    }

    #[must_use]
    pub fn choices_ref(&self) -> &[String] {
        &self.choices
    }

    #[must_use]
    pub fn default_value(&self) -> Option<&Value> {
        self.default.as_ref()
    }

    #[must_use]
    pub fn is_required(&self) -> bool {
        self.required
    }

    #[must_use]
    pub fn cli_long(&self) -> String {
        camel_to_kebab_case(&self.long)
    }

    pub(crate) fn accepts_value(&self, value: &Value) -> bool {
        if self.choices.is_empty() {
            return true;
        }
        match value {
            Value::String(value) => self.choices.contains(value),
            Value::Strings(values) => values.iter().all(|value| self.choices.contains(value)),
            Value::Integer(value) => self
                .choices
                .iter()
                .filter_map(|choice| parse_integer_literal(choice))
                .any(|choice| choice == *value),
            Value::Integers(values) => values.iter().all(|value| {
                self.choices
                    .iter()
                    .filter_map(|choice| parse_integer_literal(choice))
                    .any(|choice| choice == *value)
            }),
            Value::Number(value) => self
                .choices
                .iter()
                .filter_map(|choice| parse_number_literal(choice))
                .any(|choice| choice == *value),
            Value::Numbers(values) => values.iter().all(|value| {
                self.choices
                    .iter()
                    .filter_map(|choice| parse_number_literal(choice))
                    .any(|choice| choice == *value)
            }),
            Value::None | Value::Bool(_) | Value::Bools(_) => false,
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ArgumentCardinality {
    Required,
    Optional,
    Variadic,
    OneOrMore,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Argument {
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) cardinality: ArgumentCardinality,
    pub(crate) choices: Vec<String>,
    pub(crate) default: Option<Value>,
    pub(crate) coercer: Option<ScalarCoercer>,
}

impl Argument {
    #[must_use]
    pub fn new(
        name: impl Into<String>,
        description: impl Into<String>,
        cardinality: ArgumentCardinality,
    ) -> Self {
        Self {
            name: name.into(),
            description: description.into(),
            cardinality,
            choices: Vec::new(),
            default: None,
            coercer: None,
        }
    }

    #[must_use]
    pub fn choices<I, T>(mut self, choices: I) -> Self
    where
        I: IntoIterator<Item = T>,
        T: Into<String>,
    {
        self.choices = choices.into_iter().map(Into::into).collect();
        self
    }

    #[must_use]
    pub fn default(mut self, default: Value) -> Self {
        self.default = Some(default);
        self
    }

    #[must_use]
    pub fn coerce<F>(mut self, coercer: F) -> Self
    where
        F: Fn(&str) -> Result<Value, String> + Send + Sync + 'static,
    {
        self.coercer = Some(ScalarCoercer::new(coercer));
        self
    }

    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    #[must_use]
    pub fn description(&self) -> &str {
        &self.description
    }

    #[must_use]
    pub fn cardinality(&self) -> ArgumentCardinality {
        self.cardinality
    }

    #[must_use]
    pub fn choices_ref(&self) -> &[String] {
        &self.choices
    }

    #[must_use]
    pub fn default_value(&self) -> Option<&Value> {
        self.default.as_ref()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Builtins {
    pub(crate) version: bool,
    pub(crate) color: bool,
    pub(crate) devmode: bool,
    pub(crate) log_level: bool,
    pub(crate) silent: bool,
    pub(crate) log_date: bool,
    pub(crate) log_colorful: bool,
}

impl Builtins {
    #[must_use]
    pub const fn enabled() -> Self {
        Self {
            version: true,
            color: true,
            devmode: true,
            log_level: true,
            silent: true,
            log_date: true,
            log_colorful: true,
        }
    }

    #[must_use]
    pub const fn disabled() -> Self {
        Self {
            version: false,
            color: false,
            devmode: false,
            log_level: false,
            silent: false,
            log_date: false,
            log_colorful: false,
        }
    }

    #[must_use]
    pub const fn version(mut self, enabled: bool) -> Self {
        self.version = enabled;
        self
    }

    #[must_use]
    pub const fn color(mut self, enabled: bool) -> Self {
        self.color = enabled;
        self
    }

    #[must_use]
    pub const fn devmode(mut self, enabled: bool) -> Self {
        self.devmode = enabled;
        self
    }

    #[must_use]
    pub const fn log_level(mut self, enabled: bool) -> Self {
        self.log_level = enabled;
        self
    }

    #[must_use]
    pub const fn silent(mut self, enabled: bool) -> Self {
        self.silent = enabled;
        self
    }

    #[must_use]
    pub const fn log_date(mut self, enabled: bool) -> Self {
        self.log_date = enabled;
        self
    }

    #[must_use]
    pub const fn log_colorful(mut self, enabled: bool) -> Self {
        self.log_colorful = enabled;
        self
    }

    #[must_use]
    pub const fn version_enabled(self) -> bool {
        self.version
    }

    #[must_use]
    pub const fn color_enabled(self) -> bool {
        self.color
    }

    #[must_use]
    pub const fn devmode_enabled(self) -> bool {
        self.devmode
    }

    #[must_use]
    pub const fn log_level_enabled(self) -> bool {
        self.log_level
    }

    #[must_use]
    pub const fn silent_enabled(self) -> bool {
        self.silent
    }

    #[must_use]
    pub const fn log_date_enabled(self) -> bool {
        self.log_date
    }

    #[must_use]
    pub const fn log_colorful_enabled(self) -> bool {
        self.log_colorful
    }

    pub(crate) fn reserves(self, long: &str) -> bool {
        match long {
            "color" => self.color,
            "devmode" => self.devmode,
            "logLevel" => self.log_level,
            "silent" => self.silent,
            "logDate" => self.log_date,
            "logColorful" => self.log_colorful,
            _ => false,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Example {
    title: String,
    usage: String,
    description: String,
}

impl Example {
    #[must_use]
    pub fn new(
        title: impl Into<String>,
        usage: impl Into<String>,
        description: impl Into<String>,
    ) -> Self {
        Self {
            title: title.into().trim().to_owned(),
            usage: usage.into().trim().to_owned(),
            description: description.into().trim().to_owned(),
        }
    }

    #[must_use]
    pub fn title(&self) -> &str {
        &self.title
    }

    #[must_use]
    pub fn usage(&self) -> &str {
        &self.usage
    }

    #[must_use]
    pub fn description(&self) -> &str {
        &self.description
    }
}

impl Default for Builtins {
    fn default() -> Self {
        Self::enabled()
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct Command {
    pub(crate) name: String,
    pub(crate) description: String,
    pub(crate) version: Option<String>,
    pub(crate) aliases: Vec<String>,
    pub(crate) options: Vec<OptionSpec>,
    pub(crate) arguments: Vec<Argument>,
    pub(crate) examples: Vec<Example>,
    pub(crate) subcommands: Vec<Command>,
    pub(crate) builtins: Builtins,
    pub(crate) preset: Option<PresetConfig>,
}

impl Command {
    #[must_use]
    pub fn builder(name: impl Into<String>, description: impl Into<String>) -> CommandBuilder {
        CommandBuilder {
            command: Self {
                name: name.into(),
                description: description.into(),
                version: None,
                aliases: Vec::new(),
                options: Vec::new(),
                arguments: Vec::new(),
                examples: Vec::new(),
                subcommands: Vec::new(),
                builtins: Builtins::default(),
                preset: None,
            },
        }
    }

    pub fn parse_from<I, T>(&self, args: I) -> Result<ParseOutcome, ParseError>
    where
        I: IntoIterator<Item = T>,
        T: Into<OsString>,
    {
        self.parse(ParseRequest::new(args))
    }

    pub fn parse_from_in<I, T>(
        &self,
        args: I,
        base_directory: &Path,
    ) -> Result<ParseOutcome, ParseError>
    where
        I: IntoIterator<Item = T>,
        T: Into<OsString>,
    {
        self.parse(ParseRequest::new(args).base_directory(base_directory))
    }

    pub fn parse(&self, request: ParseRequest) -> Result<ParseOutcome, ParseError> {
        parser::parse(self, request)
    }

    #[must_use]
    pub fn with_preset(mut self, preset: PresetConfig) -> Self {
        self.preset = Some(preset);
        self
    }

    #[must_use]
    pub fn format_help(&self) -> String {
        help::render_help(&[self], ColorLevel::None)
    }

    #[must_use]
    pub fn format_help_with(&self, color_level: ColorLevel) -> String {
        help::render_help(&[self], color_level)
    }

    #[must_use]
    pub fn help_data(&self) -> help::HelpData {
        help::build_help_data(&[self])
    }

    #[must_use]
    pub fn format_version(&self) -> Option<String> {
        help::render_version(&[self])
    }

    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    #[must_use]
    pub fn description(&self) -> &str {
        &self.description
    }

    #[must_use]
    pub fn version(&self) -> Option<&str> {
        self.version.as_deref()
    }

    #[must_use]
    pub fn aliases(&self) -> &[String] {
        &self.aliases
    }

    #[must_use]
    pub fn options(&self) -> &[OptionSpec] {
        &self.options
    }

    #[must_use]
    pub fn arguments(&self) -> &[Argument] {
        &self.arguments
    }

    #[must_use]
    pub fn examples(&self) -> &[Example] {
        &self.examples
    }

    #[must_use]
    pub fn subcommands(&self) -> &[Command] {
        &self.subcommands
    }

    #[must_use]
    pub fn builtins(&self) -> Builtins {
        self.builtins
    }

    #[must_use]
    pub fn preset(&self) -> Option<&PresetConfig> {
        self.preset.as_ref()
    }

    pub(crate) fn find_subcommand(&self, token: &str) -> Option<&Command> {
        self.subcommands.iter().find(|command| {
            command.name == token || command.aliases.iter().any(|alias| alias == token)
        })
    }
}

#[derive(Clone, Debug)]
pub struct CommandBuilder {
    command: Command,
}

impl CommandBuilder {
    #[must_use]
    pub fn version(mut self, version: impl Into<String>) -> Self {
        self.command.version = Some(version.into());
        self
    }

    #[must_use]
    pub fn alias(mut self, alias: impl Into<String>) -> Self {
        self.command.aliases.push(alias.into());
        self
    }

    #[must_use]
    pub fn builtins(mut self, builtins: Builtins) -> Self {
        self.command.builtins = builtins;
        self
    }

    #[must_use]
    pub fn preset(mut self, preset: PresetConfig) -> Self {
        self.command.preset = Some(preset);
        self
    }

    #[must_use]
    pub fn option(mut self, option: OptionSpec) -> Self {
        self.command.options.push(option);
        self
    }

    #[must_use]
    pub fn argument(mut self, argument: Argument) -> Self {
        self.command.arguments.push(argument);
        self
    }

    #[must_use]
    pub fn example(mut self, example: Example) -> Self {
        self.command.examples.push(example);
        self
    }

    #[must_use]
    pub fn subcommand(mut self, command: Command) -> Self {
        self.command.subcommands.push(command);
        self
    }

    pub fn build(self) -> Result<Command, DefinitionError> {
        validate_tree(&self.command, &[], &BTreeMap::new(), &BTreeMap::new())?;
        Ok(self.command)
    }
}

pub(crate) fn builtin_options(command: &Command) -> Vec<OptionSpec> {
    let mut options = Vec::new();
    if command.builtins.color {
        options.push(
            OptionSpec::flag("color", "Enable colored help output").default(Value::Bool(true)),
        );
    }
    if command.builtins.devmode {
        options.push(
            OptionSpec::flag("devmode", "Enable development mode").default(Value::Bool(false)),
        );
    }
    if command.builtins.log_level {
        options.push(
            OptionSpec::value(
                "logLevel",
                "Set log level",
                ValueType::String,
                OptionArity::Required,
            )
            .choices(["debug", "info", "hint", "warn", "error"])
            .default(Value::String("info".to_owned())),
        );
    }
    if command.builtins.silent {
        options.push(
            OptionSpec::flag("silent", "Suppress non-error output").default(Value::Bool(false)),
        );
    }
    if command.builtins.log_date {
        options
            .push(OptionSpec::flag("logDate", "Enable log timestamp").default(Value::Bool(true)));
    }
    if command.builtins.log_colorful {
        options.push(
            OptionSpec::flag("logColorful", "Enable colorful log output")
                .default(Value::Bool(true)),
        );
    }
    options
}

pub(crate) fn effective_options_owned(chain: &[&Command]) -> Vec<OptionSpec> {
    effective_option_entries(chain)
        .into_iter()
        .map(|entry| entry.spec)
        .collect()
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum OptionOrigin {
    Builtin,
    User { depth: usize },
}

#[derive(Clone, Debug, PartialEq)]
pub(crate) struct EffectiveOption {
    pub(crate) spec: OptionSpec,
    pub(crate) origin: OptionOrigin,
}

pub(crate) fn effective_option_entries(chain: &[&Command]) -> Vec<EffectiveOption> {
    let mut options = BTreeMap::<String, EffectiveOption>::new();
    for (depth, command) in chain.iter().enumerate() {
        for option in builtin_options(command) {
            options.insert(
                option.long.clone(),
                EffectiveOption {
                    spec: option,
                    origin: OptionOrigin::Builtin,
                },
            );
        }
        for option in &command.options {
            options.insert(
                option.long.clone(),
                EffectiveOption {
                    spec: option.clone(),
                    origin: OptionOrigin::User { depth },
                },
            );
        }
    }
    options.into_values().collect()
}

fn validate_tree(
    command: &Command,
    ancestors: &[String],
    inherited_longs: &BTreeMap<String, OptionSpec>,
    inherited_shorts: &BTreeMap<char, String>,
) -> Result<(), DefinitionError> {
    let mut path = ancestors.to_vec();
    path.push(command.name.clone());
    let path_text = path.join(" ");

    validate_command_name(&command.name, "command", &path_text)?;
    if !ancestors.is_empty() && command.name == "help" {
        return Err(DefinitionError::new(
            DefinitionErrorKind::DuplicateName,
            &path_text,
            "subcommand name \"help\" is reserved for help control",
        ));
    }
    if command.description.trim().is_empty() {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidCommand,
            &path_text,
            format!("command \"{}\" must have a description", command.name),
        ));
    }
    for example in &command.examples {
        let invalid = if example.title.is_empty() {
            Some("example title cannot be empty")
        } else if example.usage.is_empty() {
            Some("example usage cannot be empty")
        } else if example.description.is_empty() {
            Some("example description cannot be empty")
        } else {
            None
        };
        if let Some(message) = invalid {
            return Err(DefinitionError::new(
                DefinitionErrorKind::InvalidCommand,
                &path_text,
                message,
            ));
        }
    }
    if !command.arguments.is_empty() && !command.subcommands.is_empty() {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidCommand,
            &path_text,
            "command cannot define both positional arguments and subcommands",
        ));
    }

    let mut aliases = BTreeSet::new();
    for alias in &command.aliases {
        validate_command_name(alias, "alias", &path_text)?;
        if !ancestors.is_empty() && alias == "help" {
            return Err(DefinitionError::new(
                DefinitionErrorKind::DuplicateName,
                &path_text,
                "subcommand alias \"help\" is reserved for help control",
            ));
        }
        if alias == &command.name || !aliases.insert(alias.clone()) {
            return Err(DefinitionError::new(
                DefinitionErrorKind::DuplicateName,
                &path_text,
                format!(
                    "duplicate alias \"{alias}\" for command \"{}\"",
                    command.name
                ),
            ));
        }
    }

    validate_arguments(command, &path_text)?;

    let mut effective_longs = inherited_longs.clone();
    let mut effective_shorts = inherited_shorts.clone();
    for option in builtin_options(command) {
        if let Some(existing) = effective_longs.get(&option.long) {
            validate_shadow_contract(existing, &option, &path_text)?;
        }
        effective_longs.insert(option.long.clone(), option);
    }

    let mut local_longs = BTreeSet::new();
    let mut local_shorts = BTreeSet::new();
    for option in &command.options {
        validate_option(option, &path_text)?;
        if !local_longs.insert(option.long.clone()) {
            return Err(DefinitionError::new(
                DefinitionErrorKind::DuplicateName,
                &path_text,
                format!("duplicate option \"--{}\"", option.cli_long()),
            ));
        }
        if is_reserved_option(&option.long, command.builtins) {
            return Err(DefinitionError::new(
                DefinitionErrorKind::OptionConflict,
                &path_text,
                format!(
                    "option \"--{}\" conflicts with a built-in option",
                    option.cli_long()
                ),
            ));
        }
        if let Some(existing) = effective_longs.get(&option.long) {
            validate_shadow_contract(existing, option, &path_text)?;
        }
        if let Some(existing) = effective_longs.get(&option.long)
            && let Some(short) = existing.short
        {
            effective_shorts.remove(&short);
        }
        if let Some(short) = option.short {
            if !local_shorts.insert(short) {
                return Err(DefinitionError::new(
                    DefinitionErrorKind::OptionConflict,
                    &path_text,
                    format!("duplicate short option \"-{short}\""),
                ));
            }
            if let Some(existing) = effective_shorts.get(&short)
                && existing != &option.long
            {
                return Err(DefinitionError::new(
                    DefinitionErrorKind::OptionConflict,
                    &path_text,
                    format!(
                        "short option \"-{short}\" conflicts between \"--{}\" and \"--{}\"",
                        camel_to_kebab_case(existing),
                        option.cli_long()
                    ),
                ));
            }
            effective_shorts.insert(short, option.long.clone());
        }
        effective_longs.insert(option.long.clone(), option.clone());
    }

    let mut child_names = BTreeMap::<String, String>::new();
    for child in &command.subcommands {
        for name in std::iter::once(&child.name).chain(child.aliases.iter()) {
            if let Some(existing) = child_names.insert(name.clone(), child.name.clone()) {
                return Err(DefinitionError::new(
                    DefinitionErrorKind::DuplicateName,
                    &path_text,
                    format!(
                        "subcommand name or alias \"{name}\" conflicts between \"{existing}\" and \"{}\"",
                        child.name
                    ),
                ));
            }
        }
    }

    for child in &command.subcommands {
        validate_tree(child, &path, &effective_longs, &effective_shorts)?;
    }

    Ok(())
}

fn validate_command_name(
    name: &str,
    label: &str,
    command_path: &str,
) -> Result<(), DefinitionError> {
    let valid = !name.is_empty()
        && name
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        && name.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
        && name
            .as_bytes()
            .last()
            .is_some_and(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
        && !name.contains("--");
    if valid {
        return Ok(());
    }
    Err(DefinitionError::new(
        DefinitionErrorKind::InvalidCommand,
        command_path,
        format!("invalid {label} name \"{name}\""),
    ))
}

fn validate_option(option: &OptionSpec, command_path: &str) -> Result<(), DefinitionError> {
    if !is_camel_case_name(&option.long) {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidOption,
            command_path,
            format!("invalid option name \"{}\"", option.long),
        ));
    }
    if option.cli_long().starts_with("no-") {
        return Err(DefinitionError::new(
            DefinitionErrorKind::OptionConflict,
            command_path,
            format!(
                "option \"--{}\" conflicts with boolean negation syntax",
                option.cli_long()
            ),
        ));
    }
    if let Some(short) = option.short
        && (!short.is_ascii_alphanumeric() || short == 'h' || short == 'V')
    {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidOption,
            command_path,
            format!("invalid or reserved short option \"-{short}\""),
        ));
    }

    let valid_arity = match option.value_type {
        ValueType::Boolean => option.arity == OptionArity::None,
        ValueType::String => option.arity != OptionArity::None,
        ValueType::Integer | ValueType::Number => {
            matches!(option.arity, OptionArity::Required | OptionArity::Variadic)
        }
    };
    if !valid_arity {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidOption,
            command_path,
            format!(
                "invalid type and arity combination for option \"--{}\"",
                option.cli_long()
            ),
        ));
    }
    if let Some(default) = &option.default
        && (!default_matches_option(default, option) || !default_matches_choices(default, option))
    {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidOption,
            command_path,
            format!("invalid default for option \"--{}\"", option.cli_long()),
        ));
    }
    if option.value_type == ValueType::Boolean && !option.choices.is_empty() {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidOption,
            command_path,
            format!(
                "boolean option \"--{}\" cannot define choices",
                option.cli_long()
            ),
        ));
    }
    if option.value_type == ValueType::Boolean && option.coercer.is_some() {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidOption,
            command_path,
            format!(
                "boolean option \"--{}\" cannot define a scalar coercer",
                option.cli_long()
            ),
        ));
    }
    if option.required && (option.arity != OptionArity::Required || option.default.is_some()) {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidOption,
            command_path,
            format!(
                "required option \"--{}\" must use required arity and cannot define a default",
                option.cli_long()
            ),
        ));
    }
    if option
        .choices
        .iter()
        .any(|choice| !choice_matches_type(choice, option.value_type))
    {
        return Err(DefinitionError::new(
            DefinitionErrorKind::InvalidOption,
            command_path,
            format!("invalid choice for option \"--{}\"", option.cli_long()),
        ));
    }
    Ok(())
}

fn validate_arguments(command: &Command, command_path: &str) -> Result<(), DefinitionError> {
    let mut names = BTreeSet::new();
    let mut optional_seen = false;
    for (index, argument) in command.arguments.iter().enumerate() {
        if argument.name.is_empty()
            || !argument
                .name
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'-')
        {
            return Err(DefinitionError::new(
                DefinitionErrorKind::InvalidArgument,
                command_path,
                format!("invalid argument name \"{}\"", argument.name),
            ));
        }
        if !names.insert(argument.name.clone()) {
            return Err(DefinitionError::new(
                DefinitionErrorKind::DuplicateName,
                command_path,
                format!("duplicate argument \"{}\"", argument.name),
            ));
        }
        if let Some(default) = &argument.default
            && (argument.cardinality != ArgumentCardinality::Optional
                || !is_scalar_value(default)
                || !argument_accepts_value(argument, default))
        {
            return Err(DefinitionError::new(
                DefinitionErrorKind::InvalidArgument,
                command_path,
                format!("invalid default for argument \"{}\"", argument.name),
            ));
        }
        match argument.cardinality {
            ArgumentCardinality::Required if optional_seen => {
                return Err(DefinitionError::new(
                    DefinitionErrorKind::InvalidArgument,
                    command_path,
                    "required arguments must precede optional arguments",
                ));
            }
            ArgumentCardinality::Optional => optional_seen = true,
            ArgumentCardinality::Variadic | ArgumentCardinality::OneOrMore => {
                if optional_seen {
                    return Err(DefinitionError::new(
                        DefinitionErrorKind::InvalidArgument,
                        command_path,
                        "variadic and one-or-more arguments cannot follow optional arguments",
                    ));
                }
                if index + 1 != command.arguments.len() {
                    return Err(DefinitionError::new(
                        DefinitionErrorKind::InvalidArgument,
                        command_path,
                        "variadic and one-or-more arguments must be last",
                    ));
                }
                optional_seen = true;
            }
            ArgumentCardinality::Required => {}
        }
    }
    Ok(())
}

fn validate_shadow_contract(
    inherited: &OptionSpec,
    replacement: &OptionSpec,
    command_path: &str,
) -> Result<(), DefinitionError> {
    if inherited.value_type == replacement.value_type
        && inherited.arity == replacement.arity
        && inherited.required == replacement.required
        && inherited.short == replacement.short
    {
        return Ok(());
    }
    Err(DefinitionError::new(
        DefinitionErrorKind::OptionConflict,
        command_path,
        format!(
            "option \"--{}\" cannot change inherited value type, arity, presence requirement, or short name",
            replacement.cli_long()
        ),
    ))
}

fn default_matches_option(value: &Value, option: &OptionSpec) -> bool {
    let shape_matches = matches!(
        (value, option.value_type, option.arity),
        (Value::Bool(_), ValueType::Boolean, OptionArity::None)
            | (Value::String(_), ValueType::String, OptionArity::Required)
            | (Value::String(_), ValueType::String, OptionArity::Optional)
            | (Value::Strings(_), ValueType::String, OptionArity::Variadic)
            | (Value::Integer(_), ValueType::Integer, OptionArity::Required)
            | (
                Value::Integers(_),
                ValueType::Integer,
                OptionArity::Variadic
            )
            | (Value::Number(_), ValueType::Number, OptionArity::Required)
            | (Value::Numbers(_), ValueType::Number, OptionArity::Variadic)
    );
    shape_matches
        && match value {
            Value::Number(value) => value.is_finite(),
            Value::Numbers(values) => values.iter().all(|value| value.is_finite()),
            _ => true,
        }
}

fn default_matches_choices(value: &Value, option: &OptionSpec) -> bool {
    option.accepts_value(value)
}

fn choice_matches_type(choice: &str, value_type: ValueType) -> bool {
    match value_type {
        ValueType::Boolean => false,
        ValueType::String => true,
        ValueType::Integer => parse_integer_literal(choice).is_some(),
        ValueType::Number => parse_number_literal(choice).is_some(),
    }
}

fn is_reserved_option(long: &str, builtins: Builtins) -> bool {
    matches!(long, "help" | "version" | "presetFile" | "presetProfile") || builtins.reserves(long)
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

fn argument_accepts_value(argument: &Argument, value: &Value) -> bool {
    if argument.choices.is_empty() {
        return true;
    }
    argument.choices.iter().any(|choice| match value {
        Value::Bool(value) => choice.parse::<bool>().ok() == Some(*value),
        Value::String(value) => choice == value,
        Value::Integer(value) => parse_integer_literal(choice) == Some(*value),
        Value::Number(value) => parse_number_literal(choice) == Some(*value),
        Value::None
        | Value::Bools(_)
        | Value::Strings(_)
        | Value::Integers(_)
        | Value::Numbers(_) => false,
    })
}

fn is_camel_case_name(name: &str) -> bool {
    !name.is_empty()
        && name.as_bytes().first().is_some_and(u8::is_ascii_lowercase)
        && name.bytes().all(|byte| byte.is_ascii_alphanumeric())
}

pub(crate) fn camel_to_kebab_case(name: &str) -> String {
    let mut output = String::with_capacity(name.len());
    for character in name.chars() {
        if character.is_ascii_uppercase() {
            output.push('-');
            output.push(character.to_ascii_lowercase());
        } else {
            output.push(character);
        }
    }
    output
}

pub(crate) fn os_to_string(
    value: &OsStr,
    command_path: &str,
    subject: &str,
) -> Result<String, ParseError> {
    value.to_str().map(ToOwned::to_owned).ok_or_else(|| {
        ParseError::new(
            crate::ParseErrorKind::InvalidUnicode,
            command_path,
            format!("{subject} must be valid UTF-8"),
        )
    })
}

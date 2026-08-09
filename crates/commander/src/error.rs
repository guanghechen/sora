use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::path::PathBuf;

use crate::PresetSource;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DiagnosticStage {
    Definition,
    Route,
    ControlScan,
    Preset,
    Tokenize,
    BuiltinResolve,
    Resolve,
    Parse,
    Completion,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum IssueKind {
    Error,
    Hint,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum IssueScope {
    Control,
    Preset,
    Option,
    Argument,
    Command,
    Completion,
    Runtime,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ReasonCode {
    ConfigurationError,
    InvalidUnicode,
    InvalidOptionFormat,
    InvalidNegativeOption,
    NegativeOptionWithValue,
    NegativeOptionType,
    UnknownOption,
    MissingValue,
    InvalidType,
    UnsupportedShortSyntax,
    OptionConflict,
    MissingRequired,
    InvalidChoice,
    InvalidBooleanValue,
    UnknownSubcommand,
    UnexpectedArgument,
    MissingRequiredArgument,
    TooManyArguments,
    CompletionError,
    IoError,
    PresetTokenInjected,
    MixedSourceConflict,
    DidYouMeanSubcommand,
    CommandDoesNotAcceptPositionalArguments,
}

impl ReasonCode {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::ConfigurationError => "configuration_error",
            Self::InvalidUnicode => "invalid_unicode",
            Self::InvalidOptionFormat => "invalid_option_format",
            Self::InvalidNegativeOption => "invalid_negative_option",
            Self::NegativeOptionWithValue => "negative_option_with_value",
            Self::NegativeOptionType => "negative_option_type",
            Self::UnknownOption => "unknown_option",
            Self::MissingValue => "missing_value",
            Self::InvalidType => "invalid_type",
            Self::UnsupportedShortSyntax => "unsupported_short_syntax",
            Self::OptionConflict => "option_conflict",
            Self::MissingRequired => "missing_required",
            Self::InvalidChoice => "invalid_choice",
            Self::InvalidBooleanValue => "invalid_boolean_value",
            Self::UnknownSubcommand => "unknown_subcommand",
            Self::UnexpectedArgument => "unexpected_argument",
            Self::MissingRequiredArgument => "missing_required_argument",
            Self::TooManyArguments => "too_many_arguments",
            Self::CompletionError => "completion_error",
            Self::IoError => "io_error",
            Self::PresetTokenInjected => "preset_token_injected",
            Self::MixedSourceConflict => "mixed_source_conflict",
            Self::DidYouMeanSubcommand => "did_you_mean_subcommand",
            Self::CommandDoesNotAcceptPositionalArguments => {
                "command_does_not_accept_positional_arguments"
            }
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub enum InputSourceKind {
    User,
    Preset,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct SourceAttribution {
    primary: Option<InputSourceKind>,
    related: Vec<InputSourceKind>,
}

impl SourceAttribution {
    pub(crate) const fn from_primary(primary: InputSourceKind) -> Self {
        Self {
            primary: Some(primary),
            related: Vec::new(),
        }
    }

    pub(crate) fn from_related(related: impl IntoIterator<Item = InputSourceKind>) -> Self {
        Self {
            primary: None,
            related: related.into_iter().collect(),
        }
    }

    #[must_use]
    pub const fn primary(&self) -> Option<InputSourceKind> {
        self.primary
    }

    #[must_use]
    pub fn related(&self) -> &[InputSourceKind] {
        &self.related
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PresetIssueMetadata {
    file: PathBuf,
    profile: Option<String>,
    variant: Option<String>,
    option: Option<String>,
}

impl PresetIssueMetadata {
    pub(crate) fn from_source(source: &PresetSource, option: Option<&str>) -> Self {
        Self {
            file: source.file().to_path_buf(),
            profile: Some(source.profile().to_owned()),
            variant: source.variant().map(ToOwned::to_owned),
            option: option.map(ToOwned::to_owned),
        }
    }

    fn from_file(file: impl Into<PathBuf>) -> Self {
        Self {
            file: file.into(),
            profile: None,
            variant: None,
            option: None,
        }
    }

    #[must_use]
    pub fn file(&self) -> &std::path::Path {
        &self.file
    }

    #[must_use]
    pub fn profile(&self) -> Option<&str> {
        self.profile.as_deref()
    }

    #[must_use]
    pub fn variant(&self) -> Option<&str> {
        self.variant.as_deref()
    }

    #[must_use]
    pub fn option(&self) -> Option<&str> {
        self.option.as_deref()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DiagnosticIssue {
    kind: IssueKind,
    stage: DiagnosticStage,
    origin_stage: Option<DiagnosticStage>,
    scope: IssueScope,
    reason_code: ReasonCode,
    message: String,
    source: Option<SourceAttribution>,
    preset: Option<PresetIssueMetadata>,
}

impl DiagnosticIssue {
    pub(crate) fn error(
        stage: DiagnosticStage,
        scope: IssueScope,
        reason_code: ReasonCode,
        message: impl Into<String>,
    ) -> Self {
        let message = message.into();
        Self {
            kind: IssueKind::Error,
            stage,
            origin_stage: None,
            scope,
            reason_code,
            message: escape_diagnostic_text(&message),
            source: None,
            preset: None,
        }
    }

    pub(crate) fn hint(
        stage: DiagnosticStage,
        scope: IssueScope,
        reason_code: ReasonCode,
        message: impl Into<String>,
    ) -> Self {
        let message = message.into();
        Self {
            kind: IssueKind::Hint,
            stage,
            origin_stage: None,
            scope,
            reason_code,
            message: escape_diagnostic_text(&message),
            source: None,
            preset: None,
        }
    }

    pub(crate) fn with_origin_stage(mut self, origin_stage: DiagnosticStage) -> Self {
        self.origin_stage = Some(origin_stage);
        self
    }

    pub(crate) fn with_source(mut self, source: SourceAttribution) -> Self {
        self.source = Some(source);
        self
    }

    pub(crate) fn with_preset(mut self, preset: PresetIssueMetadata) -> Self {
        self.preset = Some(preset);
        self
    }

    #[must_use]
    pub const fn kind(&self) -> IssueKind {
        self.kind
    }

    #[must_use]
    pub const fn stage(&self) -> DiagnosticStage {
        self.stage
    }

    #[must_use]
    pub const fn origin_stage(&self) -> Option<DiagnosticStage> {
        self.origin_stage
    }

    #[must_use]
    pub const fn scope(&self) -> IssueScope {
        self.scope
    }

    #[must_use]
    pub const fn reason_code(&self) -> ReasonCode {
        self.reason_code
    }

    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }

    #[must_use]
    pub fn source(&self) -> Option<&SourceAttribution> {
        self.source.as_ref()
    }

    #[must_use]
    pub fn preset(&self) -> Option<&PresetIssueMetadata> {
        self.preset.as_ref()
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum DefinitionErrorKind {
    InvalidCommand,
    InvalidOption,
    InvalidArgument,
    DuplicateName,
    OptionConflict,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DefinitionError {
    kind: DefinitionErrorKind,
    command_path: String,
    message: String,
    hints: Vec<String>,
    issues: Vec<DiagnosticIssue>,
}

impl DefinitionError {
    pub(crate) fn new(
        kind: DefinitionErrorKind,
        command_path: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        let issue = DiagnosticIssue::error(
            DiagnosticStage::Definition,
            definition_scope(kind),
            definition_reason(kind),
            message,
        );
        let message = issue.message().to_owned();
        Self {
            kind,
            command_path: command_path.into(),
            message,
            hints: Vec::new(),
            issues: vec![issue],
        }
    }

    #[must_use]
    pub fn kind(&self) -> DefinitionErrorKind {
        self.kind
    }

    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }

    #[must_use]
    pub fn command_path(&self) -> &str {
        &self.command_path
    }

    #[must_use]
    pub fn hints(&self) -> &[String] {
        &self.hints
    }

    #[must_use]
    pub fn issues(&self) -> &[DiagnosticIssue] {
        &self.issues
    }
}

impl Display for DefinitionError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        render_issues(formatter, &self.command_path, &self.issues)
    }
}

impl Error for DefinitionError {}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ParseErrorKind {
    Configuration,
    InvalidUnicode,
    InvalidOptionFormat,
    InvalidNegativeOption,
    NegativeOptionWithValue,
    NegativeOptionType,
    UnknownOption,
    MissingOptionValue,
    UnexpectedOptionValue,
    InvalidOptionValue,
    InvalidChoice,
    InvalidBooleanValue,
    InvalidArgumentValue,
    InvalidArgumentType,
    UnsupportedShortSyntax,
    MissingRequiredOption,
    UnknownSubcommand,
    UnexpectedArgument,
    MissingArgument,
    TooManyArguments,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParseError {
    kind: ParseErrorKind,
    command_path: Box<str>,
    message: Box<str>,
    hints: Vec<String>,
    issues: Vec<DiagnosticIssue>,
    option: Option<Box<str>>,
}

impl ParseError {
    pub(crate) fn new(
        kind: ParseErrorKind,
        command_path: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        let (stage, scope, reason_code) = parse_issue_contract(kind);
        let mut primary = DiagnosticIssue::error(stage, scope, reason_code, message);
        if kind != ParseErrorKind::Configuration {
            primary.source = Some(SourceAttribution {
                primary: Some(InputSourceKind::User),
                related: Vec::new(),
            });
        }
        let message = primary.message().to_owned().into_boxed_str();
        Self {
            kind,
            command_path: command_path.into().into_boxed_str(),
            message,
            hints: Vec::new(),
            issues: vec![primary],
            option: None,
        }
    }

    pub(crate) fn with_option(mut self, option: impl Into<String>) -> Self {
        self.option = Some(option.into().into_boxed_str());
        self
    }

    pub(crate) fn with_hint(mut self, reason_code: ReasonCode, hint: impl Into<String>) -> Self {
        let primary = &self.issues[0];
        let scope = if reason_code == ReasonCode::PresetTokenInjected {
            IssueScope::Preset
        } else {
            primary.scope
        };
        let mut issue = DiagnosticIssue::hint(primary.stage, scope, reason_code, hint);
        if reason_code == ReasonCode::PresetTokenInjected {
            issue.origin_stage = Some(DiagnosticStage::Preset);
        }
        issue.source = primary.source.clone();
        issue.preset = primary.preset.clone();
        let hint = issue.message().to_owned();
        self.issues.push(issue);
        self.hints.push(hint);
        self
    }

    pub(crate) fn with_preset_source(mut self, source: &PresetSource) -> Self {
        let primary = &mut self.issues[0];
        primary.source = Some(SourceAttribution::from_primary(InputSourceKind::Preset));
        if primary.stage != DiagnosticStage::Preset {
            primary.origin_stage = Some(DiagnosticStage::Preset);
        }
        primary.preset = Some(PresetIssueMetadata::from_source(
            source,
            self.option.as_deref(),
        ));
        self
    }

    pub(crate) fn with_input_source(mut self, source: InputSourceKind) -> Self {
        self.issues[0].source = Some(SourceAttribution::from_primary(source));
        self
    }

    pub(crate) fn with_preset_file(mut self, file: impl Into<PathBuf>) -> Self {
        let primary = &mut self.issues[0];
        primary.source = Some(SourceAttribution::from_primary(InputSourceKind::Preset));
        primary.preset = Some(PresetIssueMetadata::from_file(file));
        self
    }

    #[must_use]
    pub fn kind(&self) -> ParseErrorKind {
        self.kind
    }

    #[must_use]
    pub fn command_path(&self) -> &str {
        &self.command_path
    }

    #[must_use]
    pub fn message(&self) -> &str {
        &self.message
    }

    #[must_use]
    pub fn hints(&self) -> &[String] {
        &self.hints
    }

    #[must_use]
    pub fn issues(&self) -> &[DiagnosticIssue] {
        &self.issues
    }
}

impl Display for ParseError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        render_issues(formatter, &self.command_path, &self.issues)
    }
}

impl Error for ParseError {}

pub(crate) fn render_issues(
    formatter: &mut Formatter<'_>,
    command_path: &str,
    issues: &[DiagnosticIssue],
) -> fmt::Result {
    let primary = &issues[0];
    writeln!(formatter, "Error: {}", primary.message)?;
    for issue in issues.iter().skip(1) {
        if issue.kind == IssueKind::Hint {
            writeln!(formatter, "Hint: {}", issue.message)?;
        }
    }
    let command_path = escape_diagnostic_text(command_path);
    write!(formatter, "Run \"{command_path} --help\" for usage.")
}

pub(crate) fn escape_diagnostic_text(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '\n' => escaped.push_str("\\n"),
            '\r' => escaped.push_str("\\r"),
            '\t' => escaped.push_str("\\t"),
            _ if character.is_control() => escaped.extend(character.escape_unicode()),
            _ if character.is_ascii() => escaped.push(character),
            _ => escaped.extend(character.escape_debug()),
        }
    }
    escaped
}

const fn definition_scope(kind: DefinitionErrorKind) -> IssueScope {
    match kind {
        DefinitionErrorKind::InvalidCommand | DefinitionErrorKind::DuplicateName => {
            IssueScope::Command
        }
        DefinitionErrorKind::InvalidOption | DefinitionErrorKind::OptionConflict => {
            IssueScope::Option
        }
        DefinitionErrorKind::InvalidArgument => IssueScope::Argument,
    }
}

const fn definition_reason(kind: DefinitionErrorKind) -> ReasonCode {
    match kind {
        DefinitionErrorKind::OptionConflict => ReasonCode::OptionConflict,
        DefinitionErrorKind::InvalidCommand
        | DefinitionErrorKind::InvalidOption
        | DefinitionErrorKind::InvalidArgument
        | DefinitionErrorKind::DuplicateName => ReasonCode::ConfigurationError,
    }
}

const fn parse_issue_contract(kind: ParseErrorKind) -> (DiagnosticStage, IssueScope, ReasonCode) {
    match kind {
        ParseErrorKind::Configuration => (
            DiagnosticStage::Preset,
            IssueScope::Preset,
            ReasonCode::ConfigurationError,
        ),
        ParseErrorKind::InvalidUnicode => (
            DiagnosticStage::Route,
            IssueScope::Runtime,
            ReasonCode::InvalidUnicode,
        ),
        ParseErrorKind::InvalidOptionFormat => (
            DiagnosticStage::Tokenize,
            IssueScope::Option,
            ReasonCode::InvalidOptionFormat,
        ),
        ParseErrorKind::InvalidNegativeOption => (
            DiagnosticStage::Tokenize,
            IssueScope::Option,
            ReasonCode::InvalidNegativeOption,
        ),
        ParseErrorKind::NegativeOptionWithValue => (
            DiagnosticStage::Tokenize,
            IssueScope::Option,
            ReasonCode::NegativeOptionWithValue,
        ),
        ParseErrorKind::NegativeOptionType => (
            DiagnosticStage::Resolve,
            IssueScope::Option,
            ReasonCode::NegativeOptionType,
        ),
        ParseErrorKind::UnknownOption => (
            DiagnosticStage::Resolve,
            IssueScope::Option,
            ReasonCode::UnknownOption,
        ),
        ParseErrorKind::MissingOptionValue => (
            DiagnosticStage::Parse,
            IssueScope::Option,
            ReasonCode::MissingValue,
        ),
        ParseErrorKind::UnexpectedOptionValue => (
            DiagnosticStage::Parse,
            IssueScope::Option,
            ReasonCode::OptionConflict,
        ),
        ParseErrorKind::InvalidOptionValue => (
            DiagnosticStage::Parse,
            IssueScope::Option,
            ReasonCode::InvalidType,
        ),
        ParseErrorKind::InvalidChoice => (
            DiagnosticStage::Parse,
            IssueScope::Option,
            ReasonCode::InvalidChoice,
        ),
        ParseErrorKind::InvalidBooleanValue => (
            DiagnosticStage::Parse,
            IssueScope::Option,
            ReasonCode::InvalidBooleanValue,
        ),
        ParseErrorKind::InvalidArgumentValue => (
            DiagnosticStage::Parse,
            IssueScope::Argument,
            ReasonCode::InvalidChoice,
        ),
        ParseErrorKind::InvalidArgumentType => (
            DiagnosticStage::Parse,
            IssueScope::Argument,
            ReasonCode::InvalidType,
        ),
        ParseErrorKind::UnsupportedShortSyntax => (
            DiagnosticStage::Tokenize,
            IssueScope::Option,
            ReasonCode::UnsupportedShortSyntax,
        ),
        ParseErrorKind::MissingRequiredOption => (
            DiagnosticStage::Parse,
            IssueScope::Option,
            ReasonCode::MissingRequired,
        ),
        ParseErrorKind::UnknownSubcommand => (
            DiagnosticStage::Route,
            IssueScope::Command,
            ReasonCode::UnknownSubcommand,
        ),
        ParseErrorKind::UnexpectedArgument => (
            DiagnosticStage::Parse,
            IssueScope::Argument,
            ReasonCode::UnexpectedArgument,
        ),
        ParseErrorKind::MissingArgument => (
            DiagnosticStage::Parse,
            IssueScope::Argument,
            ReasonCode::MissingRequiredArgument,
        ),
        ParseErrorKind::TooManyArguments => (
            DiagnosticStage::Parse,
            IssueScope::Argument,
            ReasonCode::TooManyArguments,
        ),
    }
}

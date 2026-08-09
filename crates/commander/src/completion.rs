use std::collections::BTreeSet;
use std::error::Error;
use std::ffi::OsStr;
use std::fmt::{self, Display, Formatter};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

use crate::command::{
    Argument, ArgumentCardinality, Command, OptionArity, OptionSpec, ValueType,
    effective_options_owned,
};
use crate::error::{
    DiagnosticIssue, DiagnosticStage, InputSourceKind, IssueScope, PresetIssueMetadata, ReasonCode,
    SourceAttribution, render_issues,
};
use crate::{DefinitionError, Matches, Value};

const BASH_LINE_QUERY: &str = "__guanghechen_commander_bash_line_v1__";
static TEMP_SEQUENCE: AtomicUsize = AtomicUsize::new(0);

#[derive(Debug)]
pub struct CompletionIoError {
    message: String,
    source: Option<std::io::Error>,
    issues: Vec<DiagnosticIssue>,
}

impl CompletionIoError {
    fn message(message: impl Into<String>) -> Self {
        let issue = DiagnosticIssue::error(
            DiagnosticStage::Completion,
            IssueScope::Runtime,
            ReasonCode::IoError,
            message,
        );
        let message = issue.message().to_owned();
        Self {
            issues: vec![issue],
            message,
            source: None,
        }
    }

    fn io(message: impl Into<String>, source: std::io::Error) -> Self {
        let message = message.into();
        let rendered = format!("{message}: {source}");
        let issue = DiagnosticIssue::error(
            DiagnosticStage::Completion,
            IssueScope::Runtime,
            ReasonCode::IoError,
            rendered,
        );
        let message = issue.message().to_owned();
        Self {
            issues: vec![issue],
            message,
            source: Some(source),
        }
    }

    #[must_use]
    pub fn issues(&self) -> &[DiagnosticIssue] {
        &self.issues
    }
}

impl Display for CompletionIoError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.message)?;
        Ok(())
    }
}

impl Error for CompletionIoError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        self.source.as_ref().map(|source| source as _)
    }
}

pub fn resolve_home_path(path: &str, home: Option<&OsStr>) -> Result<PathBuf, CompletionIoError> {
    let home = home.filter(|value| !value.is_empty());
    if path == "~" {
        return home.map(PathBuf::from).ok_or_else(|| {
            CompletionIoError::message(
                "cannot expand completion path because HOME and USERPROFILE are unset",
            )
        });
    }
    if let Some(relative) = path.strip_prefix("~/").or_else(|| path.strip_prefix("~\\")) {
        let home = home.ok_or_else(|| {
            CompletionIoError::message(
                "cannot expand completion path because HOME and USERPROFILE are unset",
            )
        })?;
        return Ok(PathBuf::from(home).join(relative));
    }
    Ok(PathBuf::from(path))
}

pub fn write_completion_file(path: &Path, content: &[u8]) -> Result<(), CompletionIoError> {
    if let Some(parent) = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
    {
        fs::create_dir_all(parent).map_err(|error| {
            CompletionIoError::io(
                format!(
                    "failed to create completion directory \"{}\"",
                    parent.display()
                ),
                error,
            )
        })?;
    }
    let parent = path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty());
    let file_name = path.file_name().ok_or_else(|| {
        CompletionIoError::message(format!(
            "completion path \"{}\" has no file name",
            path.display()
        ))
    })?;
    let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let temp_name = format!(
        ".{}.tmp-{}-{sequence}",
        file_name.to_string_lossy(),
        std::process::id()
    );
    let temp_path = parent.unwrap_or_else(|| Path::new(".")).join(temp_name);
    let result = write_and_replace(&temp_path, path, content);
    if result.is_err() {
        let _ = fs::remove_file(&temp_path);
    }
    result.map_err(|error| {
        CompletionIoError::io(
            format!("failed to write completion script \"{}\"", path.display()),
            error,
        )
    })
}

fn write_and_replace(temp_path: &Path, target_path: &Path, content: &[u8]) -> std::io::Result<()> {
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(temp_path)?;
    file.write_all(content)?;
    file.sync_all()?;
    drop(file);
    replace_file(temp_path, target_path)
}

#[cfg(not(windows))]
fn replace_file(temp_path: &Path, target_path: &Path) -> std::io::Result<()> {
    fs::rename(temp_path, target_path)
}

#[cfg(windows)]
fn replace_file(temp_path: &Path, target_path: &Path) -> std::io::Result<()> {
    let metadata = match fs::symlink_metadata(target_path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return fs::rename(temp_path, target_path);
        }
        Err(error) => return Err(error),
    };
    if metadata.is_dir() {
        return Err(std::io::Error::new(
            std::io::ErrorKind::IsADirectory,
            format!(
                "completion target \"{}\" is a directory",
                target_path.display()
            ),
        ));
    }

    let parent = target_path.parent().unwrap_or_else(|| Path::new("."));
    let file_name = target_path
        .file_name()
        .ok_or_else(|| std::io::Error::other("completion target has no file name"))?;
    let sequence = TEMP_SEQUENCE.fetch_add(1, Ordering::Relaxed);
    let backup_path = parent.join(format!(
        ".{}.backup-{}-{sequence}",
        file_name.to_string_lossy(),
        std::process::id()
    ));
    fs::rename(target_path, &backup_path)?;

    if let Err(replace_error) = fs::rename(temp_path, target_path) {
        return match fs::rename(&backup_path, target_path) {
            Ok(()) => Err(replace_error),
            Err(rollback_error) => Err(std::io::Error::new(
                rollback_error.kind(),
                format!(
                    "replacement failed: {replace_error}; rollback from \"{}\" also failed: {rollback_error}",
                    backup_path.display()
                ),
            )),
        };
    }

    // Once the replacement is installed, preserving the target is more important than cleaning an
    // internal backup. Reversing a successful replacement can turn a cleanup error into a missing
    // completion file if the restore also fails.
    let _ = fs::remove_file(&backup_path);
    Ok(())
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Shell {
    Bash,
    Fish,
    PowerShell,
}

impl Shell {
    fn flag(self) -> &'static str {
        match self {
            Self::Bash => "--bash",
            Self::Fish => "--fish",
            Self::PowerShell => "--pwsh",
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompletionPaths {
    bash: String,
    fish: String,
    powershell: String,
}

impl CompletionPaths {
    #[must_use]
    pub fn new(
        bash: impl Into<String>,
        fish: impl Into<String>,
        powershell: impl Into<String>,
    ) -> Self {
        Self {
            bash: bash.into(),
            fish: fish.into(),
            powershell: powershell.into(),
        }
    }

    #[must_use]
    pub fn for_program(program_name: &str) -> Self {
        let component = safe_path_component(program_name);
        Self {
            bash: format!("~/.local/share/bash-completion/completions/{component}"),
            fish: format!("~/.config/fish/completions/{component}.fish"),
            powershell: format!("~/.config/pwsh/completions/{component}.ps1"),
        }
    }

    #[must_use]
    pub fn path(&self, shell: Shell) -> &str {
        match shell {
            Shell::Bash => &self.bash,
            Shell::Fish => &self.fish,
            Shell::PowerShell => &self.powershell,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CompletionDestination {
    StandardOutput,
    File { path: Option<String> },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum CompletionMode {
    Generate(CompletionDestination),
    Query { words: Vec<String> },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompletionRequest {
    shell: Shell,
    mode: CompletionMode,
}

impl CompletionRequest {
    #[must_use]
    pub fn shell(&self) -> Shell {
        self.shell
    }

    #[must_use]
    pub fn mode(&self) -> &CompletionMode {
        &self.mode
    }

    #[must_use]
    pub fn destination(&self) -> Option<&CompletionDestination> {
        match &self.mode {
            CompletionMode::Generate(destination) => Some(destination),
            CompletionMode::Query { .. } => None,
        }
    }

    #[must_use]
    pub fn words(&self) -> &[String] {
        match &self.mode {
            CompletionMode::Generate(_) => &[],
            CompletionMode::Query { words } => words,
        }
    }

    #[must_use]
    pub fn resolved_path<'a>(&'a self, paths: &'a CompletionPaths) -> Option<&'a str> {
        match &self.mode {
            CompletionMode::Generate(CompletionDestination::StandardOutput)
            | CompletionMode::Query { .. } => None,
            CompletionMode::Generate(CompletionDestination::File { path: Some(path) }) => {
                Some(path)
            }
            CompletionMode::Generate(CompletionDestination::File { path: None }) => {
                Some(paths.path(self.shell))
            }
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum CompletionErrorKind {
    MissingShell,
    ConflictingShells,
    InvalidWriteValue,
    QueryWithoutSeparator,
    QueryWithWrite,
    InvalidQuery,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompletionError {
    kind: CompletionErrorKind,
    command_path: String,
    issues: Vec<DiagnosticIssue>,
}

impl CompletionError {
    fn new(
        kind: CompletionErrorKind,
        command_path: impl Into<String>,
        message: impl Into<String>,
    ) -> Self {
        let message = message.into();
        Self {
            kind,
            command_path: command_path.into(),
            issues: vec![DiagnosticIssue::error(
                DiagnosticStage::Completion,
                IssueScope::Completion,
                ReasonCode::CompletionError,
                message,
            )],
        }
    }

    fn option_conflict<'a>(
        kind: CompletionErrorKind,
        command_path: impl Into<String>,
        message: impl Into<String>,
        matches: &Matches,
        options: impl IntoIterator<Item = &'a str>,
        additional_sources: impl IntoIterator<Item = InputSourceKind>,
    ) -> Self {
        let command_path = command_path.into();
        let message = message.into();
        let options = options.into_iter().collect::<Vec<_>>();
        let mut sources = additional_sources.into_iter().collect::<BTreeSet<_>>();
        for option in &options {
            if let Some(option_sources) = matches.option_sources(option) {
                sources.extend(option_sources);
            }
        }

        let preset_option = options.iter().copied().find(|option| {
            matches
                .option_sources(option)
                .is_some_and(|sources| sources.contains(&InputSourceKind::Preset))
        });
        let preset = if sources.contains(&InputSourceKind::Preset) {
            matches
                .preset()
                .map(|source| PresetIssueMetadata::from_source(source, preset_option))
        } else {
            None
        };
        let source = match sources.iter().copied().collect::<Vec<_>>().as_slice() {
            [source] => Some(SourceAttribution::from_primary(*source)),
            [] => None,
            related => Some(SourceAttribution::from_related(related.iter().copied())),
        };

        let mut primary = DiagnosticIssue::error(
            DiagnosticStage::Completion,
            IssueScope::Option,
            ReasonCode::OptionConflict,
            message.clone(),
        );
        if let Some(source) = source {
            primary = primary.with_source(source);
        }
        if sources.contains(&InputSourceKind::Preset) {
            primary = primary.with_origin_stage(DiagnosticStage::Preset);
        }
        if let Some(preset) = &preset {
            primary = primary.with_preset(preset.clone());
        }

        let mut issues = vec![primary];
        let mixed =
            sources.contains(&InputSourceKind::User) && sources.contains(&InputSourceKind::Preset);
        if mixed {
            let mut issue = DiagnosticIssue::hint(
                DiagnosticStage::Completion,
                IssueScope::Option,
                ReasonCode::MixedSourceConflict,
                "option conflict involves both user input and preset-injected tokens",
            )
            .with_origin_stage(DiagnosticStage::Preset)
            .with_source(SourceAttribution::from_related([
                InputSourceKind::User,
                InputSourceKind::Preset,
            ]));
            if let Some(preset) = &preset {
                issue = issue.with_preset(preset.clone());
            }
            issues.push(issue);
        }
        if sources.contains(&InputSourceKind::Preset) {
            let mut issue = DiagnosticIssue::hint(
                DiagnosticStage::Completion,
                IssueScope::Preset,
                ReasonCode::PresetTokenInjected,
                "preset profile options contributed to the completion option conflict",
            )
            .with_origin_stage(DiagnosticStage::Preset)
            .with_source(SourceAttribution::from_primary(InputSourceKind::Preset));
            if let Some(preset) = preset {
                issue = issue.with_preset(preset);
            }
            issues.push(issue);
        }

        Self {
            kind,
            command_path,
            issues,
        }
    }

    #[must_use]
    pub fn kind(&self) -> CompletionErrorKind {
        self.kind
    }

    #[must_use]
    pub fn command_path(&self) -> &str {
        &self.command_path
    }

    #[must_use]
    pub fn issues(&self) -> &[DiagnosticIssue] {
        &self.issues
    }
}

impl Display for CompletionError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        render_issues(formatter, &self.command_path, &self.issues)
    }
}

impl Error for CompletionError {}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompletionOption {
    long: String,
    short: Option<char>,
    description: String,
    value_type: ValueType,
    arity: OptionArity,
    choices: Vec<String>,
    can_negate: bool,
}

impl CompletionOption {
    #[must_use]
    pub fn long(&self) -> &str {
        &self.long
    }

    #[must_use]
    pub fn short(&self) -> Option<char> {
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
    pub fn choices(&self) -> &[String] {
        &self.choices
    }

    #[must_use]
    pub fn can_negate(&self) -> bool {
        self.can_negate
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompletionArgument {
    name: String,
    cardinality: ArgumentCardinality,
    choices: Vec<String>,
}

impl CompletionArgument {
    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    #[must_use]
    pub fn cardinality(&self) -> ArgumentCardinality {
        self.cardinality
    }

    #[must_use]
    pub fn choices(&self) -> &[String] {
        &self.choices
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CompletionMeta {
    name: String,
    description: String,
    aliases: Vec<String>,
    options: Vec<CompletionOption>,
    arguments: Vec<CompletionArgument>,
    subcommands: Vec<CompletionMeta>,
}

impl CompletionMeta {
    #[must_use]
    pub fn name(&self) -> &str {
        &self.name
    }

    #[must_use]
    pub fn description(&self) -> &str {
        &self.description
    }

    #[must_use]
    pub fn aliases(&self) -> &[String] {
        &self.aliases
    }

    #[must_use]
    pub fn options(&self) -> &[CompletionOption] {
        &self.options
    }

    #[must_use]
    pub fn arguments(&self) -> &[CompletionArgument] {
        &self.arguments
    }

    #[must_use]
    pub fn subcommands(&self) -> &[CompletionMeta] {
        &self.subcommands
    }

    fn find_subcommand(&self, token: &str) -> Option<&Self> {
        self.subcommands.iter().find(|command| {
            command.name == token || command.aliases.iter().any(|alias| alias == token)
        })
    }

    fn find_long_option(&self, token: &str) -> Option<&CompletionOption> {
        self.options.iter().find(|option| option.long == token)
    }

    fn find_short_option(&self, token: char) -> Option<&CompletionOption> {
        self.options
            .iter()
            .find(|option| option.short == Some(token))
    }
}

impl Command {
    #[must_use]
    pub fn completion_meta(&self) -> CompletionMeta {
        build_meta(self, &[self])
    }
}

pub fn completion_command() -> Result<Command, DefinitionError> {
    Command::builder("completion", "Generate shell completion script")
        .option(OptionSpec::flag("bash", "Generate Bash completion script"))
        .option(OptionSpec::flag("fish", "Generate Fish completion script"))
        .option(OptionSpec::flag(
            "pwsh",
            "Generate PowerShell completion script",
        ))
        .option(
            OptionSpec::value(
                "write",
                "Write to file (use shell default path when value is omitted or empty)",
                ValueType::String,
                OptionArity::Optional,
            )
            .short('w'),
        )
        .argument(Argument::new(
            "words",
            "Command-line tokens to complete",
            ArgumentCardinality::Variadic,
        ))
        .build()
}

pub fn completion_request(matches: &Matches) -> Result<CompletionRequest, CompletionError> {
    let command_path = matches.command_path().join(" ");
    let selected = [
        ("bash", Shell::Bash),
        ("fish", Shell::Fish),
        ("pwsh", Shell::PowerShell),
    ]
    .into_iter()
    .filter_map(|(name, shell)| match matches.option(name) {
        Some(Value::Bool(true)) => Some((name, shell)),
        _ => None,
    })
    .collect::<Vec<_>>();
    let shell = match selected.as_slice() {
        [] => {
            return Err(CompletionError::new(
                CompletionErrorKind::MissingShell,
                command_path,
                "missing required option: one of \"--bash\", \"--fish\", or \"--pwsh\"",
            ));
        }
        [(_, shell)] => *shell,
        _ => {
            return Err(CompletionError::option_conflict(
                CompletionErrorKind::ConflictingShells,
                command_path,
                "options \"--bash\", \"--fish\", and \"--pwsh\" are mutually exclusive",
                matches,
                selected.iter().map(|(name, _)| *name),
                [],
            ));
        }
    };

    let destination = if matches.contains_option("write") {
        match matches.option("write") {
            Some(Value::None) => CompletionDestination::File { path: None },
            Some(Value::String(path)) if path.is_empty() => {
                CompletionDestination::File { path: None }
            }
            Some(Value::String(path)) => CompletionDestination::File {
                path: Some(path.clone()),
            },
            _ => {
                return Err(CompletionError::new(
                    CompletionErrorKind::InvalidWriteValue,
                    command_path,
                    "invalid value for option \"--write\"",
                ));
            }
        }
    } else {
        CompletionDestination::StandardOutput
    };
    let words = match matches.argument("words") {
        Some(Value::Strings(words)) => words.clone(),
        _ => Vec::new(),
    };
    if !words.is_empty() && !matches.had_separator() {
        return Err(CompletionError::new(
            CompletionErrorKind::QueryWithoutSeparator,
            command_path,
            "completion candidate queries require \"--\" before command-line tokens",
        ));
    }
    if matches.had_separator() && !matches!(destination, CompletionDestination::StandardOutput) {
        return Err(CompletionError::option_conflict(
            CompletionErrorKind::QueryWithWrite,
            command_path,
            "completion candidate queries cannot be combined with \"--write\"",
            matches,
            ["write"],
            [InputSourceKind::User],
        ));
    }

    let mode = if matches.had_separator() {
        CompletionMode::Query { words }
    } else {
        CompletionMode::Generate(destination)
    };
    Ok(CompletionRequest { shell, mode })
}

#[must_use]
pub fn complete(command: &Command, words: &[String]) -> Vec<String> {
    complete_meta(&command.completion_meta(), words)
        .into_iter()
        .map(|candidate| candidate.value)
        .collect()
}

pub fn complete_request(
    command: &Command,
    request: &CompletionRequest,
) -> Result<Vec<String>, CompletionError> {
    let CompletionMode::Query { words } = &request.mode else {
        return Err(CompletionError::new(
            CompletionErrorKind::InvalidQuery,
            "completion",
            "completion request is not a candidate query",
        ));
    };
    let candidates = match words.as_slice() {
        [marker, line, point] if request.shell == Shell::Bash && marker == BASH_LINE_QUERY => {
            let point = point.parse::<usize>().map_err(|_| {
                CompletionError::new(
                    CompletionErrorKind::InvalidQuery,
                    "completion",
                    "invalid Bash completion cursor position",
                )
            })?;
            complete_bash_line_meta(command, line, point)
        }
        [marker, ..] if request.shell == Shell::Bash && marker == BASH_LINE_QUERY => {
            return Err(CompletionError::new(
                CompletionErrorKind::InvalidQuery,
                "completion",
                "invalid Bash completion query payload",
            ));
        }
        _ => complete_meta(&command.completion_meta(), words),
    };
    Ok(candidates
        .into_iter()
        .filter(|candidate| is_query_record_safe(&candidate.value))
        .map(CompletionCandidate::into_record)
        .collect())
}

#[must_use]
pub fn complete_bash_line(command: &Command, line: &str, point: usize) -> Vec<String> {
    complete_bash_line_meta(command, line, point)
        .into_iter()
        .map(|candidate| candidate.value)
        .collect()
}

fn complete_bash_line_meta(
    command: &Command,
    line: &str,
    point: usize,
) -> Vec<CompletionCandidate> {
    let mut words = tokenize_bash_prefix(line, point);
    if !words.is_empty() {
        words.remove(0);
    }
    complete_meta(&command.completion_meta(), &words)
}

#[must_use]
pub fn generate_completion(program_name: &str, shell: Shell) -> String {
    match shell {
        Shell::Bash => generate_bash(program_name, shell),
        Shell::Fish => generate_fish(program_name, shell),
        Shell::PowerShell => generate_powershell(program_name, shell),
    }
}

fn build_meta(command: &Command, chain: &[&Command]) -> CompletionMeta {
    let mut options = effective_options_owned(chain)
        .into_iter()
        .map(|option| CompletionOption {
            long: option.cli_long(),
            short: option.short_name(),
            description: option.description().to_owned(),
            value_type: option.value_type(),
            arity: option.arity(),
            choices: option.choices_ref().to_vec(),
            can_negate: option.value_type() == ValueType::Boolean,
        })
        .collect::<Vec<_>>();
    options.push(control_option("help", 'h', "Show help information"));
    if command.builtins().version && command.version().is_some() {
        options.push(control_option("version", 'V', "Show version number"));
    }
    options.sort_by(|left, right| left.long.cmp(&right.long));

    let arguments = command
        .arguments()
        .iter()
        .map(|argument| CompletionArgument {
            name: argument.name().to_owned(),
            cardinality: argument.cardinality(),
            choices: argument.choices_ref().to_vec(),
        })
        .collect();
    let subcommands = command
        .subcommands()
        .iter()
        .map(|subcommand| {
            let mut child_chain = chain.to_vec();
            child_chain.push(subcommand);
            build_meta(subcommand, &child_chain)
        })
        .collect();

    CompletionMeta {
        name: command.name().to_owned(),
        description: command.description().to_owned(),
        aliases: command.aliases().to_vec(),
        options,
        arguments,
        subcommands,
    }
}

fn control_option(long: &str, short: char, description: &str) -> CompletionOption {
    CompletionOption {
        long: long.to_owned(),
        short: Some(short),
        description: description.to_owned(),
        value_type: ValueType::Boolean,
        arity: OptionArity::None,
        choices: Vec::new(),
        can_negate: false,
    }
}

struct CompletionCursor<'a> {
    meta: &'a CompletionMeta,
    expected: Option<&'a CompletionOption>,
    positional_count: usize,
    after_separator: bool,
    routing_open: bool,
}

#[derive(Clone, Debug, Eq, PartialEq)]
struct CompletionCandidate {
    value: String,
    description: Option<String>,
}

impl CompletionCandidate {
    fn plain(value: String) -> Self {
        Self {
            value,
            description: None,
        }
    }

    fn described(value: String, description: &str) -> Self {
        Self {
            value,
            description: (!description.is_empty()).then(|| description.to_owned()),
        }
    }

    fn into_record(self) -> String {
        let Some(description) = self.description else {
            return self.value;
        };
        let description = description.replace(['\0', '\t', '\n', '\r'], " ");
        format!("{}\t{description}", self.value)
    }
}

fn complete_meta(meta: &CompletionMeta, words: &[String]) -> Vec<CompletionCandidate> {
    let (current, completed) = words
        .split_last()
        .map_or(("", &[][..]), |(current, completed)| {
            (current.as_str(), completed)
        });
    let mut cursor = CompletionCursor {
        meta,
        expected: None,
        positional_count: 0,
        after_separator: false,
        routing_open: true,
    };
    for token in completed {
        consume_completed_token(&mut cursor, token);
    }

    let mut candidates = current_candidates(&cursor, current);
    candidates.retain(|candidate| is_candidate_safe(&candidate.value));
    candidates.sort_by(|left, right| {
        left.value
            .cmp(&right.value)
            .then_with(|| right.description.is_some().cmp(&left.description.is_some()))
    });
    candidates.dedup_by(|left, right| left.value == right.value);
    candidates
}

fn consume_completed_token<'a>(cursor: &mut CompletionCursor<'a>, token: &str) {
    if cursor.after_separator {
        cursor.positional_count += 1;
        return;
    }
    if let Some(expected) = cursor.expected {
        match expected.arity {
            OptionArity::Required => {
                cursor.expected = None;
                if !is_option_token(token) {
                    return;
                }
            }
            OptionArity::Optional => {
                cursor.expected = None;
                if !is_option_token(token) {
                    return;
                }
            }
            OptionArity::Variadic => {
                if is_option_value(token, expected) {
                    return;
                }
                cursor.expected = None;
            }
            OptionArity::None => cursor.expected = None,
        }
    }
    if token == "--" {
        cursor.after_separator = true;
        cursor.routing_open = false;
        return;
    }
    if let Some(long) = token.strip_prefix("--") {
        cursor.routing_open = false;
        consume_long_option(cursor, long);
        return;
    }
    if token.len() > 1 && token.starts_with('-') {
        cursor.routing_open = false;
        consume_short_options(cursor, &token[1..]);
        return;
    }
    if cursor.routing_open
        && let Some(subcommand) = cursor.meta.find_subcommand(token)
    {
        cursor.meta = subcommand;
        cursor.expected = None;
        cursor.positional_count = 0;
        return;
    }
    cursor.routing_open = false;
    cursor.positional_count += 1;
}

fn consume_long_option<'a>(cursor: &mut CompletionCursor<'a>, token: &str) {
    let (name, inline) = token
        .split_once('=')
        .map_or((token, false), |(name, _)| (name, true));
    let normalized = name.to_ascii_lowercase();
    let positive = normalized.strip_prefix("no-").unwrap_or(&normalized);
    if inline || normalized.starts_with("no-") {
        return;
    }
    if let Some(option) = cursor.meta.find_long_option(positive)
        && option.arity != OptionArity::None
    {
        cursor.expected = Some(option);
    }
}

fn consume_short_options<'a>(cursor: &mut CompletionCursor<'a>, token: &str) {
    if token.contains('=') {
        return;
    }
    let count = token.chars().count();
    for (index, short) in token.chars().enumerate() {
        let Some(option) = cursor.meta.find_short_option(short) else {
            return;
        };
        if option.arity != OptionArity::None && index + 1 == count {
            cursor.expected = Some(option);
        }
    }
}

fn current_candidates(cursor: &CompletionCursor<'_>, current: &str) -> Vec<CompletionCandidate> {
    if cursor.after_separator {
        return argument_candidates(cursor, current);
    }
    if let Some(expected) = cursor.expected {
        match expected.arity {
            OptionArity::Required => return choice_candidates(expected, current, None),
            OptionArity::Optional | OptionArity::Variadic => {
                let mut candidates = choice_candidates(expected, current, None);
                // An optional or variadic value list may simply be over, so at an empty prefix the
                // next token can still start an option. This mirrors the subcommand and argument
                // branches below, which both fall back to options on an empty prefix.
                if current.is_empty() || !should_complete_value(current, expected) {
                    candidates.extend(option_candidates(cursor.meta, current));
                }
                return candidates;
            }
            OptionArity::None => {}
        }
    }
    if let Some((name, prefix)) = current
        .strip_prefix("--")
        .and_then(|token| token.split_once('='))
        && let Some(option) = cursor.meta.find_long_option(&name.to_ascii_lowercase())
    {
        return choice_candidates(option, prefix, Some(&option.long));
    }
    if current.starts_with('-') {
        return option_candidates(cursor.meta, current);
    }
    if cursor.routing_open && !cursor.meta.subcommands.is_empty() {
        let mut candidates = subcommand_candidates(cursor.meta, current);
        if current.is_empty() {
            candidates.extend(option_candidates(cursor.meta, current));
        }
        return candidates;
    }
    let mut candidates = argument_candidates(cursor, current);
    if current.is_empty() {
        candidates.extend(option_candidates(cursor.meta, current));
    }
    candidates
}

fn option_candidates(meta: &CompletionMeta, prefix: &str) -> Vec<CompletionCandidate> {
    let normalized_prefix = prefix.to_ascii_lowercase();
    meta.options
        .iter()
        .flat_map(|option| {
            let mut candidates = vec![CompletionCandidate::described(
                format!("--{}", option.long),
                &option.description,
            )];
            if let Some(short) = option.short {
                candidates.push(CompletionCandidate::described(
                    format!("-{short}"),
                    &option.description,
                ));
            }
            if option.can_negate {
                candidates.push(CompletionCandidate::described(
                    format!("--no-{}", option.long),
                    &option.description,
                ));
            }
            candidates
        })
        .filter(|candidate| {
            candidate
                .value
                .to_ascii_lowercase()
                .starts_with(&normalized_prefix)
        })
        .collect()
}

fn subcommand_candidates(meta: &CompletionMeta, prefix: &str) -> Vec<CompletionCandidate> {
    meta.subcommands
        .iter()
        .flat_map(|subcommand| {
            std::iter::once(subcommand.name.clone())
                .chain(subcommand.aliases.iter().cloned())
                .filter(|candidate| candidate.starts_with(prefix))
                .map(|candidate| CompletionCandidate::described(candidate, &subcommand.description))
        })
        .collect()
}

fn choice_candidates(
    option: &CompletionOption,
    prefix: &str,
    inline_name: Option<&str>,
) -> Vec<CompletionCandidate> {
    option
        .choices
        .iter()
        .filter(|choice| inline_name.is_some() || is_separate_value_choice(option, choice))
        .filter(|choice| choice.starts_with(prefix))
        .map(|choice| match inline_name {
            Some(name) => CompletionCandidate::plain(format!("--{name}={choice}")),
            None => CompletionCandidate::plain(choice.clone()),
        })
        .collect()
}

fn is_separate_value_choice(_option: &CompletionOption, choice: &str) -> bool {
    !choice.starts_with('-')
}

fn argument_candidates(cursor: &CompletionCursor<'_>, prefix: &str) -> Vec<CompletionCandidate> {
    let Some(argument) = argument_for_slot(cursor.meta, cursor.positional_count) else {
        return Vec::new();
    };
    argument
        .choices
        .iter()
        .filter(|choice| choice.starts_with(prefix))
        .cloned()
        .map(CompletionCandidate::plain)
        .collect()
}

fn argument_for_slot(meta: &CompletionMeta, slot: usize) -> Option<&CompletionArgument> {
    if let Some(argument) = meta.arguments.get(slot) {
        return Some(argument);
    }
    let last = meta.arguments.last()?;
    if matches!(
        last.cardinality,
        ArgumentCardinality::Variadic | ArgumentCardinality::OneOrMore
    ) {
        return Some(last);
    }
    None
}

fn is_option_token(token: &str) -> bool {
    token.len() > 1 && token.starts_with('-')
}

fn is_option_value(token: &str, _option: &CompletionOption) -> bool {
    !is_option_token(token)
}

fn should_complete_value(token: &str, option: &CompletionOption) -> bool {
    if !token.starts_with('-') {
        return true;
    }
    if token.starts_with("--") {
        return false;
    }
    match option.value_type {
        ValueType::Integer => token[1..].bytes().all(|byte| byte.is_ascii_digit()),
        ValueType::Number => {
            let body = &token[1..];
            body.is_empty()
                || body.bytes().all(|byte| {
                    byte.is_ascii_digit() || matches!(byte, b'.' | b'e' | b'E' | b'+' | b'-')
                })
        }
        ValueType::Boolean | ValueType::String => false,
    }
}

fn is_candidate_safe(candidate: &str) -> bool {
    !candidate.contains(['\0', '\n', '\r'])
}

fn is_query_record_safe(candidate: &str) -> bool {
    is_candidate_safe(candidate) && !candidate.contains('\t')
}

fn tokenize_bash_prefix(line: &str, point: usize) -> Vec<String> {
    let mut end = point.min(line.len());
    while !line.is_char_boundary(end) {
        end -= 1;
    }
    let prefix = &line[..end];
    let mut words = Vec::new();
    let mut current = String::new();
    let mut started = false;
    let mut single_quoted = false;
    let mut double_quoted = false;
    let mut ansi_c_quoted = false;
    let mut characters = prefix.chars().peekable();

    while let Some(character) = characters.next() {
        if ansi_c_quoted {
            if character == '\'' {
                ansi_c_quoted = false;
                continue;
            }
            if character == '\\' {
                push_ansi_c_escape(&mut characters, &mut current);
                started = true;
                continue;
            }
            current.push(character);
            started = true;
            continue;
        }
        if character == '$' && !single_quoted && !double_quoted && characters.peek() == Some(&'\'')
        {
            characters.next();
            ansi_c_quoted = true;
            started = true;
            continue;
        }
        if character == '\\' && !single_quoted {
            started = true;
            let Some(next) = characters.peek().copied() else {
                current.push('\\');
                break;
            };
            if double_quoted && !matches!(next, '$' | '`' | '"' | '\\' | '\n') {
                current.push('\\');
                continue;
            }
            characters.next();
            if next != '\n' {
                current.push(next);
            }
            continue;
        }
        if character == '\'' && !double_quoted {
            single_quoted = !single_quoted;
            started = true;
            continue;
        }
        if character == '"' && !single_quoted {
            double_quoted = !double_quoted;
            started = true;
            continue;
        }
        if is_bash_blank(character) && !single_quoted && !double_quoted {
            if started {
                words.push(std::mem::take(&mut current));
                started = false;
            }
            continue;
        }
        current.push(character);
        started = true;
    }
    if started {
        words.push(current);
    } else if prefix.chars().last().is_some_and(is_bash_blank) {
        words.push(String::new());
    }
    words
}

fn push_ansi_c_escape(
    characters: &mut std::iter::Peekable<std::str::Chars<'_>>,
    output: &mut String,
) {
    let Some(escape) = characters.next() else {
        output.push('\\');
        return;
    };
    match escape {
        'a' => output.push('\u{0007}'),
        'b' => output.push('\u{0008}'),
        'e' | 'E' => output.push('\u{001b}'),
        'f' => output.push('\u{000c}'),
        'n' => output.push('\n'),
        'r' => output.push('\r'),
        't' => output.push('\t'),
        'v' => output.push('\u{000b}'),
        '\\' | '\'' | '"' | '?' => output.push(escape),
        'x' => push_radix_escape(characters, output, 16, 2, 'x'),
        '0'..='7' => {
            let mut value = escape.to_digit(8).unwrap_or_default();
            for _ in 1..3 {
                let Some(digit) = characters
                    .peek()
                    .and_then(|character| character.to_digit(8))
                else {
                    break;
                };
                characters.next();
                value = value * 8 + digit;
            }
            if let Some(character) = char::from_u32(value) {
                output.push(character);
            }
        }
        '\n' => {}
        other => {
            output.push('\\');
            output.push(other);
        }
    }
}

fn push_radix_escape(
    characters: &mut std::iter::Peekable<std::str::Chars<'_>>,
    output: &mut String,
    radix: u32,
    maximum_digits: usize,
    marker: char,
) {
    let mut value = 0;
    let mut digits = 0;
    while digits < maximum_digits {
        let Some(digit) = characters
            .peek()
            .and_then(|character| character.to_digit(radix))
        else {
            break;
        };
        characters.next();
        value = value * radix + digit;
        digits += 1;
    }
    if digits == 0 {
        output.push('\\');
        output.push(marker);
    } else if let Some(character) = char::from_u32(value) {
        output.push(character);
    }
}

fn is_bash_blank(character: char) -> bool {
    matches!(character, ' ' | '\t' | '\n')
}

fn generate_bash(program_name: &str, shell: Shell) -> String {
    let function_name = format!("_{}_completions", sanitize_name(program_name));
    let program = quote_posix(program_name);
    let label = comment_label(program_name);
    format!(
        "# Bash completion for {label}\n\
# Generated by guanghechen-commander\n\n\
{function_name}() {{\n\
  COMPREPLY=()\n\
  while IFS=$'\\t' read -r candidate _description; do COMPREPLY+=(\"$candidate\"); done < <(command {program} completion {} -- {BASH_LINE_QUERY} \"$COMP_LINE\" \"$COMP_POINT\")\n\
}}\n\n\
complete -F {function_name} -- {program}\n",
        shell.flag()
    )
}

fn generate_fish(program_name: &str, shell: Shell) -> String {
    let function_name = format!("__{}_complete", sanitize_name(program_name));
    let program = quote_fish(program_name);
    let label = comment_label(program_name);
    format!(
        "# Fish completion for {label}\n\
# Generated by guanghechen-commander\n\n\
function {function_name}\n\
  set -l words (commandline -opc)\n\
  if test (count $words) -gt 0\n\
    set -e words[1]\n\
  end\n\
  set -l current (commandline -ct)\n\
  command {program} completion {} -- $words \"$current\" | while read -l record\n\
    set -l fields (string split -m 1 \\t -- $record)\n\
    set -l candidate (string escape -- $fields[1])\n\
    if test (count $fields) -gt 1\n\
      printf '%s\\t%s\\n' $candidate \"$fields[2]\"\n\
    else\n\
      printf '%s\\n' $candidate\n\
    end\n\
  end\n\
end\n\n\
complete -c {program} -f -a '({function_name})'\n",
        shell.flag()
    )
}

fn generate_powershell(program_name: &str, shell: Shell) -> String {
    let program = quote_powershell(program_name);
    let label = comment_label(program_name);
    format!(
        "# PowerShell completion for {label}\n\
# Generated by guanghechen-commander\n\n\
Register-ArgumentCompleter -Native -CommandName {program} -ScriptBlock {{\n\
  param($wordToComplete, $commandAst, $cursorPosition)\n\
  $completed = @($commandAst.CommandElements | Where-Object {{ $_.Extent.EndOffset -lt $cursorPosition }} | Select-Object -Skip 1 | ForEach-Object {{ if ($_ -is [System.Management.Automation.Language.StringConstantExpressionAst]) {{ $_.Value }} else {{ $_.ToString() }} }})\n\
  $records = & {program} completion {} -- @completed $wordToComplete\n\
  foreach ($record in $records) {{\n\
    $fields = $record -split \"`t\", 2\n\
    $candidate = $fields[0]\n\
    $description = if ($fields.Count -gt 1) {{ $fields[1] }} else {{ $candidate }}\n\
    $completionText = \"'\" + $candidate.Replace(\"'\", \"''\") + \"'\"\n\
    [System.Management.Automation.CompletionResult]::new($completionText, $candidate, 'ParameterValue', $description)\n\
  }}\n\
}}\n",
        shell.flag()
    )
}

fn quote_posix(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

fn quote_fish(value: &str) -> String {
    format!("'{}'", value.replace('\\', "\\\\").replace('\'', "\\'"))
}

fn quote_powershell(value: &str) -> String {
    format!("'{}'", value.replace('\'', "''"))
}

fn sanitize_name(name: &str) -> String {
    name.chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '_'
            }
        })
        .collect()
}

fn comment_label(value: &str) -> String {
    value.replace(['\n', '\r'], " ")
}

fn safe_path_component(value: &str) -> String {
    if value.is_empty() {
        return "program".to_owned();
    }
    let mut output = String::new();
    for byte in value.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_') {
            output.push(char::from(byte));
        } else {
            output.push_str(&format!("_{byte:02X}"));
        }
    }
    output
}

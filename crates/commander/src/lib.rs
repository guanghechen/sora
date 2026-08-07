#![doc = include_str!("../README.md")]

mod command;
mod completion;
mod error;
mod help;
mod matches;
mod numeric;
mod parser;
mod preset;
mod redaction;

pub use command::{
    Argument, ArgumentCardinality, Builtins, Command, CommandBuilder, Example, OptionArity,
    OptionSpec, ValueType,
};
pub use completion::{
    CompletionArgument, CompletionDestination, CompletionError, CompletionErrorKind,
    CompletionIoError, CompletionMeta, CompletionMode, CompletionOption, CompletionPaths,
    CompletionRequest, Shell, complete, complete_bash_line, complete_request, completion_command,
    completion_request, generate_completion, resolve_home_path, write_completion_file,
};
pub use error::{
    DefinitionError, DefinitionErrorKind, DiagnosticIssue, DiagnosticStage, InputSourceKind,
    IssueKind, IssueScope, ParseError, ParseErrorKind, PresetIssueMetadata, ReasonCode,
    SourceAttribution,
};
pub use guanghechen_chalk::ColorLevel;
pub use help::{HelpData, HelpExample, HelpLine};
pub use matches::{
    BuiltinMatches, Controls, InputSources, Matches, PresetInputSource, PresetSourceState,
    UserInputSource, Value,
};
pub use parser::{ParseOutcome, ParseRequest};
pub use preset::{PRESET_FILE_FLAG, PRESET_PROFILE_FLAG, PresetConfig, PresetSource};

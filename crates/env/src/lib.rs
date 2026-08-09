#![doc = include_str!("../README.md")]

mod error;
mod files;
mod limits;
mod parser;
mod resolver;
mod stringify;

pub use error::{
    CycleError, ParseError, ParseWithLimitsError, ResolveError, ResolveFilesError,
    ResolveFilesWithLimitsError, ResolveWithLimitsError, StringifyError,
};
pub use files::{resolve_upward_files, resolve_upward_files_with_limits};
pub use limits::{EnvLimits, LimitError};
pub use parser::{parse, parse_with_limits};
pub use resolver::{resolve, resolve_upward, resolve_upward_with_limits, resolve_with_limits};
pub use stringify::{StringifyControlPolicy, StringifyOptions, stringify, stringify_with_options};

pub type EnvRecord = std::collections::BTreeMap<String, String>;

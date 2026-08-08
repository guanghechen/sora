#![doc = include_str!("../README.md")]

mod error;
mod files;
mod parser;
mod resolver;
mod stringify;

pub use error::{CycleError, ParseError, ResolveError, ResolveFilesError, StringifyError};
pub use files::resolve_upward_files;
pub use parser::parse;
pub use resolver::{resolve, resolve_upward};
pub use stringify::{StringifyOptions, stringify, stringify_with_options};

pub type EnvRecord = std::collections::BTreeMap<String, String>;

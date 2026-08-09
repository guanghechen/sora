use std::error::Error;
use std::fmt::{self, Display, Formatter};
use std::io;
use std::path::PathBuf;

use crate::LimitError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ParseError {
    line_number: usize,
    key: String,
}

impl ParseError {
    pub(crate) fn unclosed_quote(line_number: usize, key: impl Into<String>) -> Self {
        Self {
            line_number,
            key: key.into(),
        }
    }

    #[must_use]
    pub const fn line_number(&self) -> usize {
        self.line_number
    }

    #[must_use]
    pub fn key(&self) -> &str {
        &self.key
    }
}

impl Display for ParseError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "Unclosed quote for environment variable {} at line {}",
            self.key, self.line_number
        )
    }
}

impl Error for ParseError {}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ParseWithLimitsError {
    Parse(ParseError),
    Limit(LimitError),
}

impl ParseWithLimitsError {
    #[must_use]
    pub const fn parse_error(&self) -> Option<&ParseError> {
        match self {
            Self::Parse(error) => Some(error),
            Self::Limit(_) => None,
        }
    }

    #[must_use]
    pub const fn limit_error(&self) -> Option<&LimitError> {
        match self {
            Self::Limit(error) => Some(error),
            Self::Parse(_) => None,
        }
    }
}

impl Display for ParseWithLimitsError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Parse(error) => Display::fmt(error, formatter),
            Self::Limit(error) => Display::fmt(error, formatter),
        }
    }
}

impl Error for ParseWithLimitsError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Parse(error) => Some(error),
            Self::Limit(error) => Some(error),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct StringifyError {
    key: String,
    control_character: Option<char>,
}

impl StringifyError {
    pub(crate) fn invalid_key(key: impl Into<String>) -> Self {
        Self {
            key: key.into(),
            control_character: None,
        }
    }

    pub(crate) fn unsupported_control(key: impl Into<String>, control_character: char) -> Self {
        Self {
            key: key.into(),
            control_character: Some(control_character),
        }
    }

    #[must_use]
    pub fn key(&self) -> &str {
        &self.key
    }

    #[must_use]
    pub const fn control_character(&self) -> Option<char> {
        self.control_character
    }
}

impl Display for StringifyError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self.control_character {
            Some(character) => write!(
                formatter,
                "Unsupported control character U+{:04X} in environment variable {}",
                u32::from(character),
                self.key
            ),
            None => write!(formatter, "Invalid environment variable key: {}", self.key),
        }
    }
}

impl Error for StringifyError {}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CycleError {
    variables: Vec<String>,
}

impl CycleError {
    pub(crate) const fn new(variables: Vec<String>) -> Self {
        Self { variables }
    }

    #[must_use]
    pub fn variables(&self) -> &[String] {
        &self.variables
    }
}

impl Display for CycleError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "Cyclic environment reference: {}",
            self.variables.join(" -> ")
        )
    }
}

impl Error for CycleError {}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ResolveError {
    Parse {
        source_index: usize,
        error: ParseError,
    },
    Cycle(CycleError),
}

impl ResolveError {
    pub(crate) const fn parse(source_index: usize, error: ParseError) -> Self {
        Self::Parse {
            source_index,
            error,
        }
    }

    pub(crate) const fn cycle(variables: Vec<String>) -> Self {
        Self::Cycle(CycleError::new(variables))
    }

    #[must_use]
    pub const fn source_index(&self) -> Option<usize> {
        match self {
            Self::Parse { source_index, .. } => Some(*source_index),
            Self::Cycle(_) => None,
        }
    }

    #[must_use]
    pub const fn parse_error(&self) -> Option<&ParseError> {
        match self {
            Self::Parse { error, .. } => Some(error),
            Self::Cycle(_) => None,
        }
    }

    #[must_use]
    pub const fn cycle_error(&self) -> Option<&CycleError> {
        match self {
            Self::Cycle(error) => Some(error),
            Self::Parse { .. } => None,
        }
    }
}

impl Display for ResolveError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Parse {
                source_index,
                error,
            } => write!(
                formatter,
                "Failed to parse environment source {source_index}: {error}"
            ),
            Self::Cycle(error) => Display::fmt(error, formatter),
        }
    }
}

impl Error for ResolveError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Parse { error, .. } => Some(error),
            Self::Cycle(error) => Some(error),
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ResolveWithLimitsError {
    Resolve(ResolveError),
    Limit(LimitError),
}

impl ResolveWithLimitsError {
    #[must_use]
    pub const fn resolve_error(&self) -> Option<&ResolveError> {
        match self {
            Self::Resolve(error) => Some(error),
            Self::Limit(_) => None,
        }
    }

    #[must_use]
    pub const fn parse_error(&self) -> Option<&ParseError> {
        match self {
            Self::Resolve(error) => error.parse_error(),
            Self::Limit(_) => None,
        }
    }

    #[must_use]
    pub const fn cycle_error(&self) -> Option<&CycleError> {
        match self {
            Self::Resolve(error) => error.cycle_error(),
            Self::Limit(_) => None,
        }
    }

    #[must_use]
    pub const fn limit_error(&self) -> Option<&LimitError> {
        match self {
            Self::Limit(error) => Some(error),
            Self::Resolve(_) => None,
        }
    }
}

impl Display for ResolveWithLimitsError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Resolve(error) => Display::fmt(error, formatter),
            Self::Limit(error) => Display::fmt(error, formatter),
        }
    }
}

impl Error for ResolveWithLimitsError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Resolve(error) => Some(error),
            Self::Limit(error) => Some(error),
        }
    }
}

#[derive(Debug)]
pub enum ResolveFilesError {
    InvalidFileName { file_name: PathBuf },
    NotDirectory { path: PathBuf },
    RootDirectoryNotAncestor { from: PathBuf, root: PathBuf },
    Io { path: PathBuf, error: io::Error },
    Parse { path: PathBuf, error: ParseError },
    Cycle(CycleError),
}

impl ResolveFilesError {
    pub(crate) const fn invalid_file_name(file_name: PathBuf) -> Self {
        Self::InvalidFileName { file_name }
    }

    pub(crate) const fn not_directory(path: PathBuf) -> Self {
        Self::NotDirectory { path }
    }

    pub(crate) const fn root_directory_not_ancestor(from: PathBuf, root: PathBuf) -> Self {
        Self::RootDirectoryNotAncestor { from, root }
    }

    pub(crate) const fn io(path: PathBuf, error: io::Error) -> Self {
        Self::Io { path, error }
    }

    pub(crate) const fn parse(path: PathBuf, error: ParseError) -> Self {
        Self::Parse { path, error }
    }

    pub(crate) const fn cycle(error: CycleError) -> Self {
        Self::Cycle(error)
    }

    #[must_use]
    pub const fn cycle_error(&self) -> Option<&CycleError> {
        match self {
            Self::Cycle(error) => Some(error),
            _ => None,
        }
    }

    #[must_use]
    pub const fn parse_error(&self) -> Option<&ParseError> {
        match self {
            Self::Parse { error, .. } => Some(error),
            _ => None,
        }
    }

    #[must_use]
    pub const fn io_error(&self) -> Option<&io::Error> {
        match self {
            Self::Io { error, .. } => Some(error),
            _ => None,
        }
    }
}

impl Display for ResolveFilesError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidFileName { file_name } => write!(
                formatter,
                "Environment file name must be one relative path component: {}",
                file_name.display()
            ),
            Self::NotDirectory { path } => {
                write!(
                    formatter,
                    "Environment search path is not a directory: {}",
                    path.display()
                )
            }
            Self::RootDirectoryNotAncestor { from, root } => write!(
                formatter,
                "Environment root directory {} is not an ancestor of {}",
                root.display(),
                from.display()
            ),
            Self::Io { path, error } => write!(
                formatter,
                "Failed to access environment path {}: {error}",
                path.display()
            ),
            Self::Parse { path, error } => write!(
                formatter,
                "Failed to parse environment file {}: {error}",
                path.display()
            ),
            Self::Cycle(error) => Display::fmt(error, formatter),
        }
    }
}

impl Error for ResolveFilesError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Io { error, .. } => Some(error),
            Self::Parse { error, .. } => Some(error),
            Self::Cycle(error) => Some(error),
            Self::InvalidFileName { .. }
            | Self::NotDirectory { .. }
            | Self::RootDirectoryNotAncestor { .. } => None,
        }
    }
}

#[derive(Debug)]
pub enum ResolveFilesWithLimitsError {
    Resolve(ResolveFilesError),
    Limit {
        path: Option<PathBuf>,
        error: LimitError,
    },
}

impl ResolveFilesWithLimitsError {
    pub(crate) const fn limit(path: Option<PathBuf>, error: LimitError) -> Self {
        Self::Limit { path, error }
    }

    #[must_use]
    pub const fn resolve_error(&self) -> Option<&ResolveFilesError> {
        match self {
            Self::Resolve(error) => Some(error),
            Self::Limit { .. } => None,
        }
    }

    #[must_use]
    pub const fn limit_error(&self) -> Option<&LimitError> {
        match self {
            Self::Limit { error, .. } => Some(error),
            Self::Resolve(_) => None,
        }
    }

    #[must_use]
    pub fn limit_path(&self) -> Option<&std::path::Path> {
        match self {
            Self::Limit { path, .. } => path.as_deref(),
            Self::Resolve(_) => None,
        }
    }
}

impl Display for ResolveFilesWithLimitsError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::Resolve(error) => Display::fmt(error, formatter),
            Self::Limit {
                path: Some(path),
                error,
            } => write!(
                formatter,
                "Environment file {} exceeded a configured limit: {error}",
                path.display()
            ),
            Self::Limit { path: None, error } => Display::fmt(error, formatter),
        }
    }
}

impl Error for ResolveFilesWithLimitsError {
    fn source(&self) -> Option<&(dyn Error + 'static)> {
        match self {
            Self::Resolve(error) => Some(error),
            Self::Limit { error, .. } => Some(error),
        }
    }
}

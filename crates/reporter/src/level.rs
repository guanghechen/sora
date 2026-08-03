use std::fmt::{self, Display, Formatter};

#[derive(Clone, Copy, Debug, Default, Eq, Ord, PartialEq, PartialOrd)]
#[repr(u8)]
pub enum LogLevel {
    Debug = 1,
    #[default]
    Info = 2,
    Hint = 3,
    Warn = 4,
    Error = 5,
}

impl LogLevel {
    pub const ALL: [Self; 5] = [Self::Debug, Self::Info, Self::Hint, Self::Warn, Self::Error];

    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Debug => "debug",
            Self::Info => "info",
            Self::Hint => "hint",
            Self::Warn => "warn",
            Self::Error => "error",
        }
    }

    pub const fn value(self) -> u8 {
        self as u8
    }

    pub fn parse_exact(value: &str) -> Option<Self> {
        match value {
            "debug" => Some(Self::Debug),
            "info" => Some(Self::Info),
            "hint" => Some(Self::Hint),
            "warn" => Some(Self::Warn),
            "error" => Some(Self::Error),
            _ => None,
        }
    }
}

impl Display for LogLevel {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

pub fn resolve_log_level(value: &str) -> Option<LogLevel> {
    LogLevel::ALL
        .into_iter()
        .find(|level| value.eq_ignore_ascii_case(level.as_str()))
}

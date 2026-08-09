use std::fmt::{self, Display, Formatter};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct EnvLimits {
    maximum_source_bytes: usize,
    maximum_total_source_bytes: usize,
    maximum_value_bytes: usize,
    maximum_total_value_bytes: usize,
}

impl EnvLimits {
    #[must_use]
    pub const fn new(maximum_bytes: usize) -> Self {
        Self {
            maximum_source_bytes: maximum_bytes,
            maximum_total_source_bytes: maximum_bytes,
            maximum_value_bytes: maximum_bytes,
            maximum_total_value_bytes: maximum_bytes,
        }
    }

    #[must_use]
    pub const fn with_maximum_source_bytes(mut self, maximum: usize) -> Self {
        self.maximum_source_bytes = maximum;
        self
    }

    #[must_use]
    pub const fn with_maximum_total_source_bytes(mut self, maximum: usize) -> Self {
        self.maximum_total_source_bytes = maximum;
        self
    }

    #[must_use]
    pub const fn with_maximum_value_bytes(mut self, maximum: usize) -> Self {
        self.maximum_value_bytes = maximum;
        self
    }

    #[must_use]
    pub const fn with_maximum_total_value_bytes(mut self, maximum: usize) -> Self {
        self.maximum_total_value_bytes = maximum;
        self
    }

    #[must_use]
    pub const fn maximum_source_bytes(self) -> usize {
        self.maximum_source_bytes
    }

    #[must_use]
    pub const fn maximum_total_source_bytes(self) -> usize {
        self.maximum_total_source_bytes
    }

    #[must_use]
    pub const fn maximum_value_bytes(self) -> usize {
        self.maximum_value_bytes
    }

    #[must_use]
    pub const fn maximum_total_value_bytes(self) -> usize {
        self.maximum_total_value_bytes
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum LimitError {
    SourceBytes { source_index: usize, maximum: usize },
    TotalSourceBytes { maximum: usize },
    ValueBytes { key: String, maximum: usize },
    TotalValueBytes { maximum: usize },
}

impl LimitError {
    pub(crate) const fn source_bytes(source_index: usize, maximum: usize) -> Self {
        Self::SourceBytes {
            source_index,
            maximum,
        }
    }

    pub(crate) const fn total_source_bytes(maximum: usize) -> Self {
        Self::TotalSourceBytes { maximum }
    }

    pub(crate) fn value_bytes(key: impl Into<String>, maximum: usize) -> Self {
        Self::ValueBytes {
            key: key.into(),
            maximum,
        }
    }

    pub(crate) const fn total_value_bytes(maximum: usize) -> Self {
        Self::TotalValueBytes { maximum }
    }

    #[must_use]
    pub const fn source_index(&self) -> Option<usize> {
        match self {
            Self::SourceBytes { source_index, .. } => Some(*source_index),
            Self::TotalSourceBytes { .. }
            | Self::ValueBytes { .. }
            | Self::TotalValueBytes { .. } => None,
        }
    }

    #[must_use]
    pub const fn maximum(&self) -> usize {
        match self {
            Self::SourceBytes { maximum, .. }
            | Self::TotalSourceBytes { maximum }
            | Self::ValueBytes { maximum, .. }
            | Self::TotalValueBytes { maximum } => *maximum,
        }
    }

    #[must_use]
    pub fn key(&self) -> Option<&str> {
        match self {
            Self::ValueBytes { key, .. } => Some(key),
            Self::SourceBytes { .. }
            | Self::TotalSourceBytes { .. }
            | Self::TotalValueBytes { .. } => None,
        }
    }
}

impl Display for LimitError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        match self {
            Self::SourceBytes {
                source_index,
                maximum,
            } => write!(
                formatter,
                "Environment source {source_index} exceeds {maximum} bytes"
            ),
            Self::TotalSourceBytes { maximum } => write!(
                formatter,
                "Environment sources exceed {maximum} total bytes"
            ),
            Self::ValueBytes { key, maximum } => write!(
                formatter,
                "Expanded environment value {key} exceeds {maximum} bytes"
            ),
            Self::TotalValueBytes { maximum } => write!(
                formatter,
                "Expanded environment values exceed {maximum} total bytes"
            ),
        }
    }
}

impl std::error::Error for LimitError {}

pub(crate) struct SourceBudget {
    limits: EnvLimits,
    total: usize,
}

impl SourceBudget {
    pub(crate) const fn new(limits: EnvLimits) -> Self {
        Self { limits, total: 0 }
    }

    pub(crate) fn charge(&mut self, source_index: usize, bytes: usize) -> Result<(), LimitError> {
        self.check(source_index, bytes)?;
        self.total += bytes;
        Ok(())
    }

    pub(crate) fn check(&self, source_index: usize, bytes: usize) -> Result<(), LimitError> {
        if bytes > self.limits.maximum_source_bytes {
            return Err(LimitError::source_bytes(
                source_index,
                self.limits.maximum_source_bytes,
            ));
        }
        if bytes
            > self
                .limits
                .maximum_total_source_bytes
                .saturating_sub(self.total)
        {
            return Err(LimitError::total_source_bytes(
                self.limits.maximum_total_source_bytes,
            ));
        }
        Ok(())
    }

    pub(crate) const fn maximum_source_bytes(&self) -> usize {
        self.limits.maximum_source_bytes
    }

    pub(crate) const fn maximum_read_bytes(&self) -> usize {
        let remaining = self
            .limits
            .maximum_total_source_bytes
            .saturating_sub(self.total);
        if self.limits.maximum_source_bytes < remaining {
            self.limits.maximum_source_bytes
        } else {
            remaining
        }
    }
}

pub(crate) struct ValueBudget {
    limits: EnvLimits,
    total: usize,
}

impl ValueBudget {
    pub(crate) const fn new(limits: EnvLimits) -> Self {
        Self { limits, total: 0 }
    }

    pub(crate) const fn maximum_value_bytes(&self) -> usize {
        self.limits.maximum_value_bytes
    }

    pub(crate) fn charge(&mut self, bytes: usize) -> Result<(), LimitError> {
        if bytes
            > self
                .limits
                .maximum_total_value_bytes
                .saturating_sub(self.total)
        {
            return Err(LimitError::total_value_bytes(
                self.limits.maximum_total_value_bytes,
            ));
        }
        self.total += bytes;
        Ok(())
    }
}

use std::collections::BTreeMap;
use std::fmt::{self, Debug, Formatter};

pub(crate) const REDACTED: &str = "[REDACTED]";

pub(crate) struct RedactedMap<'a, K, V>(&'a BTreeMap<K, V>);

impl<'a, K, V> RedactedMap<'a, K, V> {
    pub(crate) const fn new(values: &'a BTreeMap<K, V>) -> Self {
        Self(values)
    }
}

impl<K: Debug, V> Debug for RedactedMap<'_, K, V> {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_map()
            .entries(self.0.keys().map(|key| (key, REDACTED)))
            .finish()
    }
}

pub(crate) struct RedactedSlice<'a, T>(&'a [T]);

impl<'a, T> RedactedSlice<'a, T> {
    pub(crate) const fn new(values: &'a [T]) -> Self {
        Self(values)
    }
}

impl<T> Debug for RedactedSlice<'_, T> {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_list()
            .entries(self.0.iter().map(|_| REDACTED))
            .finish()
    }
}

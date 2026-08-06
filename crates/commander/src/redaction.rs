use std::collections::BTreeMap;
use std::fmt::{self, Debug, Formatter};

const REDACTED: &str = "[REDACTED]";

pub(crate) struct RedactedEnvironment<'a, K, V>(&'a BTreeMap<K, V>);

impl<'a, K, V> RedactedEnvironment<'a, K, V> {
    pub(crate) const fn new(environment: &'a BTreeMap<K, V>) -> Self {
        Self(environment)
    }
}

impl<K: Debug, V> Debug for RedactedEnvironment<'_, K, V> {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_map()
            .entries(self.0.keys().map(|key| (key, REDACTED)))
            .finish()
    }
}

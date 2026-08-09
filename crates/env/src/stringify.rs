use std::collections::BTreeSet;

use crate::parser::is_key;
use crate::{EnvRecord, StringifyError};

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub enum StringifyControlPolicy {
    #[default]
    RejectUnsupported,
    Preserve,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct StringifyOptions {
    exclude: BTreeSet<String>,
    control_policy: StringifyControlPolicy,
}

impl StringifyOptions {
    #[must_use]
    pub const fn new() -> Self {
        Self {
            exclude: BTreeSet::new(),
            control_policy: StringifyControlPolicy::RejectUnsupported,
        }
    }

    #[must_use]
    pub fn exclude(mut self, key: impl Into<String>) -> Self {
        self.exclude.insert(key.into());
        self
    }

    #[must_use]
    pub fn is_excluded(&self, key: &str) -> bool {
        self.exclude.contains(key)
    }

    #[must_use]
    pub const fn with_control_policy(mut self, control_policy: StringifyControlPolicy) -> Self {
        self.control_policy = control_policy;
        self
    }

    #[must_use]
    pub const fn control_policy(&self) -> StringifyControlPolicy {
        self.control_policy
    }
}

pub fn stringify(env: &EnvRecord) -> Result<String, StringifyError> {
    stringify_with_options(env, &StringifyOptions::new())
}

pub fn stringify_with_options(
    env: &EnvRecord,
    options: &StringifyOptions,
) -> Result<String, StringifyError> {
    let mut output = String::new();
    for (key, value) in env {
        if options.is_excluded(key) {
            continue;
        }
        if !is_key(key) {
            return Err(StringifyError::invalid_key(key));
        }
        if options.control_policy == StringifyControlPolicy::RejectUnsupported
            && let Some(character) = value.chars().find(|character| {
                character.is_control() && !matches!(character, '\n' | '\r' | '\t')
            })
        {
            return Err(StringifyError::unsupported_control(key, character));
        }
        output.push_str(key);
        output.push('=');
        output.push_str(&stringify_value(value));
        output.push('\n');
    }
    Ok(output)
}

fn stringify_value(value: &str) -> String {
    let mut escaped = String::new();
    let mut cursor = 0;
    while cursor < value.len() {
        if let Some(end) = interpolation_end(value, cursor) {
            escaped.push('\\');
            for character in value[cursor..=end].chars() {
                push_escaped_character(&mut escaped, character);
            }
            cursor = end + 1;
            continue;
        }
        let character = value[cursor..]
            .chars()
            .next()
            .expect("cursor remains on a UTF-8 boundary");
        push_escaped_character(&mut escaped, character);
        cursor += character.len_utf8();
    }
    let needs_quote =
        escaped != value || value.chars().any(char::is_whitespace) || value.contains(['\'', '#']);
    if needs_quote {
        format!("\"{escaped}\"")
    } else {
        escaped
    }
}

fn interpolation_end(value: &str, cursor: usize) -> Option<usize> {
    if !value[cursor..].starts_with("${") {
        return None;
    }
    let name_start = cursor + 2;
    let relative_end = value[name_start..].find('}')?;
    (relative_end > 0).then_some(name_start + relative_end)
}

fn push_escaped_character(output: &mut String, character: char) {
    match character {
        '\\' => output.push_str("\\\\"),
        '"' => output.push_str("\\\""),
        '\n' => output.push_str("\\n"),
        '\r' => output.push_str("\\r"),
        '\t' => output.push_str("\\t"),
        _ => output.push(character),
    }
}

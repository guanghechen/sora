use crate::limits::{SourceBudget, ValueBudget};
use crate::{EnvLimits, EnvRecord, LimitError, ParseError, ParseWithLimitsError};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct Declaration {
    pub(crate) key: String,
    pub(crate) value: EnvValue,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum EnvValue {
    Literal(String),
    Template(Vec<Segment>),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) enum Segment {
    Literal(String),
    Variable(String),
}

impl EnvValue {
    pub(crate) fn render<'a>(&self, lookup: impl Fn(&str) -> Option<&'a str>) -> String {
        match self {
            Self::Literal(value) => value.clone(),
            Self::Template(segments) => {
                let mut output = String::new();
                for segment in segments {
                    match segment {
                        Segment::Literal(value) => output.push_str(value),
                        Segment::Variable(name) => {
                            if let Some(value) = lookup(name) {
                                output.push_str(value);
                            }
                        }
                    }
                }
                output
            }
        }
    }

    pub(crate) fn render_with_limits<'a>(
        &self,
        key: &str,
        lookup: impl Fn(&str) -> Option<&'a str>,
        budget: &mut ValueBudget,
    ) -> Result<String, LimitError> {
        let maximum = budget.maximum_value_bytes();
        let mut bytes = 0usize;
        let within_limit = self.for_each_rendered_part(&lookup, |part| {
            bytes = bytes.saturating_add(part.len());
            bytes <= maximum
        });
        if !within_limit {
            return Err(LimitError::value_bytes(key, maximum));
        }
        budget.charge(bytes)?;

        let mut output = String::with_capacity(bytes);
        let rendered = self.for_each_rendered_part(&lookup, |part| {
            output.push_str(part);
            true
        });
        debug_assert!(rendered);
        Ok(output)
    }

    fn for_each_rendered_part<'lookup>(
        &self,
        lookup: &impl Fn(&str) -> Option<&'lookup str>,
        mut visit: impl FnMut(&str) -> bool,
    ) -> bool {
        match self {
            Self::Literal(value) => {
                if !visit(value) {
                    return false;
                }
            }
            Self::Template(segments) => {
                for segment in segments {
                    let value = match segment {
                        Segment::Literal(value) => value.as_str(),
                        Segment::Variable(name) => lookup(name).unwrap_or_default(),
                    };
                    if !visit(value) {
                        return false;
                    }
                }
            }
        }
        true
    }

    pub(crate) fn for_each_dependency(&self, mut visit: impl FnMut(&str)) {
        if let Self::Template(segments) = self {
            for segment in segments {
                if let Segment::Variable(name) = segment {
                    visit(name);
                }
            }
        }
    }
}

pub fn parse(content: &str) -> Result<EnvRecord, ParseError> {
    let mut env = EnvRecord::new();
    for declaration in parse_declarations(content)? {
        let value = declaration
            .value
            .render(|name| env.get(name).map(String::as_str));
        env.insert(declaration.key, value);
    }
    Ok(env)
}

pub fn parse_with_limits(
    content: &str,
    limits: &EnvLimits,
) -> Result<EnvRecord, ParseWithLimitsError> {
    SourceBudget::new(*limits)
        .charge(0, content.len())
        .map_err(ParseWithLimitsError::Limit)?;
    let declarations = parse_declarations(content).map_err(ParseWithLimitsError::Parse)?;
    let mut budget = ValueBudget::new(*limits);
    let mut env = EnvRecord::new();
    for declaration in declarations {
        let value = declaration
            .value
            .render_with_limits(
                &declaration.key,
                |name| env.get(name).map(String::as_str),
                &mut budget,
            )
            .map_err(ParseWithLimitsError::Limit)?;
        env.insert(declaration.key, value);
    }
    Ok(env)
}

pub(crate) fn parse_declarations(content: &str) -> Result<Vec<Declaration>, ParseError> {
    if content.is_empty() {
        return Ok(Vec::new());
    }

    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let lines = normalized.split('\n').collect::<Vec<_>>();
    let mut declarations = Vec::new();
    let mut line_index = 0;
    while line_index < lines.len() {
        let line = lines[line_index];
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            line_index += 1;
            continue;
        }

        let left_trimmed = line.trim_start();
        let without_export = left_trimmed
            .strip_prefix("export ")
            .map_or(left_trimmed, str::trim_start);
        let Some(separator) = without_export.find('=') else {
            line_index += 1;
            continue;
        };
        let key = &without_export[..separator];
        if !is_key(key) {
            line_index += 1;
            continue;
        }

        let raw = &without_export[separator + 1..];
        let value = parse_value(raw, &lines, &mut line_index, key)?;
        declarations.push(Declaration {
            key: key.to_owned(),
            value,
        });
        line_index += 1;
    }
    Ok(declarations)
}

fn parse_value(
    raw: &str,
    lines: &[&str],
    line_index: &mut usize,
    key: &str,
) -> Result<EnvValue, ParseError> {
    let single_line = raw.trim_end();
    if single_line.is_empty() {
        return Ok(EnvValue::Literal(String::new()));
    }

    let quote = raw.as_bytes()[0];
    if quote == b'\'' || quote == b'"' {
        return parse_quoted_value(raw, lines, line_index, key, quote);
    }

    let value = inline_comment(single_line).map_or(single_line, |comment| &single_line[..comment]);
    Ok(parse_template(value))
}

fn parse_quoted_value(
    raw: &str,
    lines: &[&str],
    line_index: &mut usize,
    key: &str,
    quote: u8,
) -> Result<EnvValue, ParseError> {
    let start_line = *line_index + 1;
    let mut value = String::new();
    if let Some(closing) = find_closing_quote(raw, quote, 1) {
        value.push_str(&raw[1..closing]);
        return Ok(finish_quoted_value(value, quote));
    }

    value.push_str(&raw[1..]);
    while *line_index + 1 < lines.len() {
        *line_index += 1;
        let line = lines[*line_index];
        value.push('\n');
        if let Some(closing) = find_closing_quote(line, quote, 0) {
            value.push_str(&line[..closing]);
            return Ok(finish_quoted_value(value, quote));
        }
        value.push_str(line);
    }

    Err(ParseError::unclosed_quote(start_line, key))
}

fn finish_quoted_value(value: String, quote: u8) -> EnvValue {
    if quote == b'\'' {
        EnvValue::Literal(value)
    } else {
        parse_template(&unescape(&value))
    }
}

fn find_closing_quote(value: &str, quote: u8, start: usize) -> Option<usize> {
    let bytes = value.as_bytes();
    let mut index = start;
    while index < bytes.len() {
        if bytes[index] == quote && !is_escaped(bytes, index) {
            return Some(index);
        }
        index += 1;
    }
    None
}

fn is_escaped(bytes: &[u8], index: usize) -> bool {
    let mut backslashes = 0;
    let mut cursor = index;
    while cursor > 0 && bytes[cursor - 1] == b'\\' {
        backslashes += 1;
        cursor -= 1;
    }
    backslashes % 2 == 1
}

fn inline_comment(value: &str) -> Option<usize> {
    let mut whitespace = None;
    for (index, character) in value.char_indices() {
        if character.is_whitespace() {
            whitespace.get_or_insert(index);
        } else if character == '#' {
            if let Some(start) = whitespace {
                return Some(start);
            }
        } else {
            whitespace = None;
        }
    }
    None
}

pub(crate) fn is_key(key: &str) -> bool {
    let bytes = key.as_bytes();
    bytes
        .first()
        .is_some_and(|byte| byte.is_ascii_alphabetic() || *byte == b'_')
        && bytes
            .last()
            .is_some_and(|byte| byte.is_ascii_alphanumeric() || *byte == b'_')
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(*byte, b'_' | b'.' | b'-'))
}

fn unescape(value: &str) -> String {
    let mut output = String::new();
    let mut characters = value.chars().peekable();
    while let Some(character) = characters.next() {
        if character != '\\' {
            output.push(character);
            continue;
        }
        match characters.peek().copied() {
            Some('\\') => {
                output.push('\\');
                characters.next();
            }
            Some('n') => {
                output.push('\n');
                characters.next();
            }
            Some('r') => {
                output.push('\r');
                characters.next();
            }
            Some('t') => {
                output.push('\t');
                characters.next();
            }
            Some('"') => {
                output.push('"');
                characters.next();
            }
            _ => output.push('\\'),
        }
    }
    output
}

fn parse_template(value: &str) -> EnvValue {
    let mut segments = Vec::new();
    let mut literal_start = 0;
    let mut cursor = 0;
    let bytes = value.as_bytes();

    while cursor < bytes.len() {
        let escaped = bytes[cursor] == b'\\'
            && bytes.get(cursor + 1) == Some(&b'$')
            && bytes.get(cursor + 2) == Some(&b'{');
        let start = if escaped {
            cursor + 1
        } else if bytes[cursor] == b'$' && bytes.get(cursor + 1) == Some(&b'{') {
            cursor
        } else {
            let character = value[cursor..]
                .chars()
                .next()
                .expect("cursor remains on a UTF-8 boundary");
            cursor += character.len_utf8();
            continue;
        };

        let name_start = start + 2;
        let Some(relative_end) = value[name_start..].find('}') else {
            break;
        };
        if relative_end == 0 {
            cursor = name_start + 1;
            continue;
        }
        let end = name_start + relative_end;
        push_literal(&mut segments, &value[literal_start..cursor]);
        if escaped {
            push_literal(&mut segments, &value[start..=end]);
        } else {
            segments.push(Segment::Variable(value[name_start..end].to_owned()));
        }
        cursor = end + 1;
        literal_start = cursor;
    }

    push_literal(&mut segments, &value[literal_start..]);
    EnvValue::Template(segments)
}

fn push_literal(segments: &mut Vec<Segment>, value: &str) {
    if value.is_empty() {
        return;
    }
    if let Some(Segment::Literal(previous)) = segments.last_mut() {
        previous.push_str(value);
    } else {
        segments.push(Segment::Literal(value.to_owned()));
    }
}

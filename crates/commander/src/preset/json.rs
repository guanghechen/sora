use std::collections::BTreeSet;
use std::fmt::{self, Display, Formatter};

const MAX_DEPTH: usize = 128;

#[derive(Clone, Debug, PartialEq)]
pub(super) enum JsonValue {
    Null,
    Bool(bool),
    Number(f64),
    String(String),
    Array(Vec<Self>),
    Object(Vec<(String, Self)>),
}

impl JsonValue {
    pub(super) fn object(&self) -> Option<&[(String, Self)]> {
        match self {
            Self::Object(entries) => Some(entries),
            _ => None,
        }
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct JsonError {
    offset: usize,
    message: String,
}

impl JsonError {
    fn new(offset: usize, message: impl Into<String>) -> Self {
        Self {
            offset,
            message: message.into(),
        }
    }
}

impl Display for JsonError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "invalid JSON at byte {}: {}",
            self.offset, self.message
        )
    }
}

pub(super) fn parse(input: &[u8]) -> Result<JsonValue, JsonError> {
    let source = std::str::from_utf8(input)
        .map_err(|error| JsonError::new(error.valid_up_to(), "input is not valid UTF-8"))?;
    let mut parser = Parser { source, index: 0 };
    parser.skip_whitespace();
    let value = parser.parse_value(0)?;
    parser.skip_whitespace();
    if parser.index != source.len() {
        return Err(parser.error("unexpected trailing content"));
    }
    Ok(value)
}

struct Parser<'a> {
    source: &'a str,
    index: usize,
}

impl Parser<'_> {
    fn parse_value(&mut self, depth: usize) -> Result<JsonValue, JsonError> {
        if depth > MAX_DEPTH {
            return Err(self.error(format!("nesting exceeds maximum depth of {MAX_DEPTH}")));
        }
        self.skip_whitespace();
        match self.peek_byte() {
            Some(b'n') => self.parse_literal("null", JsonValue::Null),
            Some(b't') => self.parse_literal("true", JsonValue::Bool(true)),
            Some(b'f') => self.parse_literal("false", JsonValue::Bool(false)),
            Some(b'"') => self.parse_string().map(JsonValue::String),
            Some(b'[') => self.parse_array(depth),
            Some(b'{') => self.parse_object(depth),
            Some(b'-' | b'0'..=b'9') => self.parse_number().map(JsonValue::Number),
            Some(_) => Err(self.error("expected a JSON value")),
            None => Err(self.error("unexpected end of input")),
        }
    }

    fn parse_literal(&mut self, literal: &str, value: JsonValue) -> Result<JsonValue, JsonError> {
        if self.source[self.index..].starts_with(literal) {
            self.index += literal.len();
            Ok(value)
        } else {
            Err(self.error(format!("expected {literal}")))
        }
    }

    fn parse_array(&mut self, depth: usize) -> Result<JsonValue, JsonError> {
        self.index += 1;
        self.skip_whitespace();
        let mut values = Vec::new();
        if self.consume_byte(b']') {
            return Ok(JsonValue::Array(values));
        }
        loop {
            values.push(self.parse_value(depth + 1)?);
            self.skip_whitespace();
            if self.consume_byte(b']') {
                return Ok(JsonValue::Array(values));
            }
            if !self.consume_byte(b',') {
                return Err(self.error("expected ',' or ']'"));
            }
            self.skip_whitespace();
        }
    }

    fn parse_object(&mut self, depth: usize) -> Result<JsonValue, JsonError> {
        self.index += 1;
        self.skip_whitespace();
        let mut entries = Vec::new();
        let mut keys = BTreeSet::new();
        if self.consume_byte(b'}') {
            return Ok(JsonValue::Object(entries));
        }
        loop {
            if self.peek_byte() != Some(b'"') {
                return Err(self.error("expected a string object key"));
            }
            let key_offset = self.index;
            let key = self.parse_string()?;
            if !keys.insert(key.clone()) {
                return Err(JsonError::new(
                    key_offset,
                    format!("duplicate object key \"{key}\""),
                ));
            }
            self.skip_whitespace();
            if !self.consume_byte(b':') {
                return Err(self.error("expected ':' after object key"));
            }
            let value = self.parse_value(depth + 1)?;
            entries.push((key, value));
            self.skip_whitespace();
            if self.consume_byte(b'}') {
                return Ok(JsonValue::Object(entries));
            }
            if !self.consume_byte(b',') {
                return Err(self.error("expected ',' or '}'"));
            }
            self.skip_whitespace();
        }
    }

    fn parse_string(&mut self) -> Result<String, JsonError> {
        debug_assert_eq!(self.peek_byte(), Some(b'"'));
        self.index += 1;
        let mut output = String::new();
        loop {
            let Some(byte) = self.peek_byte() else {
                return Err(self.error("unterminated string"));
            };
            match byte {
                b'"' => {
                    self.index += 1;
                    return Ok(output);
                }
                b'\\' => {
                    self.index += 1;
                    self.parse_escape(&mut output)?;
                }
                0x00..=0x1f => {
                    return Err(self.error("unescaped control character in string"));
                }
                0x20..=0x7f => {
                    output.push(char::from(byte));
                    self.index += 1;
                }
                _ => {
                    let character = self.source[self.index..]
                        .chars()
                        .next()
                        .ok_or_else(|| self.error("unterminated string"))?;
                    output.push(character);
                    self.index += character.len_utf8();
                }
            }
        }
    }

    fn parse_escape(&mut self, output: &mut String) -> Result<(), JsonError> {
        let Some(escape) = self.peek_byte() else {
            return Err(self.error("unterminated escape sequence"));
        };
        self.index += 1;
        match escape {
            b'"' => output.push('"'),
            b'\\' => output.push('\\'),
            b'/' => output.push('/'),
            b'b' => output.push('\u{0008}'),
            b'f' => output.push('\u{000c}'),
            b'n' => output.push('\n'),
            b'r' => output.push('\r'),
            b't' => output.push('\t'),
            b'u' => {
                let first = self.parse_hex_quad()?;
                let scalar = if (0xd800..=0xdbff).contains(&first) {
                    if !self.source[self.index..].starts_with("\\u") {
                        return Err(
                            self.error("high surrogate must be followed by a low surrogate")
                        );
                    }
                    self.index += 2;
                    let second = self.parse_hex_quad()?;
                    if !(0xdc00..=0xdfff).contains(&second) {
                        return Err(self.error("invalid low surrogate"));
                    }
                    0x10000 + (u32::from(first - 0xd800) << 10) + u32::from(second - 0xdc00)
                } else if (0xdc00..=0xdfff).contains(&first) {
                    return Err(self.error("unexpected low surrogate"));
                } else {
                    u32::from(first)
                };
                output.push(
                    char::from_u32(scalar)
                        .ok_or_else(|| self.error("invalid Unicode escape sequence"))?,
                );
            }
            _ => return Err(self.error("invalid string escape")),
        }
        Ok(())
    }

    fn parse_hex_quad(&mut self) -> Result<u16, JsonError> {
        let start = self.index;
        let end = start.saturating_add(4);
        let Some(value) = self.source.get(start..end) else {
            return Err(self.error("incomplete Unicode escape sequence"));
        };
        if !value.bytes().all(|byte| byte.is_ascii_hexdigit()) {
            return Err(self.error("invalid Unicode escape sequence"));
        }
        self.index = end;
        u16::from_str_radix(value, 16)
            .map_err(|_| JsonError::new(start, "invalid Unicode escape sequence"))
    }

    fn parse_number(&mut self) -> Result<f64, JsonError> {
        let start = self.index;
        self.consume_byte(b'-');
        match self.peek_byte() {
            Some(b'0') => {
                self.index += 1;
                if self.peek_byte().is_some_and(|byte| byte.is_ascii_digit()) {
                    return Err(self.error("leading zero in number"));
                }
            }
            Some(b'1'..=b'9') => self.consume_digits(),
            _ => return Err(self.error("expected digit after sign")),
        }
        if self.consume_byte(b'.') {
            let fraction_start = self.index;
            self.consume_digits();
            if self.index == fraction_start {
                return Err(self.error("expected digit after decimal point"));
            }
        }
        if matches!(self.peek_byte(), Some(b'e' | b'E')) {
            self.index += 1;
            if matches!(self.peek_byte(), Some(b'+' | b'-')) {
                self.index += 1;
            }
            let exponent_start = self.index;
            self.consume_digits();
            if self.index == exponent_start {
                return Err(self.error("expected digit in exponent"));
            }
        }
        let lexeme = &self.source[start..self.index];
        let value = lexeme
            .parse::<f64>()
            .map_err(|_| JsonError::new(start, format!("malformed number \"{lexeme}\"")))?;
        if !value.is_finite() {
            return Err(JsonError::new(
                start,
                format!("number \"{lexeme}\" is out of range"),
            ));
        }
        Ok(value)
    }

    fn consume_digits(&mut self) {
        while self.peek_byte().is_some_and(|byte| byte.is_ascii_digit()) {
            self.index += 1;
        }
    }

    fn skip_whitespace(&mut self) {
        while matches!(self.peek_byte(), Some(b' ' | b'\n' | b'\r' | b'\t')) {
            self.index += 1;
        }
    }

    fn consume_byte(&mut self, expected: u8) -> bool {
        if self.peek_byte() == Some(expected) {
            self.index += 1;
            true
        } else {
            false
        }
    }

    fn peek_byte(&self) -> Option<u8> {
        self.source.as_bytes().get(self.index).copied()
    }

    fn error(&self, message: impl Into<String>) -> JsonError {
        JsonError::new(self.index, message)
    }
}

use std::collections::BTreeMap;

pub(super) fn parse(content: &str) -> Result<BTreeMap<String, String>, String> {
    let normalized = content.replace("\r\n", "\n").replace('\r', "\n");
    let mut envs = BTreeMap::new();
    for (index, line) in normalized.split('\n').enumerate() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let without_export = trimmed.strip_prefix("export ").map_or(trimmed, str::trim);
        let Some(separator) = without_export.find('=') else {
            continue;
        };
        let key = &without_export[..separator];
        if !is_key(key) {
            continue;
        }
        let raw = &without_export[separator + 1..];
        let value = if raw.is_empty() {
            String::new()
        } else if raw.starts_with(['"', '\'']) {
            parse_quoted(raw, line, index + 1, &envs)?
        } else {
            let value = inline_comment(raw).map_or(raw, |comment| &raw[..comment]);
            interpolate(value, &envs)
        };
        envs.insert(key.to_owned(), value);
    }
    Ok(envs)
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

fn is_key(key: &str) -> bool {
    let mut bytes = key.bytes();
    bytes
        .next()
        .is_some_and(|byte| byte.is_ascii_alphabetic() || byte == b'_')
        && bytes.all(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
}

fn parse_quoted(
    raw: &str,
    line: &str,
    line_number: usize,
    envs: &BTreeMap<String, String>,
) -> Result<String, String> {
    let quote = raw.as_bytes()[0];
    let bytes = raw.as_bytes();
    let mut index = 1;
    let mut closing = None;
    while index < bytes.len() {
        if bytes[index] == quote && !is_escaped(bytes, index) {
            closing = Some(index);
            break;
        }
        index += 1;
    }
    let Some(closing) = closing else {
        return Err(format!("Unclosed quote at line {line_number}: {line}"));
    };
    let value = &raw[1..closing];
    if quote == b'\'' {
        return Ok(value.to_owned());
    }
    Ok(interpolate(&unescape(value), envs))
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

fn unescape(value: &str) -> String {
    let mut output = String::new();
    let mut chars = value.chars().peekable();
    while let Some(character) = chars.next() {
        if character != '\\' {
            output.push(character);
            continue;
        }
        match chars.peek().copied() {
            Some('\\') => {
                output.push('\\');
                chars.next();
            }
            Some('n') => {
                output.push('\n');
                chars.next();
            }
            Some('r') => {
                output.push('\r');
                chars.next();
            }
            Some('t') => {
                output.push('\t');
                chars.next();
            }
            Some('"') => {
                output.push('"');
                chars.next();
            }
            _ => output.push('\\'),
        }
    }
    output
}

fn interpolate(value: &str, envs: &BTreeMap<String, String>) -> String {
    let mut output = String::new();
    let bytes = value.as_bytes();
    let mut cursor = 0;
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
            output.push(character);
            cursor += character.len_utf8();
            continue;
        };
        let name_start = start + 2;
        let Some(relative_end) = value[name_start..].find('}') else {
            output.push_str(&value[cursor..]);
            break;
        };
        let end = name_start + relative_end;
        if escaped {
            output.push_str(&value[start..=end]);
        } else if let Some(value) = envs.get(&value[name_start..end]) {
            output.push_str(value);
        }
        cursor = end + 1;
    }
    output
}

#[cfg(test)]
mod tests {
    use super::parse;

    #[test]
    fn quoted_values_distinguish_escaped_quotes_from_escaped_backslashes() {
        let envs = parse("PATH=\"C:\\\\\"\nQUOTE=\"say \\\"hi\\\"\"\n")
            .expect("quoted env values should parse");
        assert_eq!(envs.get("PATH").map(String::as_str), Some("C:\\"));
        assert_eq!(envs.get("QUOTE").map(String::as_str), Some("say \"hi\""));
    }

    #[test]
    fn inline_comments_accept_any_whitespace_run() {
        let envs = parse("A=value\t  # comment\nB=#literal\n").expect("env should parse");
        assert_eq!(envs.get("A").map(String::as_str), Some("value"));
        assert_eq!(envs.get("B").map(String::as_str), Some("#literal"));
    }
}

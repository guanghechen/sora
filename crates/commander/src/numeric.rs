pub(crate) fn parse_integer_literal(raw: &str) -> Option<i64> {
    let normalized = normalize_numeric_literal(raw)?;
    if let Some((negative, radix, digits)) = radix_literal_parts(&normalized) {
        let magnitude = u128::from_str_radix(digits, radix).ok()?;
        if negative {
            let minimum_magnitude = i64::MAX as u128 + 1;
            if magnitude > minimum_magnitude {
                return None;
            }
            return (magnitude == minimum_magnitude)
                .then_some(i64::MIN)
                .or_else(|| i64::try_from(magnitude).ok().map(|value| -value));
        }
        return i64::try_from(magnitude).ok();
    }

    if !normalized.contains(['.', 'e', 'E']) {
        return normalized.parse::<i64>().ok();
    }
    parse_decimal_integer(&normalized)
}

pub(crate) fn parse_number_literal(raw: &str) -> Option<f64> {
    let normalized = normalize_numeric_literal(raw)?;
    let value = if let Some((negative, radix, digits)) = radix_literal_parts(&normalized) {
        let mut value = 0.0;
        for digit in digits.chars() {
            value = value * f64::from(radix) + f64::from(digit.to_digit(radix)?);
            if !value.is_finite() {
                return None;
            }
        }
        if negative { -value } else { value }
    } else {
        normalized.parse::<f64>().ok()?
    };
    value.is_finite().then_some(value)
}

fn normalize_numeric_literal(raw: &str) -> Option<String> {
    if raw.is_empty() || raw.trim() != raw {
        return None;
    }
    let (sign, body) = match raw.as_bytes().first() {
        Some(b'+' | b'-') => (&raw[..1], &raw[1..]),
        _ => ("", raw),
    };
    if body.is_empty() {
        return None;
    }

    let radix = body.get(..2).and_then(|prefix| match prefix {
        "0b" | "0B" => Some(2),
        "0o" | "0O" => Some(8),
        "0x" | "0X" => Some(16),
        _ => None,
    });
    if let Some(radix) = radix {
        let digits = &body[2..];
        validate_digit_run(digits, radix)?;
        return Some(format!("{sign}{}{}", &body[..2], digits.replace('_', "")));
    }

    validate_decimal(body)?;
    Some(format!("{sign}{}", body.replace('_', "")))
}

fn validate_decimal(body: &str) -> Option<()> {
    for (index, byte) in body.bytes().enumerate() {
        if byte == b'_' {
            let previous = body.as_bytes().get(index.wrapping_sub(1)).copied()?;
            let next = body.as_bytes().get(index + 1).copied()?;
            if !previous.is_ascii_digit() || !next.is_ascii_digit() {
                return None;
            }
        }
    }
    let compact = body.replace('_', "");
    let (mantissa, exponent) = compact
        .find(['e', 'E'])
        .map_or((compact.as_str(), None), |index| {
            (&compact[..index], Some(&compact[index + 1..]))
        });
    if mantissa.contains(['e', 'E']) || exponent.is_some_and(|value| value.contains(['e', 'E'])) {
        return None;
    }
    let mut mantissa_parts = mantissa.split('.');
    let integer = mantissa_parts.next().unwrap_or_default();
    let fraction = mantissa_parts.next();
    if mantissa_parts.next().is_some()
        || (!integer.is_empty() && !integer.bytes().all(|byte| byte.is_ascii_digit()))
        || fraction.is_some_and(|value| !value.bytes().all(|byte| byte.is_ascii_digit()))
        || (integer.is_empty() && fraction.is_none_or(str::is_empty))
    {
        return None;
    }
    if let Some(exponent) = exponent {
        let digits = exponent.strip_prefix(['+', '-']).unwrap_or(exponent);
        if digits.is_empty() || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
            return None;
        }
    }
    Some(())
}

fn validate_digit_run(digits: &str, radix: u32) -> Option<()> {
    if digits.is_empty() || digits.starts_with('_') || digits.ends_with('_') {
        return None;
    }
    let mut previous_underscore = false;
    for character in digits.chars() {
        if character == '_' {
            if previous_underscore {
                return None;
            }
            previous_underscore = true;
        } else {
            character.to_digit(radix)?;
            previous_underscore = false;
        }
    }
    Some(())
}

fn radix_literal_parts(normalized: &str) -> Option<(bool, u32, &str)> {
    let (negative, unsigned) = normalized
        .strip_prefix('-')
        .map_or((false, normalized), |value| (true, value));
    let unsigned = unsigned.strip_prefix('+').unwrap_or(unsigned);
    let (radix, digits) = match unsigned.get(..2)? {
        "0b" | "0B" => (2, &unsigned[2..]),
        "0o" | "0O" => (8, &unsigned[2..]),
        "0x" | "0X" => (16, &unsigned[2..]),
        _ => return None,
    };
    Some((negative, radix, digits))
}

fn parse_decimal_integer(normalized: &str) -> Option<i64> {
    let (negative, unsigned) = normalized
        .strip_prefix('-')
        .map_or((false, normalized), |value| (true, value));
    let unsigned = unsigned.strip_prefix('+').unwrap_or(unsigned);
    let (mantissa, exponent) = unsigned.find(['e', 'E']).map_or((unsigned, "0"), |index| {
        (&unsigned[..index], &unsigned[index + 1..])
    });
    let (integer, fraction) = mantissa
        .split_once('.')
        .map_or((mantissa, ""), |(integer, fraction)| (integer, fraction));
    let mut digits = format!("{integer}{fraction}");
    let significant = digits.trim_start_matches('0');
    if significant.is_empty() {
        return Some(0);
    }
    digits = significant.to_owned();

    let exponent = exponent.parse::<i64>().ok()?;
    let scale = i64::try_from(fraction.len()).ok()?;
    let power = exponent.checked_sub(scale)?;
    if power < 0 {
        let remove = usize::try_from(power.unsigned_abs()).ok()?;
        if remove > digits.len()
            || !digits.as_bytes()[digits.len() - remove..]
                .iter()
                .all(|byte| *byte == b'0')
        {
            return None;
        }
        digits.truncate(digits.len() - remove);
    } else {
        let append = usize::try_from(power).ok()?;
        if digits.len().checked_add(append)? > 19 {
            return None;
        }
        digits.extend(std::iter::repeat_n('0', append));
    }
    let magnitude = digits.parse::<u128>().ok()?;
    if negative {
        let minimum_magnitude = i64::MAX as u128 + 1;
        if magnitude > minimum_magnitude {
            return None;
        }
        (magnitude == minimum_magnitude)
            .then_some(i64::MIN)
            .or_else(|| i64::try_from(magnitude).ok().map(|value| -value))
    } else {
        i64::try_from(magnitude).ok()
    }
}

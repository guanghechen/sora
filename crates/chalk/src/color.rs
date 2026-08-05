use std::fmt;

/// The ANSI color capability selected by the caller.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum ColorLevel {
    /// Disable every ANSI style.
    None,
    /// Support the named ANSI 16-color palette.
    Ansi16,
    /// Support the xterm-compatible 256-color palette.
    Ansi256,
    /// Support 24-bit RGB color.
    TrueColor,
}

/// A named color from the ANSI 16-color palette.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum AnsiColor {
    /// Black.
    Black,
    /// Red.
    Red,
    /// Green.
    Green,
    /// Yellow.
    Yellow,
    /// Blue.
    Blue,
    /// Magenta.
    Magenta,
    /// Cyan.
    Cyan,
    /// White.
    White,
    /// Bright black, commonly rendered as gray.
    BrightBlack,
    /// Bright red.
    BrightRed,
    /// Bright green.
    BrightGreen,
    /// Bright yellow.
    BrightYellow,
    /// Bright blue.
    BrightBlue,
    /// Bright magenta.
    BrightMagenta,
    /// Bright cyan.
    BrightCyan,
    /// Bright white.
    BrightWhite,
}

impl AnsiColor {
    pub(crate) const fn foreground_code(self) -> u8 {
        match self {
            Self::Black => 30,
            Self::Red => 31,
            Self::Green => 32,
            Self::Yellow => 33,
            Self::Blue => 34,
            Self::Magenta => 35,
            Self::Cyan => 36,
            Self::White => 37,
            Self::BrightBlack => 90,
            Self::BrightRed => 91,
            Self::BrightGreen => 92,
            Self::BrightYellow => 93,
            Self::BrightBlue => 94,
            Self::BrightMagenta => 95,
            Self::BrightCyan => 96,
            Self::BrightWhite => 97,
        }
    }
}

/// An exact foreground, background, or underline color request.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum Color {
    /// A named ANSI 16-color value.
    Ansi(AnsiColor),
    /// An xterm-compatible 256-color palette index.
    Ansi256(u8),
    /// A 24-bit RGB value.
    Rgb {
        /// Red component.
        red: u8,
        /// Green component.
        green: u8,
        /// Blue component.
        blue: u8,
    },
}

/// An error returned when a hexadecimal color does not match `#RGB` or `#RRGGBB`.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct ParseHexColorError;

impl fmt::Display for ParseHexColorError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str("expected a hexadecimal color in #RGB or #RRGGBB form")
    }
}

impl std::error::Error for ParseHexColorError {}

impl Color {
    /// Construct an indexed ANSI 256-color value.
    #[must_use]
    pub const fn ansi256(index: u8) -> Self {
        Self::Ansi256(index)
    }

    /// Construct a 24-bit RGB value.
    #[must_use]
    pub const fn rgb(red: u8, green: u8, blue: u8) -> Self {
        Self::Rgb { red, green, blue }
    }

    /// Parse an RGB color from strict `#RGB` or `#RRGGBB` input.
    ///
    /// # Errors
    ///
    /// Returns [`ParseHexColorError`] for missing `#`, unsupported lengths including alpha-bearing
    /// forms, or non-hexadecimal digits.
    pub fn from_hex(input: &str) -> Result<Self, ParseHexColorError> {
        let (red, green, blue) = match input.as_bytes() {
            [b'#', red, green, blue] => (
                parse_hex_nibble(*red)? * 17,
                parse_hex_nibble(*green)? * 17,
                parse_hex_nibble(*blue)? * 17,
            ),
            [
                b'#',
                red_high,
                red_low,
                green_high,
                green_low,
                blue_high,
                blue_low,
            ] => (
                parse_hex_byte(*red_high, *red_low)?,
                parse_hex_byte(*green_high, *green_low)?,
                parse_hex_byte(*blue_high, *blue_low)?,
            ),
            _ => return Err(ParseHexColorError),
        };
        Ok(Self::rgb(red, green, blue))
    }

    pub(crate) fn resolve(self, level: ColorLevel) -> Option<ResolvedColor> {
        match (self, level) {
            (_, ColorLevel::None) => None,
            (Self::Ansi(color), _) => Some(ResolvedColor::Ansi(color.foreground_code())),
            (Self::Ansi256(index), ColorLevel::Ansi16) => {
                Some(ResolvedColor::Ansi(ansi256_to_ansi(index)))
            }
            (Self::Ansi256(index), ColorLevel::Ansi256 | ColorLevel::TrueColor) => {
                Some(ResolvedColor::Ansi256(index))
            }
            (Self::Rgb { red, green, blue }, ColorLevel::Ansi16) => Some(ResolvedColor::Ansi(
                ansi256_to_ansi(rgb_to_ansi256(red, green, blue)),
            )),
            (Self::Rgb { red, green, blue }, ColorLevel::Ansi256) => {
                Some(ResolvedColor::Ansi256(rgb_to_ansi256(red, green, blue)))
            }
            (Self::Rgb { red, green, blue }, ColorLevel::TrueColor) => {
                Some(ResolvedColor::Rgb { red, green, blue })
            }
        }
    }
}

fn parse_hex_byte(high: u8, low: u8) -> Result<u8, ParseHexColorError> {
    Ok((parse_hex_nibble(high)? << 4) | parse_hex_nibble(low)?)
}

fn parse_hex_nibble(byte: u8) -> Result<u8, ParseHexColorError> {
    match byte {
        b'0'..=b'9' => Ok(byte - b'0'),
        b'a'..=b'f' => Ok(byte - b'a' + 10),
        b'A'..=b'F' => Ok(byte - b'A' + 10),
        _ => Err(ParseHexColorError),
    }
}

impl From<AnsiColor> for Color {
    fn from(color: AnsiColor) -> Self {
        Self::Ansi(color)
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum ResolvedColor {
    Ansi(u8),
    Ansi256(u8),
    Rgb { red: u8, green: u8, blue: u8 },
}

fn rgb_to_ansi256(red: u8, green: u8, blue: u8) -> u8 {
    if red == green && green == blue {
        if red < 8 {
            return 16;
        }
        if red > 248 {
            return 231;
        }

        let offset = u16::from(red - 8);
        return (232 + ((offset * 24 + 123) / 247)) as u8;
    }

    16 + 36 * quantize_channel(red) + 6 * quantize_channel(green) + quantize_channel(blue)
}

fn quantize_channel(channel: u8) -> u8 {
    ((u16::from(channel) * 5 + 127) / 255) as u8
}

fn ansi256_to_ansi(index: u8) -> u8 {
    if index < 8 {
        return 30 + index;
    }
    if index < 16 {
        return 90 + index - 8;
    }
    if index >= 232 {
        let gray = u16::from(index - 232) * 10 + 8;
        return if gray >= 128 { 37 } else { 30 };
    }

    let cube = index - 16;
    let red = cube / 36;
    let remainder = cube % 36;
    let green = remainder / 6;
    let blue = remainder % 6;
    let mut code = 30 + u8::from(blue >= 3) * 4 + u8::from(green >= 3) * 2 + u8::from(red >= 3);
    if red.max(green).max(blue) == 5 {
        code += 60;
    }
    code
}

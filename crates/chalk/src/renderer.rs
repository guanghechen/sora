use crate::color::ResolvedColor;
use crate::style::AttributeKind;
use crate::{Color, ColorLevel, Style, Visibility};

const RESET: &str = "\x1b[0m";

/// A pure ANSI renderer configured for one explicit color capability.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Renderer {
    level: ColorLevel,
}

impl Renderer {
    /// Construct a renderer for `level`.
    #[must_use]
    pub const fn new(level: ColorLevel) -> Self {
        Self { level }
    }

    /// Return this renderer's color capability.
    #[must_use]
    pub const fn level(self) -> ColorLevel {
        self.level
    }

    /// Apply `style` to `text`.
    #[must_use]
    pub fn paint(self, style: Style, text: &str) -> String {
        if text.is_empty() {
            return String::new();
        }
        if self.level == ColorLevel::None {
            return match style.visibility() {
                Visibility::Always => text.to_owned(),
                Visibility::ColorEnabled => String::new(),
            };
        }
        if !style.has_ansi_attributes() {
            return text.to_owned();
        }

        let pairs = build_pairs(style, self.level);
        if !text
            .as_bytes()
            .iter()
            .any(|byte| matches!(byte, b'\x1b' | b'\n'))
        {
            return paint_flat(&pairs, text);
        }

        let open_all = pairs
            .iter()
            .map(|pair| pair.open.as_str())
            .collect::<String>();
        let close_all = pairs
            .iter()
            .rev()
            .map(|pair| pair.close)
            .collect::<String>();
        let content = reopen_nested_closes(text, &pairs);
        let content = encase_line_endings(content, &close_all, &open_all);

        let mut output = String::with_capacity(open_all.len() + content.len() + close_all.len());
        output.push_str(&open_all);
        output.push_str(&content);
        output.push_str(&close_all);
        output
    }
}

fn paint_flat(pairs: &[SgrPair], text: &str) -> String {
    let capacity = text.len()
        + pairs
            .iter()
            .map(|pair| pair.open.len() + pair.close.len())
            .sum::<usize>();
    let mut output = String::with_capacity(capacity);
    for pair in pairs {
        output.push_str(&pair.open);
    }
    output.push_str(text);
    for pair in pairs.iter().rev() {
        output.push_str(pair.close);
    }
    output
}

struct SgrPair {
    open: String,
    close: &'static str,
}

fn build_pairs(style: Style, level: ColorLevel) -> Vec<SgrPair> {
    let mut pairs = Vec::with_capacity(12);
    let mut index = 0;
    while let Some(attribute) = style.attribute(index) {
        let pair = match attribute {
            AttributeKind::Reset => Some(SgrPair {
                open: RESET.to_owned(),
                close: RESET,
            }),
            AttributeKind::Effect(effect) => {
                let (open, close) = effect.codes();
                Some(SgrPair {
                    open: open.to_owned(),
                    close,
                })
            }
            AttributeKind::Underline => style.underline().map(|underline| {
                let (open, close) = underline.codes();
                SgrPair {
                    open: open.to_owned(),
                    close,
                }
            }),
            AttributeKind::Foreground => style
                .foreground()
                .and_then(|color| color_pair(color, level, ColorTarget::Foreground)),
            AttributeKind::Background => style
                .background()
                .and_then(|color| color_pair(color, level, ColorTarget::Background)),
            AttributeKind::UnderlineColor => style
                .underline_color()
                .and_then(|color| color_pair(color, level, ColorTarget::Underline)),
        };
        if let Some(pair) = pair {
            pairs.push(pair);
        }
        index += 1;
    }
    pairs
}

#[derive(Clone, Copy)]
enum ColorTarget {
    Foreground,
    Background,
    Underline,
}

fn color_pair(color: Color, level: ColorLevel, target: ColorTarget) -> Option<SgrPair> {
    let resolved = color.resolve(level)?;
    let open = match resolved {
        ResolvedColor::Ansi(code) => match target {
            ColorTarget::Foreground => format!("\x1b[{code}m"),
            ColorTarget::Background => format!("\x1b[{}m", code + 10),
            ColorTarget::Underline => {
                format!("\x1b[58;5;{}m", ansi_code_to_palette_index(code))
            }
        },
        ResolvedColor::Ansi256(index) => {
            format!("\x1b[{};5;{index}m", target.open_parameter())
        }
        ResolvedColor::Rgb { red, green, blue } => {
            format!("\x1b[{};2;{red};{green};{blue}m", target.open_parameter())
        }
    };
    Some(SgrPair {
        open,
        close: target.close_code(),
    })
}

impl ColorTarget {
    const fn open_parameter(self) -> u8 {
        match self {
            Self::Foreground => 38,
            Self::Background => 48,
            Self::Underline => 58,
        }
    }

    const fn close_code(self) -> &'static str {
        match self {
            Self::Foreground => "\x1b[39m",
            Self::Background => "\x1b[49m",
            Self::Underline => "\x1b[59m",
        }
    }
}

fn ansi_code_to_palette_index(code: u8) -> u8 {
    if code < 90 { code - 30 } else { code - 90 + 8 }
}

struct ReopenGroup {
    close: &'static str,
    open: String,
}

fn reopen_nested_closes(text: &str, pairs: &[SgrPair]) -> String {
    let mut groups: Vec<ReopenGroup> = Vec::new();
    let active_start = pairs
        .iter()
        .position(|pair| pair.open == RESET && pair.close == RESET)
        .unwrap_or(0);

    for pair in &pairs[active_start..] {
        if let Some(group) = groups.iter_mut().find(|group| group.close == pair.close) {
            group.open.push_str(&pair.open);
        } else {
            groups.push(ReopenGroup {
                close: pair.close,
                open: pair.open.clone(),
            });
        }
    }

    let mut content = text.to_owned();
    for group in groups {
        content = replace_with_postfix(content, group.close, &group.open);
    }
    content
}

fn replace_with_postfix(input: String, needle: &str, postfix: &str) -> String {
    let Some(mut index) = input.find(needle) else {
        return input;
    };

    let mut output = String::with_capacity(input.len() + postfix.len());
    let mut start = 0;
    loop {
        let end = index + needle.len();
        output.push_str(&input[start..end]);
        output.push_str(postfix);
        start = end;

        let Some(next) = input[start..].find(needle) else {
            break;
        };
        index = start + next;
    }
    output.push_str(&input[start..]);
    output
}

fn encase_line_endings(input: String, close_all: &str, open_all: &str) -> String {
    let Some(mut line_feed) = input.find('\n') else {
        return input;
    };

    let mut output = String::with_capacity(input.len() + close_all.len() + open_all.len());
    let mut start = 0;
    loop {
        let carriage_return = line_feed > start && input.as_bytes()[line_feed - 1] == b'\r';
        let content_end = if carriage_return {
            line_feed - 1
        } else {
            line_feed
        };
        output.push_str(&input[start..content_end]);
        output.push_str(close_all);
        if carriage_return {
            output.push_str("\r\n");
        } else {
            output.push('\n');
        }
        output.push_str(open_all);
        start = line_feed + 1;

        let Some(next) = input[start..].find('\n') else {
            break;
        };
        line_feed = start + next;
    }
    output.push_str(&input[start..]);
    output
}

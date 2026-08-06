use guanghechen_chalk::{AnsiColor, Color, ColorLevel, Effect, Renderer, Style, UnderlineStyle};

use crate::Value;
use crate::command::{
    ArgumentCardinality, Command, OptionArity, OptionSpec, ValueType, effective_options_owned,
};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HelpLine {
    label: String,
    description: String,
}

impl HelpLine {
    fn new(label: impl Into<String>, description: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            description: description.into(),
        }
    }

    #[must_use]
    pub fn label(&self) -> &str {
        &self.label
    }

    #[must_use]
    pub fn description(&self) -> &str {
        &self.description
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HelpExample {
    title: String,
    usage: String,
    description: String,
}

impl HelpExample {
    #[must_use]
    pub fn title(&self) -> &str {
        &self.title
    }

    #[must_use]
    pub fn usage(&self) -> &str {
        &self.usage
    }

    #[must_use]
    pub fn description(&self) -> &str {
        &self.description
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct HelpData {
    description: String,
    usage: String,
    arguments: Vec<HelpLine>,
    options: Vec<HelpLine>,
    preset_directives: Vec<HelpLine>,
    commands: Vec<HelpLine>,
    examples: Vec<HelpExample>,
}

impl HelpData {
    #[must_use]
    pub fn description(&self) -> &str {
        &self.description
    }

    #[must_use]
    pub fn usage(&self) -> &str {
        &self.usage
    }

    #[must_use]
    pub fn arguments(&self) -> &[HelpLine] {
        &self.arguments
    }

    #[must_use]
    pub fn options(&self) -> &[HelpLine] {
        &self.options
    }

    #[must_use]
    pub fn preset_directives(&self) -> &[HelpLine] {
        &self.preset_directives
    }

    #[must_use]
    pub fn commands(&self) -> &[HelpLine] {
        &self.commands
    }

    #[must_use]
    pub fn examples(&self) -> &[HelpExample] {
        &self.examples
    }
}

pub(crate) fn build_help_data(chain: &[&Command]) -> HelpData {
    let command = chain
        .last()
        .copied()
        .expect("command chain always contains the root");
    let path = command_path(chain);
    let arguments = command
        .arguments
        .iter()
        .map(|argument| {
            let mut description = argument.description.clone();
            if let Some(default) = &argument.default {
                description.push_str(&format!(" [default: {}]", format_value(default)));
            }
            if !argument.choices.is_empty() {
                description.push_str(&format!(
                    " [choices: {}]",
                    argument
                        .choices
                        .iter()
                        .map(|choice| format_value(&Value::String(choice.clone())))
                        .collect::<Vec<_>>()
                        .join(", ")
                ));
            }
            HelpLine::new(
                argument_signature(argument.name(), argument.cardinality()),
                description,
            )
        })
        .collect::<Vec<_>>();

    let mut options = effective_options_owned(chain);
    options.sort_by(|left, right| {
        option_rank(left)
            .cmp(&option_rank(right))
            .then_with(|| left.cli_long().cmp(&right.cli_long()))
    });
    let mut option_lines = vec![HelpLine::new("-h, --help", "Show help information")];
    if command.builtins.version && command.version.is_some() {
        option_lines.push(HelpLine::new("-V, --version", "Show version number"));
    }
    option_lines.extend(options.iter().map(|option| {
        let mut description = option.description().to_owned();
        if option.is_required() {
            description.push_str(" [required]");
        }
        if let Some(default) = &option.default
            && option.value_type() != ValueType::Boolean
        {
            description.push_str(&format!(" [default: {}]", format_value(default)));
        }
        if !option.choices.is_empty() {
            description.push_str(&format!(
                " [choices: {}]",
                option
                    .choices
                    .iter()
                    .map(|choice| format_value(&Value::String(choice.clone())))
                    .collect::<Vec<_>>()
                    .join(", ")
            ));
        }
        HelpLine::new(option_signature(option), description)
    }));

    let mut commands = Vec::new();
    if !command.subcommands.is_empty() {
        commands.push(HelpLine::new("help", "Show help for a command"));
        let mut subcommands = command.subcommands.iter().collect::<Vec<_>>();
        subcommands.sort_by(|left, right| left.name.cmp(&right.name));
        commands.extend(subcommands.into_iter().map(|subcommand| {
            let mut names = subcommand.name.clone();
            if !subcommand.aliases.is_empty() {
                names.push_str(", ");
                names.push_str(&subcommand.aliases.join(", "));
            }
            HelpLine::new(names, subcommand.description.clone())
        }));
    }

    let examples = command
        .examples
        .iter()
        .map(|example| HelpExample {
            title: example.title().to_owned(),
            usage: if example.usage().is_empty() {
                path.clone()
            } else {
                format!("{path} {}", example.usage())
            },
            description: example.description().to_owned(),
        })
        .collect();

    HelpData {
        description: command.description.clone(),
        usage: render_usage(chain),
        arguments,
        options: option_lines,
        preset_directives: vec![
            HelpLine::new("--preset-file <value>", "Load preset manifest file"),
            HelpLine::new(
                "--preset-profile <value>",
                "Select preset profile: <profile> or <profile>:<variant>",
            ),
        ],
        commands,
        examples,
    }
}

pub(crate) fn render_help(chain: &[&Command], color_level: ColorLevel) -> String {
    render_help_data(&build_help_data(chain), color_level)
}

pub(crate) fn render_help_data(data: &HelpData, color_level: ColorLevel) -> String {
    let labels = data
        .arguments
        .iter()
        .chain(&data.options)
        .chain(&data.preset_directives)
        .chain(&data.commands)
        .map(|line| display_width(&line.label));
    let label_width = labels.max().unwrap_or_default();
    let renderer = Renderer::new(color_level);
    let heading_style = Style::new()
        .with_effect(Effect::Bold)
        .with_underline(UnderlineStyle::Single);
    let usage_style = Style::new().with_effect(Effect::Bold);
    let label_style = Style::new().with_foreground(Color::Ansi(AnsiColor::Cyan));
    let example_title_style = Style::new().with_effect(Effect::Bold);
    let example_description_style = Style::new()
        .with_effect(Effect::Italic)
        .with_effect(Effect::Dim);

    let mut lines = vec![data.description.clone(), String::new()];
    lines.push(renderer.paint(usage_style, &data.usage));
    lines.push(String::new());
    render_section(
        &mut lines,
        "Arguments:",
        &data.arguments,
        label_width,
        renderer,
        heading_style,
        label_style,
    );
    render_section(
        &mut lines,
        "Options:",
        &data.options,
        label_width,
        renderer,
        heading_style,
        label_style,
    );
    render_section(
        &mut lines,
        "Preset Directives:",
        &data.preset_directives,
        label_width,
        renderer,
        heading_style,
        label_style,
    );
    render_section(
        &mut lines,
        "Commands:",
        &data.commands,
        label_width,
        renderer,
        heading_style,
        label_style,
    );
    if !data.examples.is_empty() {
        lines.push(renderer.paint(heading_style, "Examples:"));
        for example in &data.examples {
            lines.push(format!(
                "  - {}",
                renderer.paint(example_title_style, &example.title)
            ));
            lines.push(format!(
                "    {}",
                renderer.paint(label_style, &example.usage)
            ));
            lines.push(format!(
                "    {}",
                renderer.paint(example_description_style, &example.description)
            ));
            lines.push(String::new());
        }
    }

    while lines.len() > 1 && lines.last().is_some_and(String::is_empty) {
        lines.pop();
    }
    lines.push(String::new());
    lines.join("\n")
}

pub(crate) fn render_version(chain: &[&Command]) -> Option<String> {
    let command = chain.last().copied()?;
    if !command.builtins.version {
        return None;
    }
    command
        .version
        .as_ref()
        .map(|version| format!("{} {version}\n", command_path(chain)))
}

pub(crate) fn command_path(chain: &[&Command]) -> String {
    chain
        .iter()
        .map(|command| command.name.as_str())
        .collect::<Vec<_>>()
        .join(" ")
}

fn render_section(
    lines: &mut Vec<String>,
    title: &str,
    entries: &[HelpLine],
    label_width: usize,
    renderer: Renderer,
    heading_style: Style,
    label_style: Style,
) {
    if entries.is_empty() {
        return;
    }
    lines.push(renderer.paint(heading_style, title));
    for entry in entries {
        let padded = pad_display_end(&entry.label, label_width);
        lines.push(format!(
            "  {}  {}",
            renderer.paint(label_style, &padded),
            entry.description
        ));
    }
    lines.push(String::new());
}

fn render_usage(chain: &[&Command]) -> String {
    let command = chain
        .last()
        .copied()
        .expect("command chain always contains the root");
    let mut usage = format!("Usage: {} [options]", command_path(chain));
    if !command.subcommands.is_empty() {
        usage.push_str(" [command]");
    }
    for argument in &command.arguments {
        usage.push(' ');
        usage.push_str(&argument_signature(argument.name(), argument.cardinality()));
    }
    usage
}

fn argument_signature(name: &str, cardinality: ArgumentCardinality) -> String {
    match cardinality {
        ArgumentCardinality::Required => format!("<{name}>"),
        ArgumentCardinality::Optional => format!("[{name}]"),
        ArgumentCardinality::Variadic => format!("[{name}...]"),
        ArgumentCardinality::OneOrMore => format!("<{name}...>"),
    }
}

fn option_rank(option: &OptionSpec) -> u8 {
    if option.required { 0 } else { 1 }
}

fn option_signature(option: &OptionSpec) -> String {
    let mut signature = String::new();
    if let Some(short) = option.short_name() {
        signature.push('-');
        signature.push(short);
        signature.push_str(", ");
    }
    signature.push_str("--");
    signature.push_str(&option.cli_long());

    match (option.value_type(), option.arity()) {
        (ValueType::Boolean, OptionArity::None) => {
            signature.push_str(", --no-");
            signature.push_str(&option.cli_long());
        }
        (_, OptionArity::Required) => signature.push_str(" <value>"),
        (_, OptionArity::Optional) => signature.push_str(" [value]"),
        (_, OptionArity::Variadic) => signature.push_str(" <values...>"),
        (_, OptionArity::None) => {}
    }
    signature
}

fn format_value(value: &Value) -> String {
    match value {
        Value::None => "null".to_owned(),
        Value::Bool(value) => value.to_string(),
        Value::String(value) => format!("{value:?}"),
        Value::Integer(value) => value.to_string(),
        Value::Number(value) => value.to_string(),
        Value::Bools(values) => format_list(values.iter().map(bool::to_string)),
        Value::Strings(values) => format_list(values.iter().map(|value| format!("{value:?}"))),
        Value::Integers(values) => format_list(values.iter().map(ToString::to_string)),
        Value::Numbers(values) => format_list(values.iter().map(ToString::to_string)),
    }
}

fn format_list(values: impl IntoIterator<Item = String>) -> String {
    format!("[{}]", values.into_iter().collect::<Vec<_>>().join(", "))
}

fn display_width(value: &str) -> usize {
    value
        .chars()
        .map(|character| {
            let code = u32::from(character);
            if is_combining(code) {
                0
            } else if is_wide(code) {
                2
            } else {
                1
            }
        })
        .sum()
}

fn pad_display_end(value: &str, target_width: usize) -> String {
    let width = display_width(value);
    format!("{value}{}", " ".repeat(target_width.saturating_sub(width)))
}

fn is_combining(code: u32) -> bool {
    matches!(
        code,
        0x0300..=0x036f
            | 0x1ab0..=0x1aff
            | 0x1dc0..=0x1dff
            | 0x20d0..=0x20ff
            | 0xfe20..=0xfe2f
    )
}

fn is_wide(code: u32) -> bool {
    code >= 0x1100
        && (code <= 0x115f
            || matches!(code, 0x2329 | 0x232a)
            || (0x2e80..=0x3247).contains(&code) && code != 0x303f
            || (0x3250..=0x4dbf).contains(&code)
            || (0x4e00..=0xa4c6).contains(&code)
            || (0xa960..=0xa97c).contains(&code)
            || (0xac00..=0xd7a3).contains(&code)
            || (0xf900..=0xfaff).contains(&code)
            || (0xfe10..=0xfe19).contains(&code)
            || (0xfe30..=0xfe6b).contains(&code)
            || (0xff01..=0xff60).contains(&code)
            || (0xffe0..=0xffe6).contains(&code)
            || (0x1b000..=0x1b001).contains(&code)
            || (0x1f200..=0x1f251).contains(&code)
            || (0x20000..=0x3fffd).contains(&code))
}

#[cfg(test)]
mod tests {
    use super::{display_width, pad_display_end};

    #[test]
    fn display_width_accounts_for_wide_and_combining_characters() {
        assert_eq!(display_width("模式"), 4);
        assert_eq!(display_width("e\u{0301}"), 1);
        assert_eq!(pad_display_end("模式", 6), "模式  ");
        assert_eq!(pad_display_end("e\u{0301}", 3), "e\u{0301}  ");
    }
}

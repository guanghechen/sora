use std::collections::{BTreeMap, BTreeSet};
use std::fmt::{self, Debug, Formatter};

use guanghechen_chalk::ColorLevel;

use crate::redaction::RedactedEnvironment;
use crate::{InputSourceKind, PresetSource};

#[derive(Clone, Debug, PartialEq)]
pub enum Value {
    None,
    Bool(bool),
    Bools(Vec<bool>),
    String(String),
    Strings(Vec<String>),
    Integer(i64),
    Integers(Vec<i64>),
    Number(f64),
    Numbers(Vec<f64>),
}

#[derive(Clone, PartialEq)]
pub struct Matches {
    command_path: Vec<String>,
    local_options: BTreeMap<String, Value>,
    effective_options: BTreeMap<String, Value>,
    present_options: BTreeSet<String>,
    builtins: BuiltinMatches,
    option_sources: BTreeMap<String, BTreeSet<InputSourceKind>>,
    arguments: BTreeMap<String, Value>,
    raw_arguments: Vec<String>,
    had_separator: bool,
    effective_environment: BTreeMap<String, String>,
    controls: Controls,
    sources: Box<InputSources>,
}

impl Debug for Matches {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("Matches")
            .field("command_path", &self.command_path)
            .field("local_options", &self.local_options)
            .field("effective_options", &self.effective_options)
            .field("present_options", &self.present_options)
            .field("builtins", &self.builtins)
            .field("option_sources", &self.option_sources)
            .field("arguments", &self.arguments)
            .field("raw_arguments", &self.raw_arguments)
            .field("had_separator", &self.had_separator)
            .field(
                "effective_environment",
                &RedactedEnvironment::new(&self.effective_environment),
            )
            .field("controls", &self.controls)
            .field("sources", &self.sources)
            .finish()
    }
}

pub(crate) struct MatchesData {
    pub(crate) command_path: Vec<String>,
    pub(crate) local_options: BTreeMap<String, Value>,
    pub(crate) effective_options: BTreeMap<String, Value>,
    pub(crate) present_options: BTreeSet<String>,
    pub(crate) builtins: BuiltinMatches,
    pub(crate) option_sources: BTreeMap<String, BTreeSet<InputSourceKind>>,
    pub(crate) arguments: BTreeMap<String, Value>,
    pub(crate) raw_arguments: Vec<String>,
    pub(crate) had_separator: bool,
    pub(crate) effective_environment: BTreeMap<String, String>,
    pub(crate) sources: InputSources,
}

#[derive(Clone, Debug, PartialEq)]
pub struct BuiltinMatches {
    values: BTreeMap<String, Value>,
    present: BTreeSet<String>,
    color_level: ColorLevel,
}

impl Default for BuiltinMatches {
    fn default() -> Self {
        Self {
            values: BTreeMap::new(),
            present: BTreeSet::new(),
            color_level: ColorLevel::None,
        }
    }
}

impl BuiltinMatches {
    pub(crate) fn new(
        values: BTreeMap<String, Value>,
        present: BTreeSet<String>,
        color_level: ColorLevel,
    ) -> Self {
        Self {
            values,
            present,
            color_level,
        }
    }

    #[must_use]
    pub fn option(&self, key: &str) -> Option<&Value> {
        self.values.get(key)
    }

    #[must_use]
    pub fn contains(&self, key: &str) -> bool {
        self.present.contains(key)
    }

    #[must_use]
    pub fn options(&self) -> &BTreeMap<String, Value> {
        &self.values
    }

    #[must_use]
    pub const fn color_level(&self) -> ColorLevel {
        self.color_level
    }
}

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub struct Controls {
    help: bool,
    version: bool,
}

impl Controls {
    pub(crate) const fn new(help: bool, version: bool) -> Self {
        Self { help, version }
    }

    #[must_use]
    pub const fn help(self) -> bool {
        self.help
    }

    #[must_use]
    pub const fn version(self) -> bool {
        self.version
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum PresetSourceState {
    Skipped,
    None,
    Applied,
}

#[derive(Clone, Eq, PartialEq)]
pub struct UserInputSource {
    canonical_command_path: Vec<String>,
    command_path: Vec<String>,
    argv: Vec<String>,
    environment: BTreeMap<String, String>,
}

impl Debug for UserInputSource {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("UserInputSource")
            .field("canonical_command_path", &self.canonical_command_path)
            .field("command_path", &self.command_path)
            .field("argv", &self.argv)
            .field("environment", &RedactedEnvironment::new(&self.environment))
            .finish()
    }
}

impl UserInputSource {
    pub(crate) fn new(
        canonical_command_path: Vec<String>,
        command_path: Vec<String>,
        argv: Vec<String>,
        environment: BTreeMap<String, String>,
    ) -> Self {
        Self {
            canonical_command_path,
            command_path,
            argv,
            environment,
        }
    }

    #[must_use]
    pub fn canonical_command_path(&self) -> &[String] {
        &self.canonical_command_path
    }

    #[must_use]
    pub fn command_path(&self) -> &[String] {
        &self.command_path
    }

    #[must_use]
    pub fn argv(&self) -> &[String] {
        &self.argv
    }

    #[must_use]
    pub fn environment(&self) -> &BTreeMap<String, String> {
        &self.environment
    }
}

#[derive(Clone, Eq, PartialEq)]
pub struct PresetInputSource {
    state: PresetSourceState,
    argv: Vec<String>,
    environment: BTreeMap<String, String>,
    metadata: Option<PresetSource>,
}

impl Debug for PresetInputSource {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> fmt::Result {
        formatter
            .debug_struct("PresetInputSource")
            .field("state", &self.state)
            .field("argv", &self.argv)
            .field("environment", &RedactedEnvironment::new(&self.environment))
            .field("metadata", &self.metadata)
            .finish()
    }
}

impl PresetInputSource {
    pub(crate) fn new(
        state: PresetSourceState,
        argv: Vec<String>,
        environment: BTreeMap<String, String>,
        metadata: Option<PresetSource>,
    ) -> Self {
        Self {
            state,
            argv,
            environment,
            metadata,
        }
    }

    #[must_use]
    pub const fn state(&self) -> PresetSourceState {
        self.state
    }

    #[must_use]
    pub fn argv(&self) -> &[String] {
        &self.argv
    }

    #[must_use]
    pub fn environment(&self) -> &BTreeMap<String, String> {
        &self.environment
    }

    #[must_use]
    pub fn metadata(&self) -> Option<&PresetSource> {
        self.metadata.as_ref()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct InputSources {
    user: UserInputSource,
    preset: PresetInputSource,
}

impl InputSources {
    pub(crate) fn new(user: UserInputSource, preset: PresetInputSource) -> Self {
        Self { user, preset }
    }

    #[must_use]
    pub fn user(&self) -> &UserInputSource {
        &self.user
    }

    #[must_use]
    pub fn preset(&self) -> &PresetInputSource {
        &self.preset
    }

    pub(crate) fn with_user_argv(mut self, argv: Vec<String>) -> Self {
        self.user.argv = argv;
        self
    }
}

impl Matches {
    pub(crate) fn new(data: MatchesData) -> Self {
        Self {
            command_path: data.command_path,
            local_options: data.local_options,
            effective_options: data.effective_options,
            present_options: data.present_options,
            builtins: data.builtins,
            option_sources: data.option_sources,
            arguments: data.arguments,
            raw_arguments: data.raw_arguments,
            had_separator: data.had_separator,
            effective_environment: data.effective_environment,
            controls: Controls::default(),
            sources: Box::new(data.sources),
        }
    }

    #[must_use]
    pub fn command_path(&self) -> &[String] {
        &self.command_path
    }

    #[must_use]
    pub fn contains_option(&self, key: &str) -> bool {
        self.local_options.contains_key(key) && self.present_options.contains(key)
    }

    #[must_use]
    pub fn option(&self, key: &str) -> Option<&Value> {
        self.local_options.get(key)
    }

    #[must_use]
    pub fn options(&self) -> &BTreeMap<String, Value> {
        &self.local_options
    }

    #[must_use]
    pub fn contains_effective_option(&self, key: &str) -> bool {
        self.effective_options.contains_key(key) && self.present_options.contains(key)
    }

    #[must_use]
    pub fn effective_option(&self, key: &str) -> Option<&Value> {
        self.effective_options.get(key)
    }

    #[must_use]
    pub fn effective_options(&self) -> &BTreeMap<String, Value> {
        &self.effective_options
    }

    #[must_use]
    pub fn builtins(&self) -> &BuiltinMatches {
        &self.builtins
    }

    pub(crate) fn option_sources(&self, key: &str) -> Option<&BTreeSet<InputSourceKind>> {
        self.option_sources.get(key)
    }

    #[must_use]
    pub fn argument(&self, key: &str) -> Option<&Value> {
        self.arguments.get(key)
    }

    #[must_use]
    pub fn raw_arguments(&self) -> &[String] {
        &self.raw_arguments
    }

    #[must_use]
    pub fn had_separator(&self) -> bool {
        self.had_separator
    }

    #[must_use]
    pub fn effective_environment(&self) -> &BTreeMap<String, String> {
        &self.effective_environment
    }

    #[must_use]
    pub const fn controls(&self) -> Controls {
        self.controls
    }

    #[must_use]
    pub fn sources(&self) -> &InputSources {
        &self.sources
    }

    #[must_use]
    pub fn preset_env(&self, key: &str) -> Option<&str> {
        self.sources.preset.environment.get(key).map(String::as_str)
    }

    #[must_use]
    pub fn preset_envs(&self) -> &BTreeMap<String, String> {
        &self.sources.preset.environment
    }

    #[must_use]
    pub fn preset(&self) -> Option<&PresetSource> {
        self.sources.preset.metadata.as_ref()
    }
}

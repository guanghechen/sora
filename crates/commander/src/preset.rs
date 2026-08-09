mod json;
mod path;

use std::collections::BTreeMap;
use std::fs::File;
use std::io::Read;
use std::path::{Path, PathBuf};

use guanghechen_env::{EnvLimits, parse_with_limits as parse_env_with_limits};

use self::path::normalize_path;
use crate::Command;
use crate::error::{ParseError, ParseErrorKind};

pub const PRESET_FILE_FLAG: &str = "--preset-file";
pub const PRESET_PROFILE_FLAG: &str = "--preset-profile";
const MAX_PRESET_BYTES: u64 = 1024 * 1024;
const PRESET_ENV_LIMITS: EnvLimits = EnvLimits::new(MAX_PRESET_BYTES as usize);

#[derive(Clone, Debug, Eq, PartialEq)]
struct PresetFileConfig {
    path: PathBuf,
    optional: bool,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct PresetConfig {
    file: Option<PresetFileConfig>,
    profile: Option<String>,
}

impl PresetConfig {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn file(mut self, path: impl Into<PathBuf>) -> Self {
        self.file = Some(PresetFileConfig {
            path: path.into(),
            optional: false,
        });
        self
    }

    #[must_use]
    pub fn optional_file(mut self, path: impl Into<PathBuf>) -> Self {
        self.file = Some(PresetFileConfig {
            path: path.into(),
            optional: true,
        });
        self
    }

    #[must_use]
    pub fn profile(mut self, profile: impl Into<String>) -> Self {
        self.profile = Some(profile.into());
        self
    }

    #[must_use]
    pub fn file_path(&self) -> Option<&Path> {
        self.file.as_ref().map(|file| file.path.as_path())
    }

    #[must_use]
    pub fn profile_name(&self) -> Option<&str> {
        self.profile.as_deref()
    }
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct PresetSource {
    file: PathBuf,
    display_file: PathBuf,
    profile: String,
    variant: Option<String>,
    resolved_env_file: Option<PathBuf>,
}

impl PresetSource {
    #[must_use]
    pub fn file(&self) -> &Path {
        &self.file
    }

    #[must_use]
    pub fn display_file(&self) -> &Path {
        &self.display_file
    }

    #[must_use]
    pub fn profile(&self) -> &str {
        &self.profile
    }

    #[must_use]
    pub fn variant(&self) -> Option<&str> {
        self.variant.as_deref()
    }

    #[must_use]
    pub fn resolved_env_file(&self) -> Option<&Path> {
        self.resolved_env_file.as_deref()
    }

    pub(crate) fn option_source_label(&self) -> String {
        let selector = self.variant.as_ref().map_or_else(
            || self.profile.clone(),
            |variant| format!("{}:{variant}", self.profile),
        );
        format!("{}#{selector}.opts", self.display_file.display())
    }
}

pub(crate) struct ResolvedPreset {
    pub(crate) argv: Vec<String>,
    pub(crate) envs: BTreeMap<String, String>,
    pub(crate) source: PresetSource,
}

struct ResolvedEnvFile {
    path: PathBuf,
    envs: BTreeMap<String, String>,
}

pub(crate) struct PresetDirectiveScan {
    pub(crate) clean_args: Vec<String>,
    file: Option<Result<PathBuf, String>>,
    profile: Option<Result<String, String>>,
}

pub(crate) fn scan_directives(args: Vec<String>) -> PresetDirectiveScan {
    let mut clean_args = Vec::new();
    let mut file = None;
    let mut profile = None;
    let mut index = 0;
    while index < args.len() {
        let token = &args[index];
        if token == "--" {
            clean_args.extend(args[index..].iter().cloned());
            break;
        }
        if token == PRESET_FILE_FLAG || token == PRESET_PROFILE_FLAG {
            let Some(value) = args.get(index + 1) else {
                assign_directive_error(token, &mut file, &mut profile);
                index += 1;
                continue;
            };
            if value.is_empty() {
                assign_directive_error(token, &mut file, &mut profile);
                index += 2;
                continue;
            }
            if value == "--" || is_control(value) || is_directive_token(value) {
                assign_directive_error(token, &mut file, &mut profile);
                index += 1;
                continue;
            }
            assign_directive_value(token, value.clone(), &mut file, &mut profile);
            index += 2;
            continue;
        }
        if let Some(value) = token.strip_prefix("--preset-file=") {
            if value.is_empty() {
                file = Some(Err(missing_directive_value(PRESET_FILE_FLAG)));
            } else {
                file = Some(Ok(PathBuf::from(value)));
            }
            index += 1;
            continue;
        }
        if let Some(value) = token.strip_prefix("--preset-profile=") {
            if value.is_empty() {
                profile = Some(Err(missing_directive_value(PRESET_PROFILE_FLAG)));
            } else {
                profile = Some(Ok(value.to_owned()));
            }
            index += 1;
            continue;
        }
        clean_args.push(token.clone());
        index += 1;
    }
    PresetDirectiveScan {
        clean_args,
        file,
        profile,
    }
}

fn assign_directive_value(
    flag: &str,
    value: String,
    file: &mut Option<Result<PathBuf, String>>,
    profile: &mut Option<Result<String, String>>,
) {
    if flag == PRESET_FILE_FLAG {
        *file = Some(Ok(PathBuf::from(value)));
    } else {
        *profile = Some(Ok(value));
    }
}

fn assign_directive_error(
    flag: &str,
    file: &mut Option<Result<PathBuf, String>>,
    profile: &mut Option<Result<String, String>>,
) {
    if flag == PRESET_FILE_FLAG {
        *file = Some(Err(missing_directive_value(flag)));
    } else {
        *profile = Some(Err(missing_directive_value(flag)));
    }
}

fn missing_directive_value(flag: &str) -> String {
    format!("missing value for \"{flag}\"")
}

impl PresetDirectiveScan {
    pub(crate) fn validate(&self, command_path: &str) -> Result<(), ParseError> {
        if let Some(Err(issue)) = &self.file {
            return Err(configuration_error(command_path, issue));
        }
        if let Some(Err(issue)) = &self.profile {
            return Err(configuration_error(command_path, issue));
        }
        if let Some(Ok(profile)) = &self.profile {
            parse_selector(profile, PRESET_PROFILE_FLAG, command_path)?;
        }
        Ok(())
    }

    fn profile(&self) -> Option<&str> {
        self.profile.as_ref()?.as_ref().ok().map(String::as_str)
    }

    fn file(&self) -> Option<&PathBuf> {
        self.file.as_ref()?.as_ref().ok()
    }
}

pub(crate) fn resolve(
    chain: &[&Command],
    directives: &PresetDirectiveScan,
    command_path: &str,
    base_directory: Option<&Path>,
) -> Result<Option<ResolvedPreset>, ParseError> {
    let mut configured_files = Vec::new();
    let mut configured_profile = None;
    for command in chain.iter().rev() {
        let Some(config) = command.preset.as_ref() else {
            continue;
        };
        if let Some(file) = &config.file {
            configured_files.push(file.clone());
        }
        if configured_profile.is_none() {
            configured_profile = config.profile.clone();
        }
    }

    let selected_files = directives.file().map_or(configured_files, |path| {
        vec![PresetFileConfig {
            path: path.clone(),
            optional: false,
        }]
    });
    let selected_profile = directives
        .profile()
        .map(ToOwned::to_owned)
        .or(configured_profile);

    if selected_files.is_empty() {
        if selected_profile.is_some() {
            let source = if directives.profile().is_some() {
                PRESET_PROFILE_FLAG
            } else {
                "command.preset.profile"
            };
            let error = configuration_error(
                command_path,
                format!(
                    "cannot use \"{source}\" without \"{PRESET_FILE_FLAG}\" or command.preset.file"
                ),
            );
            return Err(if directives.profile().is_some() {
                error.with_input_source(crate::InputSourceKind::User)
            } else {
                error
            });
        }
        return Ok(None);
    }

    let mut selected_file = None;
    for file in selected_files {
        let absolute_file = resolve_path(&file.path, base_directory, command_path)
            .map_err(|error| error.with_preset_file(&file.path))?;
        if let Some(content) = read_file(
            &absolute_file,
            &file.path,
            file.optional,
            "preset file",
            command_path,
        )? {
            selected_file = Some((file, absolute_file, content));
            break;
        }
    }
    let Some((file, absolute_file, content)) = selected_file else {
        if directives.profile().is_some() {
            return Err(configuration_error(
                command_path,
                format!(
                    "cannot use \"{PRESET_PROFILE_FLAG}\" without \"{PRESET_FILE_FLAG}\" or an available command.preset.file"
                ),
            )
            .with_input_source(crate::InputSourceKind::User));
        }
        return Ok(None);
    };
    let manifest = parse_manifest(&content, &file.path, command_path)
        .map_err(|error| error.with_preset_file(&file.path))?;
    let selector = select_profile(
        &manifest,
        selected_profile.as_deref(),
        chain,
        &file.path,
        command_path,
    )
    .map_err(|error| error.with_preset_file(&file.path))?;
    let profile = manifest
        .profiles
        .iter()
        .find_map(|(name, profile)| (name == &selector.profile).then_some(profile))
        .expect("selected profile exists");
    let variant_name = selector
        .variant
        .clone()
        .or_else(|| profile.default_variant.clone());
    let mut source = PresetSource {
        file: absolute_file.clone(),
        display_file: file.path.clone(),
        profile: selector.profile.clone(),
        variant: variant_name.clone(),
        resolved_env_file: None,
    };
    let variant = variant_name.as_ref().map(|name| {
        profile
            .variants
            .iter()
            .find_map(|(variant_name, variant)| (variant_name == name).then_some(variant))
            .ok_or_else(|| {
                let available = if profile.variants.is_empty() {
                    "<none>".to_owned()
                } else {
                    profile
                        .variants
                        .iter()
                        .map(|(name, _)| name.as_str())
                        .collect::<Vec<_>>()
                        .join(", ")
                };
                configuration_error(
                    command_path,
                    format!(
                        "unknown preset variant \"{name}\" for profile \"{}\" in \"{}\" (available: {available})",
                        selector.profile,
                        file.path.display()
                    ),
                )
            })
    }).transpose().map_err(|error| error.with_preset_source(&source))?;

    let selector_label = variant_name.as_ref().map_or_else(
        || selector.profile.clone(),
        |variant| format!("{}:{variant}", selector.profile),
    );
    let mut options = profile.opts.clone();
    if let Some(variant) = variant {
        overlay_options(&mut options, &variant.opts);
    }
    let argv = build_argv(&options, &selector_label, command_path)
        .map_err(|error| error.with_preset_source(&source))?;
    validate_generated_tokens(
        &argv,
        &format!("{}#{selector_label}.opts", file.path.display()),
        command_path,
    )
    .map_err(|error| error.with_preset_source(&source))?;

    let manifest_directory = absolute_file.parent().unwrap_or_else(|| Path::new("."));
    let mut envs = BTreeMap::new();
    let profile_env_file = read_env_file(
        profile.env_file.as_deref(),
        manifest_directory,
        command_path,
    )
    .map_err(|error| error.with_preset_source(&source))?;
    if let Some(file) = &profile_env_file {
        envs.extend(file.envs.clone());
    }
    envs.extend(profile.envs.clone());
    let variant_env_file = variant
        .map(|variant| {
            read_env_file(
                variant.env_file.as_deref(),
                manifest_directory,
                command_path,
            )
        })
        .transpose()
        .map_err(|error| error.with_preset_source(&source))?
        .flatten();
    if let Some(file) = &variant_env_file {
        envs.extend(file.envs.clone());
    }
    if let Some(variant) = variant {
        envs.extend(variant.envs.clone());
    }

    source.resolved_env_file = variant_env_file
        .as_ref()
        .map(|file| file.path.clone())
        .or_else(|| profile_env_file.as_ref().map(|file| file.path.clone()));

    Ok(Some(ResolvedPreset { argv, envs, source }))
}

fn resolve_path(
    path: &Path,
    base_directory: Option<&Path>,
    command_path: &str,
) -> Result<PathBuf, ParseError> {
    if path.is_absolute() {
        return Ok(normalize_path(path));
    }
    let Some(base) = base_directory else {
        return Err(configuration_error(
            command_path,
            format!(
                "cannot resolve relative preset path \"{}\" without an explicit base directory",
                path.display()
            ),
        ));
    };
    if !base.is_absolute() {
        return Err(configuration_error(
            command_path,
            format!(
                "cannot resolve relative preset path \"{}\" from non-absolute base directory \"{}\"",
                path.display(),
                base.display()
            ),
        ));
    }
    Ok(normalize_path(&base.join(path)))
}

fn read_file(
    absolute_path: &Path,
    display_path: &Path,
    optional: bool,
    label: &str,
    command_path: &str,
) -> Result<Option<Vec<u8>>, ParseError> {
    let file = match File::open(absolute_path) {
        Ok(file) => file,
        Err(error) if optional && error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(configuration_error(
                command_path,
                format!(
                    "failed to read {label} \"{}\": {error}",
                    display_path.display()
                ),
            )
            .with_preset_file(display_path));
        }
    };
    let metadata = file.metadata().map_err(|error| {
        configuration_error(
            command_path,
            format!(
                "failed to read {label} \"{}\": {error}",
                display_path.display()
            ),
        )
        .with_preset_file(display_path)
    })?;
    if !metadata.is_file() {
        return Err(configuration_error(
            command_path,
            format!(
                "failed to read {label} \"{}\": target is not a file",
                display_path.display()
            ),
        )
        .with_preset_file(display_path));
    }
    if metadata.len() > MAX_PRESET_BYTES {
        return Err(configuration_error(
            command_path,
            format!(
                "failed to read {label} \"{}\": file exceeds {MAX_PRESET_BYTES} bytes",
                display_path.display()
            ),
        )
        .with_preset_file(display_path));
    }
    let mut content = Vec::new();
    file.take(MAX_PRESET_BYTES + 1)
        .read_to_end(&mut content)
        .map_err(|error| {
            configuration_error(
                command_path,
                format!(
                    "failed to read {label} \"{}\": {error}",
                    display_path.display()
                ),
            )
            .with_preset_file(display_path)
        })?;
    if content.len() as u64 > MAX_PRESET_BYTES {
        return Err(configuration_error(
            command_path,
            format!(
                "failed to read {label} \"{}\": file exceeds {MAX_PRESET_BYTES} bytes",
                display_path.display()
            ),
        )
        .with_preset_file(display_path));
    }
    Ok(Some(content))
}

#[derive(Clone)]
struct Manifest {
    default_profile: Option<String>,
    profiles: Vec<(String, Profile)>,
}

#[derive(Clone, Default)]
struct Profile {
    env_file: Option<String>,
    envs: BTreeMap<String, String>,
    opts: Vec<(String, PresetOptionValue)>,
    default_variant: Option<String>,
    variants: Vec<(String, Variant)>,
}

#[derive(Clone, Default)]
struct Variant {
    env_file: Option<String>,
    envs: BTreeMap<String, String>,
    opts: Vec<(String, PresetOptionValue)>,
}

#[derive(Clone)]
enum PresetOptionValue {
    Bool(bool),
    String(String),
    Number(f64),
    Array(Vec<PresetArrayValue>),
}

#[derive(Clone)]
enum PresetArrayValue {
    String(String),
    Number(f64),
}

fn parse_manifest(content: &[u8], path: &Path, command_path: &str) -> Result<Manifest, ParseError> {
    let value = json::parse(content).map_err(|error| {
        configuration_error(
            command_path,
            format!(
                "failed to parse preset file \"{}\": {error}",
                path.display()
            ),
        )
        .with_preset_file(path)
    })?;
    let Some(root) = value.object() else {
        return Err(invalid_file(path, command_path, "root must be an object"));
    };
    if !matches!(field(root, "version"), Some(json::JsonValue::Number(1.0))) {
        return Err(invalid_file(path, command_path, "\"version\" must be 1"));
    }
    let default_profile = match field(root, "defaults") {
        None => None,
        Some(json::JsonValue::Object(defaults)) => match field(defaults, "profile") {
            None => None,
            Some(json::JsonValue::String(profile)) => {
                parse_selector(profile, "defaults.profile", command_path)?;
                Some(profile.clone())
            }
            Some(_) => {
                return Err(invalid_file(
                    path,
                    command_path,
                    "\"defaults.profile\" must be a string",
                ));
            }
        },
        Some(_) => {
            return Err(invalid_file(
                path,
                command_path,
                "\"defaults\" must be an object",
            ));
        }
    };
    let Some(json::JsonValue::Object(raw_profiles)) = field(root, "profiles") else {
        return Err(invalid_file(
            path,
            command_path,
            "\"profiles\" must be an object",
        ));
    };
    let mut profiles = Vec::new();
    for (name, value) in raw_profiles {
        validate_name(
            name,
            &format!("profiles[\"{name}\"]"),
            "profile",
            command_path,
        )?;
        let Some(value) = value.object() else {
            return Err(invalid_file(
                path,
                command_path,
                format!("profile \"{name}\" must be an object"),
            ));
        };
        profiles.push((
            name.clone(),
            parse_profile(value, name, path, command_path)?,
        ));
    }
    Ok(Manifest {
        default_profile,
        profiles,
    })
}

fn parse_profile(
    value: &[(String, json::JsonValue)],
    name: &str,
    path: &Path,
    command_path: &str,
) -> Result<Profile, ParseError> {
    let label = format!("profile \"{name}\"");
    let env_file = optional_string_field(value, "envFile", &label, path, command_path)?;
    let envs = parse_envs(
        field(value, "envs"),
        &format!("{label}.envs"),
        path,
        command_path,
    )?;
    let opts = parse_opts(
        field(value, "opts"),
        &format!("{label}.opts"),
        path,
        command_path,
    )?;
    let default_variant =
        optional_string_field(value, "defaultVariant", &label, path, command_path)?;
    if let Some(default_variant) = &default_variant {
        validate_name(
            default_variant,
            &format!("{label}.defaultVariant"),
            "variant",
            command_path,
        )?;
    }
    let variants = match field(value, "variants") {
        None => Vec::new(),
        Some(json::JsonValue::Object(raw_variants)) => {
            let mut variants = Vec::new();
            for (variant_name, variant) in raw_variants {
                let variant_label = format!("{label}.variants[\"{variant_name}\"]");
                validate_name(variant_name, &variant_label, "variant", command_path)?;
                let Some(variant) = variant.object() else {
                    return Err(invalid_file(
                        path,
                        command_path,
                        format!("{variant_label} must be an object"),
                    ));
                };
                variants.push((
                    variant_name.clone(),
                    parse_variant(variant, &variant_label, path, command_path)?,
                ));
            }
            variants
        }
        Some(_) => {
            return Err(invalid_file(
                path,
                command_path,
                format!("{label}.variants must be an object"),
            ));
        }
    };
    if let Some(default_variant) = &default_variant
        && !variants.iter().any(|(name, _)| name == default_variant)
    {
        return Err(invalid_file(
            path,
            command_path,
            format!("{label}.defaultVariant \"{default_variant}\" is not found in variants"),
        ));
    }
    Ok(Profile {
        env_file,
        envs,
        opts,
        default_variant,
        variants,
    })
}

fn parse_variant(
    value: &[(String, json::JsonValue)],
    label: &str,
    path: &Path,
    command_path: &str,
) -> Result<Variant, ParseError> {
    Ok(Variant {
        env_file: optional_string_field(value, "envFile", label, path, command_path)?,
        envs: parse_envs(
            field(value, "envs"),
            &format!("{label}.envs"),
            path,
            command_path,
        )?,
        opts: parse_opts(
            field(value, "opts"),
            &format!("{label}.opts"),
            path,
            command_path,
        )?,
    })
}

fn optional_string_field(
    value: &[(String, json::JsonValue)],
    field_name: &str,
    label: &str,
    path: &Path,
    command_path: &str,
) -> Result<Option<String>, ParseError> {
    match field(value, field_name) {
        None => Ok(None),
        Some(json::JsonValue::String(value)) => Ok(Some(value.clone())),
        Some(_) => Err(invalid_file(
            path,
            command_path,
            format!("{label}.{field_name} must be a string"),
        )),
    }
}

fn parse_envs(
    value: Option<&json::JsonValue>,
    label: &str,
    path: &Path,
    command_path: &str,
) -> Result<BTreeMap<String, String>, ParseError> {
    let Some(value) = value else {
        return Ok(BTreeMap::new());
    };
    let Some(entries) = value.object() else {
        return Err(invalid_file(
            path,
            command_path,
            format!("{label} must be an object"),
        ));
    };
    let mut envs = BTreeMap::new();
    for (key, value) in entries {
        let json::JsonValue::String(value) = value else {
            return Err(invalid_file(
                path,
                command_path,
                format!("{label}[\"{key}\"] must be a string"),
            ));
        };
        envs.insert(key.clone(), value.clone());
    }
    Ok(envs)
}

fn parse_opts(
    value: Option<&json::JsonValue>,
    label: &str,
    path: &Path,
    command_path: &str,
) -> Result<Vec<(String, PresetOptionValue)>, ParseError> {
    let Some(value) = value else {
        return Ok(Vec::new());
    };
    let Some(entries) = value.object() else {
        return Err(invalid_file(
            path,
            command_path,
            format!("{label} must be an object"),
        ));
    };
    entries
        .iter()
        .map(|(key, value)| {
            parse_option_value(value, &format!("{label}[\"{key}\"]"), path, command_path)
                .map(|value| (key.clone(), value))
        })
        .collect()
}

fn parse_option_value(
    value: &json::JsonValue,
    label: &str,
    path: &Path,
    command_path: &str,
) -> Result<PresetOptionValue, ParseError> {
    match value {
        json::JsonValue::Bool(value) => Ok(PresetOptionValue::Bool(*value)),
        json::JsonValue::String(value) => Ok(PresetOptionValue::String(value.clone())),
        json::JsonValue::Number(value) => Ok(PresetOptionValue::Number(*value)),
        json::JsonValue::Array(values) => values
            .iter()
            .enumerate()
            .map(|(index, value)| match value {
                json::JsonValue::String(value) => Ok(PresetArrayValue::String(value.clone())),
                json::JsonValue::Number(value) => Ok(PresetArrayValue::Number(*value)),
                _ => Err(invalid_file(
                    path,
                    command_path,
                    format!("{label}[{index}] must be a string or finite number"),
                )),
            })
            .collect::<Result<Vec<_>, _>>()
            .map(PresetOptionValue::Array),
        _ => Err(invalid_file(
            path,
            command_path,
            format!("{label} must be boolean|string|number|(string|number)[]"),
        )),
    }
}

fn field<'a>(entries: &'a [(String, json::JsonValue)], name: &str) -> Option<&'a json::JsonValue> {
    entries
        .iter()
        .find_map(|(key, value)| (key == name).then_some(value))
}

struct Selector {
    profile: String,
    variant: Option<String>,
}

fn select_profile(
    manifest: &Manifest,
    selected: Option<&str>,
    chain: &[&Command],
    file: &Path,
    command_path: &str,
) -> Result<Selector, ParseError> {
    let selector = selected
        .map(ToOwned::to_owned)
        .or_else(|| {
            (0..chain.len()).find_map(|index| {
                let suffix = chain[index..]
                    .iter()
                    .map(|command| command.name.as_str())
                    .collect::<Vec<_>>()
                    .join(".");
                manifest
                    .profiles
                    .iter()
                    .any(|(name, _)| name == &suffix)
                    .then_some(suffix)
            })
        })
        .or_else(|| manifest.default_profile.clone())
        .or_else(|| {
            manifest
                .profiles
                .iter()
                .any(|(name, _)| name == "default")
                .then(|| "default".to_owned())
        })
        .ok_or_else(|| {
            configuration_error(
                command_path,
                format!(
                    "missing profile for preset file \"{}\": provide \"{PRESET_PROFILE_FLAG}\", define command-path suffix profile, defaults.profile, or profile \"default\"",
                    file.display()
                ),
            )
            .with_preset_file(file)
        })?;
    let selector = parse_selector(&selector, "preset profile", command_path)?;
    if !manifest
        .profiles
        .iter()
        .any(|(name, _)| name == &selector.profile)
    {
        return Err(configuration_error(
            command_path,
            format!(
                "unknown preset profile \"{}\" in \"{}\"",
                selector.profile,
                file.display()
            ),
        )
        .with_preset_file(file));
    }
    Ok(selector)
}

fn parse_selector(
    selector: &str,
    source: &str,
    command_path: &str,
) -> Result<Selector, ParseError> {
    let normalized = selector.trim();
    let mut parts = normalized.split(':');
    let profile = parts.next().unwrap_or_default();
    let variant = parts.next();
    if profile.is_empty() || variant.is_some_and(str::is_empty) || parts.next().is_some() {
        return Err(configuration_error(
            command_path,
            format!(
                "invalid value for \"{source}\": \"{selector}\" (must be \"<profile>\" or \"<profile>:<variant>\")"
            ),
        ));
    }
    validate_name(profile, source, "profile", command_path)?;
    if let Some(variant) = variant {
        validate_name(variant, source, "variant", command_path)?;
    }
    Ok(Selector {
        profile: profile.to_owned(),
        variant: variant.map(ToOwned::to_owned),
    })
}

fn validate_name(
    name: &str,
    source: &str,
    kind: &str,
    command_path: &str,
) -> Result<(), ParseError> {
    let mut bytes = name.bytes();
    let valid = bytes
        .next()
        .is_some_and(|byte| byte.is_ascii_alphanumeric())
        && bytes.all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'));
    if valid {
        return Ok(());
    }
    Err(configuration_error(
        command_path,
        format!(
            "invalid {kind} name for \"{source}\": \"{name}\" (must match [A-Za-z0-9][A-Za-z0-9._-]*)"
        ),
    ))
}

fn overlay_options(
    target: &mut Vec<(String, PresetOptionValue)>,
    overlay: &[(String, PresetOptionValue)],
) {
    let mut indexes = target
        .iter()
        .enumerate()
        .map(|(index, (name, _))| (name.clone(), index))
        .collect::<BTreeMap<_, _>>();
    for (name, value) in overlay {
        if let Some(index) = indexes.get(name).copied() {
            target[index].1 = value.clone();
        } else {
            indexes.insert(name.clone(), target.len());
            target.push((name.clone(), value.clone()));
        }
    }
}

fn build_argv(
    options: &[(String, PresetOptionValue)],
    selector: &str,
    command_path: &str,
) -> Result<Vec<String>, ParseError> {
    let mut argv = Vec::new();
    for (raw_name, value) in options {
        let name = normalize_option_name(raw_name, selector, command_path)?;
        let positive = format!("--{name}");
        match value {
            PresetOptionValue::Bool(value) => {
                argv.push(if *value {
                    positive
                } else {
                    format!("--no-{name}")
                });
            }
            PresetOptionValue::String(value) => {
                argv.push(format!("{positive}={value}"));
            }
            PresetOptionValue::Number(value) => {
                let value = value.to_string();
                argv.push(format!("{positive}={value}"));
            }
            PresetOptionValue::Array(values) => {
                if values.is_empty() {
                    continue;
                }
                argv.extend(values.iter().map(|value| {
                    let value = match value {
                        PresetArrayValue::String(value) => value.clone(),
                        PresetArrayValue::Number(value) => value.to_string(),
                    };
                    format!("{positive}={value}")
                }));
            }
        }
    }
    Ok(argv)
}

fn normalize_option_name(
    raw: &str,
    selector: &str,
    command_path: &str,
) -> Result<String, ParseError> {
    let value = raw.trim();
    let stripped = value.strip_prefix("--").unwrap_or(value);
    if stripped.contains('-') {
        let lowered = stripped.to_ascii_lowercase();
        let mut segments = lowered.split('-');
        let valid = segments.next().is_some_and(valid_lower_segment)
            && segments.all(|segment| {
                !segment.is_empty()
                    && segment
                        .bytes()
                        .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
            });
        if valid {
            return Ok(lowered);
        }
    } else {
        let mut bytes = stripped.bytes();
        if bytes.next().is_some_and(|byte| byte.is_ascii_lowercase())
            && bytes.all(|byte| byte.is_ascii_alphanumeric())
        {
            let mut kebab = String::new();
            for character in stripped.chars() {
                if character.is_ascii_uppercase() {
                    kebab.push('-');
                    kebab.push(character.to_ascii_lowercase());
                } else {
                    kebab.push(character);
                }
            }
            return Ok(kebab);
        }
    }
    Err(configuration_error(
        command_path,
        format!("invalid option name \"{raw}\" in preset profile \"{selector}\""),
    ))
}

fn valid_lower_segment(segment: &str) -> bool {
    let mut bytes = segment.bytes();
    bytes.next().is_some_and(|byte| byte.is_ascii_lowercase())
        && bytes.all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit())
}

fn validate_generated_tokens(
    tokens: &[String],
    source: &str,
    command_path: &str,
) -> Result<(), ParseError> {
    if tokens.first().is_some_and(|token| !token.starts_with('-')) {
        return Err(configuration_error(
            command_path,
            format!(
                "invalid preset options in \"{source}\": bare token \"{}\" cannot appear before any option token",
                tokens[0]
            ),
        ));
    }
    for token in tokens {
        if token == "--" {
            return Err(configuration_error(
                command_path,
                format!("invalid preset options in \"{source}\": \"--\" is not allowed"),
            ));
        }
        if matches!(token.as_str(), "help" | "--help" | "--version") {
            return Err(configuration_error(
                command_path,
                format!(
                    "invalid preset options in \"{source}\": control token \"{token}\" is not allowed"
                ),
            ));
        }
        if is_directive_token(token) {
            return Err(configuration_error(
                command_path,
                format!(
                    "invalid preset options in \"{source}\": preset directive \"{token}\" is not allowed"
                ),
            ));
        }
    }
    Ok(())
}

fn read_env_file(
    path: Option<&str>,
    base_directory: &Path,
    command_path: &str,
) -> Result<Option<ResolvedEnvFile>, ParseError> {
    let Some(path) = path else {
        return Ok(None);
    };
    let display_path = Path::new(path);
    let absolute_path = if display_path.is_absolute() {
        normalize_path(display_path)
    } else {
        normalize_path(&base_directory.join(display_path))
    };
    let content = read_file(
        &absolute_path,
        display_path,
        false,
        "preset env file",
        command_path,
    )?
    .expect("required env file returns content");
    let content = std::str::from_utf8(&content).map_err(|error| {
        configuration_error(
            command_path,
            format!(
                "failed to parse preset env file \"{}\": {error}",
                display_path.display()
            ),
        )
        .with_preset_file(display_path)
    })?;
    let envs = parse_env_with_limits(content, &PRESET_ENV_LIMITS).map_err(|error| {
        configuration_error(
            command_path,
            format!(
                "failed to parse preset env file \"{}\": {error}",
                display_path.display()
            ),
        )
        .with_preset_file(display_path)
    })?;
    Ok(Some(ResolvedEnvFile {
        path: absolute_path,
        envs,
    }))
}

fn invalid_file(path: &Path, command_path: &str, message: impl AsRef<str>) -> ParseError {
    configuration_error(
        command_path,
        format!(
            "invalid preset file \"{}\": {}",
            path.display(),
            message.as_ref()
        ),
    )
    .with_preset_file(path)
}

fn configuration_error(command_path: &str, message: impl Into<String>) -> ParseError {
    ParseError::new(ParseErrorKind::Configuration, command_path, message)
}

fn is_directive_token(token: &str) -> bool {
    token == PRESET_FILE_FLAG
        || token.starts_with("--preset-file=")
        || token == PRESET_PROFILE_FLAG
        || token.starts_with("--preset-profile=")
}

fn is_control(token: &str) -> bool {
    matches!(token, "help" | "--help" | "-h" | "--version" | "-V")
}

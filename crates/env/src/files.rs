use std::ffi::{OsStr, OsString};
use std::fs::{self, File};
use std::io::{ErrorKind, Read};
use std::path::{Component, Path, PathBuf};

use crate::limits::SourceBudget;
use crate::{
    EnvLimits, EnvRecord, ResolveError, ResolveFilesError, ResolveFilesWithLimitsError,
    ResolveWithLimitsError, resolve_upward, resolve_upward_with_limits,
};

struct LoadedSource {
    path: PathBuf,
    content: String,
}

pub fn resolve_upward_files<I, S>(
    file_names: I,
    from_directory: impl AsRef<Path>,
    root_directory: Option<&Path>,
) -> Result<EnvRecord, ResolveFilesError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let file_names = validate_file_names(file_names)?;
    let from = canonical_directory(from_directory.as_ref())?;
    let root = root_directory.map(canonical_directory).transpose()?;
    validate_root_boundary(&from, root.as_ref())?;

    let mut sources = Vec::new();
    for directory in from.ancestors() {
        load_directory_sources(directory, &file_names, &mut sources)?;
        if root.as_deref() == Some(directory) {
            break;
        }
    }
    resolve_loaded_sources(&sources)
}

pub fn resolve_upward_files_with_limits<I, S>(
    file_names: I,
    from_directory: impl AsRef<Path>,
    root_directory: Option<&Path>,
    limits: &EnvLimits,
) -> Result<EnvRecord, ResolveFilesWithLimitsError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    let file_names =
        validate_file_names(file_names).map_err(ResolveFilesWithLimitsError::Resolve)?;
    let from = canonical_directory(from_directory.as_ref())
        .map_err(ResolveFilesWithLimitsError::Resolve)?;
    let root = root_directory
        .map(canonical_directory)
        .transpose()
        .map_err(ResolveFilesWithLimitsError::Resolve)?;
    validate_root_boundary(&from, root.as_ref()).map_err(ResolveFilesWithLimitsError::Resolve)?;

    let mut sources = Vec::new();
    let mut source_budget = SourceBudget::new(*limits);
    for directory in from.ancestors() {
        load_directory_sources_with_limits(
            directory,
            &file_names,
            &mut sources,
            &mut source_budget,
        )?;
        if root.as_deref() == Some(directory) {
            break;
        }
    }
    resolve_loaded_sources_with_limits(&sources, limits)
}

fn validate_root_boundary(from: &Path, root: Option<&PathBuf>) -> Result<(), ResolveFilesError> {
    if let Some(root) = root
        && !from.starts_with(root)
    {
        return Err(ResolveFilesError::root_directory_not_ancestor(
            from.to_path_buf(),
            root.clone(),
        ));
    }
    Ok(())
}

fn validate_file_names<I, S>(file_names: I) -> Result<Vec<OsString>, ResolveFilesError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<OsStr>,
{
    file_names
        .into_iter()
        .map(|file_name| {
            let file_name = PathBuf::from(file_name.as_ref());
            let mut components = file_name.components();
            let valid = matches!(components.next(), Some(Component::Normal(_)))
                && components.next().is_none();
            if valid {
                Ok(file_name.into_os_string())
            } else {
                Err(ResolveFilesError::invalid_file_name(file_name))
            }
        })
        .collect()
}

fn canonical_directory(path: &Path) -> Result<PathBuf, ResolveFilesError> {
    let canonical =
        fs::canonicalize(path).map_err(|error| ResolveFilesError::io(path.to_path_buf(), error))?;
    let metadata = fs::metadata(&canonical)
        .map_err(|error| ResolveFilesError::io(canonical.clone(), error))?;
    if metadata.is_dir() {
        Ok(canonical)
    } else {
        Err(ResolveFilesError::not_directory(canonical))
    }
}

fn load_directory_sources(
    directory: &Path,
    file_names: &[OsString],
    sources: &mut Vec<LoadedSource>,
) -> Result<(), ResolveFilesError> {
    for file_name in file_names {
        let path = directory.join(file_name);
        match fs::read_to_string(&path) {
            Ok(content) => sources.push(LoadedSource { path, content }),
            Err(error) if error.kind() == ErrorKind::NotFound => {}
            Err(error) => return Err(ResolveFilesError::io(path, error)),
        }
    }
    Ok(())
}

fn load_directory_sources_with_limits(
    directory: &Path,
    file_names: &[OsString],
    sources: &mut Vec<LoadedSource>,
    source_budget: &mut SourceBudget,
) -> Result<(), ResolveFilesWithLimitsError> {
    for file_name in file_names {
        let path = directory.join(file_name);
        if let Some(content) = read_limited_source(&path, sources.len(), source_budget)? {
            sources.push(LoadedSource { path, content });
        }
    }
    Ok(())
}

fn read_limited_source(
    path: &Path,
    source_index: usize,
    budget: &mut SourceBudget,
) -> Result<Option<String>, ResolveFilesWithLimitsError> {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(ResolveFilesWithLimitsError::Resolve(ResolveFilesError::io(
                path.to_path_buf(),
                error,
            )));
        }
    };
    let metadata = file.metadata().map_err(|error| {
        ResolveFilesWithLimitsError::Resolve(ResolveFilesError::io(path.to_path_buf(), error))
    })?;
    let metadata_bytes = match usize::try_from(metadata.len()) {
        Ok(bytes) => bytes,
        Err(_) => {
            return Err(ResolveFilesWithLimitsError::limit(
                Some(path.to_path_buf()),
                crate::LimitError::source_bytes(source_index, budget.maximum_source_bytes()),
            ));
        }
    };
    budget
        .check(source_index, metadata_bytes)
        .map_err(|error| ResolveFilesWithLimitsError::limit(Some(path.to_path_buf()), error))?;

    let maximum_read_bytes = budget.maximum_read_bytes();
    let mut bytes = Vec::new();
    file.by_ref()
        .take(maximum_read_bytes.saturating_add(1) as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| {
            ResolveFilesWithLimitsError::Resolve(ResolveFilesError::io(path.to_path_buf(), error))
        })?;
    budget
        .charge(source_index, bytes.len())
        .map_err(|error| ResolveFilesWithLimitsError::limit(Some(path.to_path_buf()), error))?;
    String::from_utf8(bytes).map(Some).map_err(|error| {
        let error = error.utf8_error();
        ResolveFilesWithLimitsError::Resolve(ResolveFilesError::io(
            path.to_path_buf(),
            std::io::Error::new(ErrorKind::InvalidData, error),
        ))
    })
}

fn resolve_loaded_sources(sources: &[LoadedSource]) -> Result<EnvRecord, ResolveFilesError> {
    match resolve_upward(sources.iter().map(|source| source.content.as_str())) {
        Ok(env) => Ok(env),
        Err(ResolveError::Parse {
            source_index,
            error,
        }) => {
            let path = sources
                .get(source_index)
                .expect("resolve source indices correspond to loaded files")
                .path
                .clone();
            Err(ResolveFilesError::parse(path, error))
        }
        Err(ResolveError::Cycle(error)) => Err(ResolveFilesError::cycle(error)),
    }
}

fn resolve_loaded_sources_with_limits(
    sources: &[LoadedSource],
    limits: &EnvLimits,
) -> Result<EnvRecord, ResolveFilesWithLimitsError> {
    match resolve_upward_with_limits(sources.iter().map(|source| source.content.as_str()), limits) {
        Ok(env) => Ok(env),
        Err(ResolveWithLimitsError::Resolve(ResolveError::Parse {
            source_index,
            error,
        })) => {
            let path = sources
                .get(source_index)
                .expect("resolve source indices correspond to loaded files")
                .path
                .clone();
            Err(ResolveFilesWithLimitsError::Resolve(
                ResolveFilesError::parse(path, error),
            ))
        }
        Err(ResolveWithLimitsError::Resolve(ResolveError::Cycle(error))) => Err(
            ResolveFilesWithLimitsError::Resolve(ResolveFilesError::cycle(error)),
        ),
        Err(ResolveWithLimitsError::Limit(error)) => {
            let path = error
                .source_index()
                .and_then(|source_index| sources.get(source_index))
                .map(|source| source.path.clone());
            Err(ResolveFilesWithLimitsError::limit(path, error))
        }
    }
}

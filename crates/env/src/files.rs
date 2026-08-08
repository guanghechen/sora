use std::ffi::{OsStr, OsString};
use std::fs;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};

use crate::{EnvRecord, ResolveError, ResolveFilesError, resolve_upward};

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
    if let Some(root) = &root
        && !from.starts_with(root)
    {
        return Err(ResolveFilesError::root_directory_not_ancestor(
            from,
            root.clone(),
        ));
    }

    let mut sources = Vec::new();
    for directory in from.ancestors() {
        load_directory_sources(directory, &file_names, &mut sources)?;
        if root.as_deref() == Some(directory) {
            break;
        }
    }

    resolve_loaded_sources(&sources)
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

use std::collections::{BTreeMap, BTreeSet};

use crate::parser::{EnvValue, parse_declarations};
use crate::{EnvRecord, ResolveError};

pub fn resolve(content: &str) -> Result<EnvRecord, ResolveError> {
    resolve_upward([content])
}

pub fn resolve_upward<I, S>(sources: I) -> Result<EnvRecord, ResolveError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut declarations = BTreeMap::new();
    for (source_index, source) in sources.into_iter().enumerate() {
        let parsed = parse_declarations(source.as_ref())
            .map_err(|error| ResolveError::parse(source_index, error))?;
        let mut source_declarations = BTreeMap::new();
        for declaration in parsed {
            source_declarations.insert(declaration.key, declaration.value);
        }
        for (key, value) in source_declarations {
            declarations.entry(key).or_insert(value);
        }
    }

    resolve_declarations(&declarations)
}

fn resolve_declarations(
    declarations: &BTreeMap<String, EnvValue>,
) -> Result<EnvRecord, ResolveError> {
    let mut dependencies = BTreeMap::new();
    let mut dependents: BTreeMap<String, Vec<String>> = BTreeMap::new();
    let mut remaining = BTreeMap::new();
    let mut ready = BTreeSet::new();

    for (key, declaration) in declarations {
        let mut selected_dependencies = BTreeSet::new();
        declaration.for_each_dependency(|dependency| {
            if declarations.contains_key(dependency) {
                selected_dependencies.insert(dependency.to_owned());
            }
        });
        let selected_dependencies = selected_dependencies.into_iter().collect::<Vec<_>>();
        if selected_dependencies.is_empty() {
            ready.insert(key.clone());
        }
        remaining.insert(key.clone(), selected_dependencies.len());
        for dependency in &selected_dependencies {
            dependents
                .entry(dependency.clone())
                .or_default()
                .push(key.clone());
        }
        dependencies.insert(key.clone(), selected_dependencies);
    }

    let mut resolved = EnvRecord::new();
    while let Some(key) = ready.pop_first() {
        remaining.remove(&key);
        let value = declarations[&key].render(|name| resolved.get(name).map(String::as_str));
        resolved.insert(key.clone(), value);

        if let Some(key_dependents) = dependents.get(&key) {
            for dependent in key_dependents {
                let dependency_count = remaining
                    .get_mut(dependent)
                    .expect("unresolved dependents remain in the topology");
                *dependency_count -= 1;
                if *dependency_count == 0 {
                    ready.insert(dependent.clone());
                }
            }
        }
    }

    if !remaining.is_empty() {
        return Err(ResolveError::cycle(find_cycle(&dependencies, &remaining)));
    }
    Ok(resolved)
}

fn find_cycle(
    dependencies: &BTreeMap<String, Vec<String>>,
    remaining: &BTreeMap<String, usize>,
) -> Vec<String> {
    let mut path = Vec::new();
    let mut positions = BTreeMap::new();
    let mut key = remaining
        .first_key_value()
        .expect("cycle detection starts with an unresolved variable")
        .0
        .clone();

    loop {
        if let Some(position) = positions.get(&key).copied() {
            let mut cycle = path[position..].to_vec();
            cycle.push(key);
            return cycle;
        }
        positions.insert(key.clone(), path.len());
        path.push(key.clone());
        key = dependencies[&key]
            .iter()
            .find(|dependency| remaining.contains_key(*dependency))
            .expect("every unresolved variable retains an unresolved dependency")
            .clone();
    }
}

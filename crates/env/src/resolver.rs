use std::collections::{BTreeMap, BTreeSet};

use crate::limits::{SourceBudget, ValueBudget};
use crate::parser::{EnvValue, parse_declarations};
use crate::{EnvLimits, EnvRecord, ResolveError, ResolveWithLimitsError};

struct Topology<'a> {
    dependencies: BTreeMap<&'a str, Vec<&'a str>>,
    dependents: BTreeMap<&'a str, Vec<&'a str>>,
    remaining: BTreeMap<&'a str, usize>,
    ready: BTreeSet<&'a str>,
}

pub fn resolve(content: &str) -> Result<EnvRecord, ResolveError> {
    resolve_upward([content])
}

pub fn resolve_with_limits(
    content: &str,
    limits: &EnvLimits,
) -> Result<EnvRecord, ResolveWithLimitsError> {
    resolve_upward_with_limits([content], limits)
}

pub fn resolve_upward<I, S>(sources: I) -> Result<EnvRecord, ResolveError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let declarations = select_declarations(sources)?;
    resolve_declarations(&declarations)
}

pub fn resolve_upward_with_limits<I, S>(
    sources: I,
    limits: &EnvLimits,
) -> Result<EnvRecord, ResolveWithLimitsError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut source_budget = SourceBudget::new(*limits);
    let mut declarations = BTreeMap::new();
    for (source_index, source) in sources.into_iter().enumerate() {
        let source = source.as_ref();
        source_budget
            .charge(source_index, source.len())
            .map_err(ResolveWithLimitsError::Limit)?;
        let parsed = parse_declarations(source).map_err(|error| {
            ResolveWithLimitsError::Resolve(ResolveError::parse(source_index, error))
        })?;
        insert_source_declarations(&mut declarations, parsed);
    }
    resolve_declarations_with_limits(&declarations, limits)
}

fn select_declarations<I, S>(sources: I) -> Result<BTreeMap<String, EnvValue>, ResolveError>
where
    I: IntoIterator<Item = S>,
    S: AsRef<str>,
{
    let mut declarations = BTreeMap::new();
    for (source_index, source) in sources.into_iter().enumerate() {
        let source = source.as_ref();
        let parsed =
            parse_declarations(source).map_err(|error| ResolveError::parse(source_index, error))?;
        insert_source_declarations(&mut declarations, parsed);
    }
    Ok(declarations)
}

fn insert_source_declarations(
    declarations: &mut BTreeMap<String, EnvValue>,
    parsed: impl IntoIterator<Item = crate::parser::Declaration>,
) {
    let mut source_declarations = BTreeMap::new();
    for declaration in parsed {
        source_declarations.insert(declaration.key, declaration.value);
    }
    for (key, value) in source_declarations {
        declarations.entry(key).or_insert(value);
    }
}

fn resolve_declarations(
    declarations: &BTreeMap<String, EnvValue>,
) -> Result<EnvRecord, ResolveError> {
    match resolve_declarations_inner(declarations, None) {
        Ok(env) => Ok(env),
        Err(ResolveWithLimitsError::Resolve(error)) => Err(error),
        Err(ResolveWithLimitsError::Limit(_)) => {
            unreachable!("unbounded resolution cannot produce a limit error")
        }
    }
}

fn resolve_declarations_with_limits(
    declarations: &BTreeMap<String, EnvValue>,
    limits: &EnvLimits,
) -> Result<EnvRecord, ResolveWithLimitsError> {
    resolve_declarations_inner(declarations, Some(*limits))
}

fn resolve_declarations_inner(
    declarations: &BTreeMap<String, EnvValue>,
    limits: Option<EnvLimits>,
) -> Result<EnvRecord, ResolveWithLimitsError> {
    let Topology {
        dependencies,
        dependents,
        mut remaining,
        mut ready,
    } = build_topology(declarations);

    let mut budget = limits.map(ValueBudget::new);
    let mut resolved = EnvRecord::new();
    while let Some(key) = ready.pop_first() {
        remaining.remove(key);
        let declaration = &declarations[key];
        let value = match &mut budget {
            Some(budget) => declaration
                .render_with_limits(key, |name| resolved.get(name).map(String::as_str), budget)
                .map_err(ResolveWithLimitsError::Limit)?,
            None => declaration.render(|name| resolved.get(name).map(String::as_str)),
        };
        resolved.insert(key.to_owned(), value);

        if let Some(key_dependents) = dependents.get(key) {
            for &dependent in key_dependents {
                let dependency_count = remaining
                    .get_mut(dependent)
                    .expect("unresolved dependents remain in the topology");
                *dependency_count -= 1;
                if *dependency_count == 0 {
                    ready.insert(dependent);
                }
            }
        }
    }

    if !remaining.is_empty() {
        return Err(ResolveWithLimitsError::Resolve(ResolveError::cycle(
            find_cycle(&dependencies, &remaining),
        )));
    }
    Ok(resolved)
}

fn build_topology(declarations: &BTreeMap<String, EnvValue>) -> Topology<'_> {
    let mut dependencies = BTreeMap::new();
    let mut dependents: BTreeMap<&str, Vec<&str>> = BTreeMap::new();
    let mut remaining = BTreeMap::new();
    let mut ready = BTreeSet::new();

    for (key, declaration) in declarations {
        let key = key.as_str();
        let mut selected_dependencies = BTreeSet::new();
        declaration.for_each_dependency(|dependency| {
            if let Some((selected_key, _)) = declarations.get_key_value(dependency) {
                selected_dependencies.insert(selected_key.as_str());
            }
        });
        let selected_dependencies = selected_dependencies.into_iter().collect::<Vec<_>>();
        if selected_dependencies.is_empty() {
            ready.insert(key);
        }
        remaining.insert(key, selected_dependencies.len());
        for &dependency in &selected_dependencies {
            dependents.entry(dependency).or_default().push(key);
        }
        dependencies.insert(key, selected_dependencies);
    }

    Topology {
        dependencies,
        dependents,
        remaining,
        ready,
    }
}

fn find_cycle(
    dependencies: &BTreeMap<&str, Vec<&str>>,
    remaining: &BTreeMap<&str, usize>,
) -> Vec<String> {
    let mut path: Vec<&str> = Vec::new();
    let mut positions: BTreeMap<&str, usize> = BTreeMap::new();
    let mut key = *remaining
        .first_key_value()
        .expect("cycle detection starts with an unresolved variable")
        .0;

    loop {
        if let Some(position) = positions.get(key).copied() {
            let mut cycle = path[position..]
                .iter()
                .map(|variable| (*variable).to_owned())
                .collect::<Vec<_>>();
            cycle.push(key.to_owned());
            return cycle;
        }
        positions.insert(key, path.len());
        path.push(key);
        key = dependencies[&key]
            .iter()
            .find(|dependency| remaining.contains_key(*dependency))
            .expect("every unresolved variable retains an unresolved dependency")
            .to_owned();
    }
}

#[cfg(test)]
mod tests {
    use super::{build_topology, select_declarations};

    #[test]
    fn topology_borrows_long_dependent_keys_for_each_edge() {
        let dependent = format!("LONG_{}", "X".repeat(4096));
        let source = format!("{dependent}=${{A}}${{B}}\nA=\nB=\n");
        let declarations = select_declarations([source]).unwrap();
        let selected_dependent = declarations
            .get_key_value(dependent.as_str())
            .expect("long dependent should be selected")
            .0
            .as_str();
        let topology = build_topology(&declarations);

        for dependency in ["A", "B"] {
            let stored_dependent = topology.dependents[dependency][0];
            assert!(std::ptr::eq(stored_dependent, selected_dependent));
        }
    }
}

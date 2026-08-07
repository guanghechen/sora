use std::path::{Path, PathBuf};

#[path = "../src/help/display.rs"]
mod help_display;
#[path = "../src/preset/env.rs"]
mod preset_env;
#[path = "../src/preset/path.rs"]
mod preset_path;

#[test]
fn display_width_accounts_for_wide_and_combining_characters() {
    assert_eq!(help_display::display_width("模式"), 4);
    assert_eq!(help_display::display_width("e\u{0301}"), 1);
    assert_eq!(help_display::pad_display_end("模式", 6), "模式  ");
    assert_eq!(help_display::pad_display_end("e\u{0301}", 3), "e\u{0301}  ");
}

#[test]
fn quoted_env_values_distinguish_escaped_quotes_from_escaped_backslashes() {
    let envs = preset_env::parse("PATH=\"C:\\\\\"\nQUOTE=\"say \\\"hi\\\"\"\n")
        .expect("quoted env values should parse");
    assert_eq!(envs.get("PATH").map(String::as_str), Some("C:\\"));
    assert_eq!(envs.get("QUOTE").map(String::as_str), Some("say \"hi\""));
}

#[test]
fn inline_env_comments_accept_any_whitespace_run() {
    let envs = preset_env::parse("A=value\t  # comment\nB=#literal\n").expect("env should parse");
    assert_eq!(envs.get("A").map(String::as_str), Some("value"));
    assert_eq!(envs.get("B").map(String::as_str), Some("#literal"));
}

#[test]
fn lexical_normalization_preserves_unresolved_parent_components() {
    assert_eq!(
        preset_path::normalize_path(Path::new("../../config/../preset.json")),
        PathBuf::from("../../preset.json")
    );
    assert_eq!(
        preset_path::normalize_path(Path::new("base/../../preset.json")),
        PathBuf::from("../preset.json")
    );
}

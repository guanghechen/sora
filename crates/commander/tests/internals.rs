use std::path::{Path, PathBuf};

#[path = "../src/help/display.rs"]
mod help_display;
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

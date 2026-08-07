pub(super) fn display_width(value: &str) -> usize {
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

pub(super) fn pad_display_end(value: &str, target_width: usize) -> String {
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

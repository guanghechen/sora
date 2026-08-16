use std::borrow::Cow;
use std::path::Path;

const RESET: &str = "\x1b[0m";

/// Explicit terminal and color policy for rendering one file path.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct FilePathStyle {
    terminal: bool,
    color: bool,
}

impl FilePathStyle {
    /// Construct a path style from caller-owned terminal and color state.
    #[must_use]
    pub const fn new(terminal: bool, color: bool) -> Self {
        Self { terminal, color }
    }

    /// Render `path` as safe visible text with optional color and OSC 8 hyperlinking.
    #[must_use]
    pub fn format(self, path: &Path) -> String {
        let display = path.to_string_lossy();
        let visible = sanitize(&display);
        let visible = self.paint(&visible);
        if !self.terminal {
            return visible;
        }
        let Some(target) = file_uri(path) else {
            return visible;
        };
        format!("\x1b]8;;{target}\x1b\\{visible}\x1b]8;;\x1b\\")
    }

    fn paint(self, text: &str) -> String {
        if !self.color || text.is_empty() {
            return text.to_owned();
        }
        format!("\x1b[4;36m{text}{RESET}")
    }
}

fn sanitize(value: &str) -> Cow<'_, str> {
    if !value.chars().any(char::is_control) {
        return Cow::Borrowed(value);
    }
    Cow::Owned(
        value
            .chars()
            .map(|character| {
                if character.is_control() {
                    '\u{fffd}'
                } else {
                    character
                }
            })
            .collect(),
    )
}

#[cfg(unix)]
fn file_uri(path: &Path) -> Option<String> {
    use std::os::unix::ffi::OsStrExt;

    path.is_absolute()
        .then(|| format!("file://{}", percent_encode(path.as_os_str().as_bytes())))
}

#[cfg(windows)]
fn file_uri(path: &Path) -> Option<String> {
    windows_file_uri(path.to_str()?)
}

#[cfg(any(windows, test))]
fn windows_file_uri(path: &str) -> Option<String> {
    let path = path.replace('\\', "/");
    let path = path.as_str();

    if path
        .get(..8)
        .is_some_and(|prefix| prefix.eq_ignore_ascii_case("//?/UNC/"))
    {
        return windows_unc_uri(&path[8..]);
    }
    if let Some(path) = path.strip_prefix("//?/") {
        return windows_drive_uri(path);
    }
    if path.starts_with("//./") {
        return None;
    }
    if let Some(path) = path.strip_prefix("//") {
        return windows_unc_uri(path);
    }
    windows_drive_uri(path)
}

#[cfg(any(windows, test))]
fn windows_drive_uri(path: &str) -> Option<String> {
    let bytes = path.as_bytes();
    if bytes.len() < 3 || !bytes[0].is_ascii_alphabetic() || bytes[1] != b':' || bytes[2] != b'/' {
        return None;
    }
    Some(format!("file:///{}", percent_encode(path.as_bytes())))
}

#[cfg(any(windows, test))]
fn windows_unc_uri(path: &str) -> Option<String> {
    let (server, share_and_path) = path.split_once('/')?;
    let share = share_and_path.split('/').next()?;
    if server.is_empty() || share.is_empty() {
        return None;
    }
    Some(format!("file://{}", percent_encode(path.as_bytes())))
}

#[cfg(not(any(unix, windows)))]
fn file_uri(_path: &Path) -> Option<String> {
    None
}

fn percent_encode(bytes: &[u8]) -> String {
    let mut encoded = String::with_capacity(bytes.len());
    for &byte in bytes {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~' | b'/' | b':') {
            encoded.push(char::from(byte));
        } else {
            encoded.push('%');
            encoded.push(hex(byte >> 4));
            encoded.push(hex(byte & 0x0f));
        }
    }
    encoded
}

const fn hex(value: u8) -> char {
    match value {
        0..=9 => (b'0' + value) as char,
        _ => (b'A' + value - 10) as char,
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::{FilePathStyle, windows_file_uri};

    #[cfg(unix)]
    #[test]
    fn terminal_path_uses_color_link_encoding_and_visible_sanitization() {
        let path = Path::new("/tmp/part one#\u{1b}");
        let formatted = FilePathStyle::new(true, true).format(path);
        assert!(formatted.contains("\x1b]8;;file:///tmp/part%20one%23%1B\x1b\\"));
        assert!(formatted.contains("\x1b[4;36m/tmp/part one#�\x1b[0m"));
    }

    #[cfg(unix)]
    #[test]
    fn unix_file_uri_preserves_non_utf8_path_bytes() {
        use std::ffi::OsStr;
        use std::os::unix::ffi::OsStrExt;

        let path = Path::new(OsStr::from_bytes(b"/tmp/part-\xff"));
        let formatted = FilePathStyle::new(true, false).format(path);
        assert_eq!(
            formatted,
            "\x1b]8;;file:///tmp/part-%FF\x1b\\/tmp/part-�\x1b]8;;\x1b\\"
        );
    }

    #[test]
    fn redirected_path_keeps_color_policy_but_never_adds_a_hyperlink() {
        let plain = FilePathStyle::new(false, false).format(Path::new("output"));
        assert_eq!(plain, "output");

        let colorful = FilePathStyle::new(false, true).format(Path::new("output"));
        assert_eq!(colorful, "\x1b[4;36moutput\x1b[0m");
        assert!(!colorful.contains("\x1b]"));
    }

    #[test]
    fn windows_file_uri_supports_drive_unc_and_verbatim_paths() {
        assert_eq!(
            windows_file_uri(r"C:\Workspace\Jane Doe\part#1"),
            Some("file:///C:/Workspace/Jane%20Doe/part%231".to_owned())
        );
        assert_eq!(
            windows_file_uri(concat!(r"\\", "server", r"\shared files\part#1")),
            Some("file://server/shared%20files/part%231".to_owned())
        );
        assert_eq!(
            windows_file_uri(r"\\?\C:\Workspace\Jane Doe\part#1"),
            Some("file:///C:/Workspace/Jane%20Doe/part%231".to_owned())
        );
        assert_eq!(
            windows_file_uri(r"\\?\UNC\server\shared files\part#1"),
            Some("file://server/shared%20files/part%231".to_owned())
        );
        assert_eq!(
            windows_file_uri(r"\\?\unc\server\share\part"),
            Some("file://server/share/part".to_owned())
        );
    }

    #[test]
    fn windows_file_uri_rejects_relative_and_device_paths() {
        for path in [
            r"C:relative\part",
            r"\rooted\part",
            r"\\server",
            r"\\server\\part",
            concat!(r"\\", r".\C:\device\path"),
            r"\\?\Volume{01234567-89ab-cdef-0123-456789abcdef}\part",
        ] {
            assert_eq!(windows_file_uri(path), None, "{path}");
        }
    }
}

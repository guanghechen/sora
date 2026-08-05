/// An independently composable text effect.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum Effect {
    /// Increased text intensity.
    Bold,
    /// Decreased text intensity.
    Dim,
    /// Italic text.
    Italic,
    /// A line above the text.
    Overline,
    /// Swap foreground and background colors.
    Inverse,
    /// Conceal the text while retaining its layout width.
    Hidden,
    /// A line through the text.
    Strikethrough,
}

impl Effect {
    pub(crate) const fn slot(self) -> u8 {
        match self {
            Self::Bold => 0,
            Self::Dim => 1,
            Self::Italic => 2,
            Self::Overline => 3,
            Self::Inverse => 4,
            Self::Hidden => 5,
            Self::Strikethrough => 6,
        }
    }

    pub(crate) const fn codes(self) -> (&'static str, &'static str) {
        match self {
            Self::Bold => ("\x1b[1m", "\x1b[22m"),
            Self::Dim => ("\x1b[2m", "\x1b[22m"),
            Self::Italic => ("\x1b[3m", "\x1b[23m"),
            Self::Overline => ("\x1b[53m", "\x1b[55m"),
            Self::Inverse => ("\x1b[7m", "\x1b[27m"),
            Self::Hidden => ("\x1b[8m", "\x1b[28m"),
            Self::Strikethrough => ("\x1b[9m", "\x1b[29m"),
        }
    }
}

/// One mutually exclusive underline form.
#[derive(Clone, Copy, Debug, Eq, Hash, PartialEq)]
pub enum UnderlineStyle {
    /// A single straight underline.
    Single,
    /// A double straight underline.
    Double,
    /// A curly underline.
    Curly,
    /// A dotted underline.
    Dotted,
    /// A dashed underline.
    Dashed,
}

impl UnderlineStyle {
    pub(crate) const fn codes(self) -> (&'static str, &'static str) {
        let open = match self {
            Self::Single => "\x1b[4m",
            Self::Double => "\x1b[4:2m",
            Self::Curly => "\x1b[4:3m",
            Self::Dotted => "\x1b[4:4m",
            Self::Dashed => "\x1b[4:5m",
        };
        (open, "\x1b[24m")
    }
}

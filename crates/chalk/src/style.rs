use crate::{Color, Effect, UnderlineStyle};

pub(crate) const MAX_ATTRIBUTES: usize = 12;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum AttributeKind {
    Reset,
    Effect(Effect),
    Underline,
    Foreground,
    Background,
    UnderlineColor,
}

impl AttributeKind {
    const fn has_same_slot(self, other: Self) -> bool {
        match (self, other) {
            (Self::Reset, Self::Reset)
            | (Self::Underline, Self::Underline)
            | (Self::Foreground, Self::Foreground)
            | (Self::Background, Self::Background)
            | (Self::UnderlineColor, Self::UnderlineColor) => true,
            (Self::Effect(left), Self::Effect(right)) => left.slot() == right.slot(),
            _ => false,
        }
    }
}

/// Whether text exists when ANSI styling is disabled.
#[derive(Clone, Copy, Debug, Default, Eq, Hash, PartialEq)]
pub enum Visibility {
    /// Always render the text.
    #[default]
    Always,
    /// Render the text only when the color level is enabled.
    ColorEnabled,
}

/// A declarative terminal style independent of terminal capability.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Style {
    order: [AttributeKind; MAX_ATTRIBUTES],
    len: u8,
    underline: Option<UnderlineStyle>,
    foreground: Option<Color>,
    background: Option<Color>,
    underline_color: Option<Color>,
    visibility: Visibility,
}

impl Style {
    /// Construct a plain, always-visible style.
    #[must_use]
    pub const fn new() -> Self {
        Self {
            order: [AttributeKind::Reset; MAX_ATTRIBUTES],
            len: 0,
            underline: None,
            foreground: None,
            background: None,
            underline_color: None,
            visibility: Visibility::Always,
        }
    }

    /// Return this style with a full reset boundary enabled.
    #[must_use]
    pub const fn with_reset(mut self) -> Self {
        self.touch(AttributeKind::Reset);
        self
    }

    /// Return this style without a full reset boundary.
    #[must_use]
    pub const fn without_reset(mut self) -> Self {
        self.remove(AttributeKind::Reset);
        self
    }

    /// Return this style with `effect` enabled.
    #[must_use]
    pub const fn with_effect(mut self, effect: Effect) -> Self {
        self.touch(AttributeKind::Effect(effect));
        self
    }

    /// Return this style with `effect` disabled.
    #[must_use]
    pub const fn without_effect(mut self, effect: Effect) -> Self {
        self.remove(AttributeKind::Effect(effect));
        self
    }

    /// Return this style with the selected underline form.
    #[must_use]
    pub const fn with_underline(mut self, underline: UnderlineStyle) -> Self {
        self.underline = Some(underline);
        self.touch(AttributeKind::Underline);
        self
    }

    /// Return this style without an underline form.
    #[must_use]
    pub const fn without_underline(mut self) -> Self {
        self.underline = None;
        self.remove(AttributeKind::Underline);
        self
    }

    /// Return this style with the selected foreground color.
    #[must_use]
    pub const fn with_foreground(mut self, color: Color) -> Self {
        self.foreground = Some(color);
        self.touch(AttributeKind::Foreground);
        self
    }

    /// Return this style without a foreground color.
    #[must_use]
    pub const fn without_foreground(mut self) -> Self {
        self.foreground = None;
        self.remove(AttributeKind::Foreground);
        self
    }

    /// Return this style with the selected background color.
    #[must_use]
    pub const fn with_background(mut self, color: Color) -> Self {
        self.background = Some(color);
        self.touch(AttributeKind::Background);
        self
    }

    /// Return this style without a background color.
    #[must_use]
    pub const fn without_background(mut self) -> Self {
        self.background = None;
        self.remove(AttributeKind::Background);
        self
    }

    /// Return this style with the selected underline color.
    #[must_use]
    pub const fn with_underline_color(mut self, color: Color) -> Self {
        self.underline_color = Some(color);
        self.touch(AttributeKind::UnderlineColor);
        self
    }

    /// Return this style without an underline color.
    #[must_use]
    pub const fn without_underline_color(mut self) -> Self {
        self.underline_color = None;
        self.remove(AttributeKind::UnderlineColor);
        self
    }

    /// Return this style with the selected visibility policy.
    #[must_use]
    pub const fn with_visibility(mut self, visibility: Visibility) -> Self {
        self.visibility = visibility;
        self
    }

    pub(crate) const fn attribute(self, index: usize) -> Option<AttributeKind> {
        if index < self.len as usize {
            Some(self.order[index])
        } else {
            None
        }
    }

    pub(crate) const fn underline(self) -> Option<UnderlineStyle> {
        self.underline
    }

    pub(crate) const fn foreground(self) -> Option<Color> {
        self.foreground
    }

    pub(crate) const fn background(self) -> Option<Color> {
        self.background
    }

    pub(crate) const fn underline_color(self) -> Option<Color> {
        self.underline_color
    }

    pub(crate) const fn visibility(self) -> Visibility {
        self.visibility
    }

    pub(crate) const fn has_ansi_attributes(self) -> bool {
        self.len != 0
    }

    const fn touch(&mut self, attribute: AttributeKind) {
        self.remove(attribute);
        self.order[self.len as usize] = attribute;
        self.len += 1;
    }

    const fn remove(&mut self, attribute: AttributeKind) {
        let mut index = 0;
        while index < self.len as usize {
            if self.order[index].has_same_slot(attribute) {
                let mut next = index + 1;
                while next < self.len as usize {
                    self.order[next - 1] = self.order[next];
                    next += 1;
                }
                self.len -= 1;
                self.order[self.len as usize] = AttributeKind::Reset;
                return;
            }
            index += 1;
        }
    }
}

impl Default for Style {
    fn default() -> Self {
        Self::new()
    }
}

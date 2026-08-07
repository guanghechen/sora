#![doc = include_str!("../README.md")]

mod color;
mod effect;
mod renderer;
mod style;

pub use color::{AnsiColor, Color, ColorLevel, ParseHexColorError};
pub use effect::{Effect, UnderlineStyle};
pub use renderer::Renderer;
pub use style::{Style, Visibility};

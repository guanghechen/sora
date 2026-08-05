//! A deterministic, zero-dependency ANSI styling engine.
//!
//! Callers provide terminal capability explicitly. This crate does not inspect streams, environment
//! variables, or TTY state.

mod color;
mod effect;
mod renderer;
mod style;

pub use color::{AnsiColor, Color, ColorLevel, ParseHexColorError};
pub use effect::{Effect, UnderlineStyle};
pub use renderer::Renderer;
pub use style::{Style, Visibility};

# guanghechen-chalk

Deterministic, zero-dependency ANSI terminal styling primitives.

The caller selects terminal color capability explicitly. The crate does not inspect streams,
environment variables, or TTY state.

```rust
use guanghechen_chalk::{AnsiColor, ColorLevel, Effect, Renderer, Style};

let renderer = Renderer::new(ColorLevel::Ansi16);
let style = Style::new()
    .with_effect(Effect::Bold)
    .with_foreground(AnsiColor::Green.into());

assert_eq!(
    renderer.paint(style, "ready"),
    "\u{1b}[1m\u{1b}[32mready\u{1b}[39m\u{1b}[22m"
);
```

## License

[MIT](https://github.com/guanghechen/sora/blob/rust/LICENSE)

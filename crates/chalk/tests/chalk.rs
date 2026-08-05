use guanghechen_chalk::{
    AnsiColor, Color, ColorLevel, Effect, Renderer, Style, UnderlineStyle, Visibility,
};

const ANSI16: Renderer = Renderer::new(ColorLevel::Ansi16);
const ANSI256: Renderer = Renderer::new(ColorLevel::Ansi256);
const TRUE_COLOR: Renderer = Renderer::new(ColorLevel::TrueColor);

#[test]
fn renders_every_independent_effect_with_its_paired_close() {
    for (effect, open, close) in [
        (Effect::Bold, "\x1b[1m", "\x1b[22m"),
        (Effect::Dim, "\x1b[2m", "\x1b[22m"),
        (Effect::Italic, "\x1b[3m", "\x1b[23m"),
        (Effect::Overline, "\x1b[53m", "\x1b[55m"),
        (Effect::Inverse, "\x1b[7m", "\x1b[27m"),
        (Effect::Hidden, "\x1b[8m", "\x1b[28m"),
        (Effect::Strikethrough, "\x1b[9m", "\x1b[29m"),
    ] {
        assert_eq!(
            ANSI16.paint(Style::new().with_effect(effect), "text"),
            format!("{open}text{close}")
        );
    }
}

#[test]
fn renders_every_mutually_exclusive_underline_style() {
    for (underline, open) in [
        (UnderlineStyle::Single, "\x1b[4m"),
        (UnderlineStyle::Double, "\x1b[4:2m"),
        (UnderlineStyle::Curly, "\x1b[4:3m"),
        (UnderlineStyle::Dotted, "\x1b[4:4m"),
        (UnderlineStyle::Dashed, "\x1b[4:5m"),
    ] {
        assert_eq!(
            ANSI16.paint(Style::new().with_underline(underline), "text"),
            format!("{open}text\x1b[24m")
        );
    }
}

#[test]
fn renders_the_complete_named_palette_in_every_color_domain() {
    for (color, code, palette_index) in [
        (AnsiColor::Black, 30, 0),
        (AnsiColor::Red, 31, 1),
        (AnsiColor::Green, 32, 2),
        (AnsiColor::Yellow, 33, 3),
        (AnsiColor::Blue, 34, 4),
        (AnsiColor::Magenta, 35, 5),
        (AnsiColor::Cyan, 36, 6),
        (AnsiColor::White, 37, 7),
        (AnsiColor::BrightBlack, 90, 8),
        (AnsiColor::BrightRed, 91, 9),
        (AnsiColor::BrightGreen, 92, 10),
        (AnsiColor::BrightYellow, 93, 11),
        (AnsiColor::BrightBlue, 94, 12),
        (AnsiColor::BrightMagenta, 95, 13),
        (AnsiColor::BrightCyan, 96, 14),
        (AnsiColor::BrightWhite, 97, 15),
    ] {
        let color = Color::Ansi(color);
        assert_eq!(
            ANSI16.paint(Style::new().with_foreground(color), "x"),
            format!("\x1b[{code}mx\x1b[39m")
        );
        assert_eq!(
            ANSI16.paint(Style::new().with_background(color), "x"),
            format!("\x1b[{}mx\x1b[49m", code + 10)
        );
        assert_eq!(
            ANSI16.paint(Style::new().with_underline_color(color), "x"),
            format!("\x1b[58;5;{palette_index}mx\x1b[59m")
        );
    }
}

#[test]
fn renders_ansi256_and_truecolor_in_every_color_domain() {
    let indexed = Color::ansi256(201);
    assert_eq!(
        ANSI256.paint(Style::new().with_foreground(indexed), "x"),
        "\x1b[38;5;201mx\x1b[39m"
    );
    assert_eq!(
        ANSI256.paint(Style::new().with_background(indexed), "x"),
        "\x1b[48;5;201mx\x1b[49m"
    );
    assert_eq!(
        ANSI256.paint(Style::new().with_underline_color(indexed), "x"),
        "\x1b[58;5;201mx\x1b[59m"
    );

    let rgb = Color::rgb(222, 173, 237);
    assert_eq!(
        TRUE_COLOR.paint(Style::new().with_foreground(rgb), "x"),
        "\x1b[38;2;222;173;237mx\x1b[39m"
    );
    assert_eq!(
        TRUE_COLOR.paint(Style::new().with_background(rgb), "x"),
        "\x1b[48;2;222;173;237mx\x1b[49m"
    );
    assert_eq!(
        TRUE_COLOR.paint(Style::new().with_underline_color(rgb), "x"),
        "\x1b[58;2;222;173;237mx\x1b[59m"
    );
}

#[test]
fn parses_strict_short_and_long_hex_colors() {
    assert_eq!(Color::from_hex("#abc"), Ok(Color::rgb(170, 187, 204)));
    assert_eq!(Color::from_hex("#DeAdEd"), Ok(Color::rgb(222, 173, 237)));
    assert_eq!(
        TRUE_COLOR.paint(
            Style::new().with_foreground(Color::from_hex("#DEADED").unwrap()),
            "x"
        ),
        "\x1b[38;2;222;173;237mx\x1b[39m"
    );
}

#[test]
fn rejects_malformed_and_alpha_bearing_hex_colors() {
    for input in [
        "",
        "abc",
        "#ab",
        "#abcd",
        "#12345678",
        "#ggg",
        " #fff",
        "#fff\n",
        "0xffffff",
    ] {
        let error = Color::from_hex(input).unwrap_err();
        assert_eq!(
            error.to_string(),
            "expected a hexadecimal color in #RGB or #RRGGBB form"
        );
    }
}

#[test]
fn downgrades_indexed_and_rgb_colors_for_the_selected_level() {
    let indexed_red = Style::new().with_foreground(Color::ansi256(196));
    assert_eq!(ANSI16.paint(indexed_red, "red"), "\x1b[91mred\x1b[39m");
    assert_eq!(
        TRUE_COLOR.paint(indexed_red, "red"),
        "\x1b[38;5;196mred\x1b[39m"
    );

    let orange = Style::new().with_foreground(Color::rgb(255, 136, 0));
    assert_eq!(ANSI16.paint(orange, "x"), "\x1b[93mx\x1b[39m");
    assert_eq!(ANSI256.paint(orange, "x"), "\x1b[38;5;214mx\x1b[39m");
    assert_eq!(
        TRUE_COLOR.paint(orange, "x"),
        "\x1b[38;2;255;136;0mx\x1b[39m"
    );

    for (channel, index) in [(0, 16), (128, 244), (255, 231)] {
        assert_eq!(
            ANSI256.paint(
                Style::new().with_foreground(Color::rgb(channel, channel, channel)),
                "x"
            ),
            format!("\x1b[38;5;{index}mx\x1b[39m")
        );
    }
}

#[test]
fn style_state_is_idempotent_replaceable_and_removable() {
    let style = Style::new()
        .with_effect(Effect::Bold)
        .with_effect(Effect::Bold)
        .without_effect(Effect::Bold)
        .with_underline(UnderlineStyle::Single)
        .with_underline(UnderlineStyle::Curly)
        .with_foreground(AnsiColor::Red.into())
        .with_foreground(AnsiColor::Green.into())
        .with_background(AnsiColor::Blue.into())
        .with_background(AnsiColor::Yellow.into())
        .with_underline_color(AnsiColor::Cyan.into())
        .with_underline_color(AnsiColor::Magenta.into());
    assert_eq!(
        ANSI16.paint(style, "x"),
        "\x1b[4:3m\x1b[32m\x1b[43m\x1b[58;5;5mx\x1b[59m\x1b[49m\x1b[39m\x1b[24m"
    );

    let plain = style
        .without_underline()
        .without_foreground()
        .without_background()
        .without_underline_color();
    assert_eq!(ANSI16.paint(plain, "x"), "x");
}

#[test]
fn preserves_effect_order_and_moves_reapplied_effects() {
    let bold_then_dim = Style::new()
        .with_effect(Effect::Bold)
        .with_effect(Effect::Dim);
    let dim_then_bold = Style::new()
        .with_effect(Effect::Dim)
        .with_effect(Effect::Bold);
    assert_eq!(
        ANSI16.paint(bold_then_dim, "x"),
        "\x1b[1m\x1b[2mx\x1b[22m\x1b[22m"
    );
    assert_eq!(
        ANSI16.paint(dim_then_bold, "x"),
        "\x1b[2m\x1b[1mx\x1b[22m\x1b[22m"
    );

    let reapplied = bold_then_dim.with_effect(Effect::Bold);
    assert_eq!(
        ANSI16.paint(reapplied, "x"),
        ANSI16.paint(dim_then_bold, "x")
    );
}

#[test]
fn preserves_application_order_across_attribute_categories() {
    let colors_then_underline = Style::new()
        .with_foreground(AnsiColor::Red.into())
        .with_background(AnsiColor::Blue.into())
        .with_underline(UnderlineStyle::Curly);
    assert_eq!(
        ANSI16.paint(colors_then_underline, "x"),
        "\x1b[31m\x1b[44m\x1b[4:3mx\x1b[24m\x1b[49m\x1b[39m"
    );

    let underline_then_colors = Style::new()
        .with_underline(UnderlineStyle::Curly)
        .with_foreground(AnsiColor::Red.into())
        .with_background(AnsiColor::Blue.into());
    assert_eq!(
        ANSI16.paint(underline_then_colors, "x"),
        "\x1b[4:3m\x1b[31m\x1b[44mx\x1b[49m\x1b[39m\x1b[24m"
    );
}

#[test]
fn moves_a_replaced_single_value_property_to_its_latest_position() {
    let style = Style::new()
        .with_foreground(AnsiColor::Red.into())
        .with_underline(UnderlineStyle::Single)
        .with_foreground(AnsiColor::Green.into());
    assert_eq!(ANSI16.paint(style, "x"), "\x1b[4m\x1b[32mx\x1b[39m\x1b[24m");
}

#[test]
fn removing_an_attribute_preserves_the_remaining_order() {
    let style = Style::new()
        .with_effect(Effect::Bold)
        .with_foreground(AnsiColor::Red.into())
        .with_underline(UnderlineStyle::Single)
        .without_foreground();
    assert_eq!(ANSI16.paint(style, "x"), "\x1b[1m\x1b[4mx\x1b[24m\x1b[22m");
}

#[test]
fn fixed_capacity_holds_every_supported_attribute() {
    const STYLE: Style = Style::new()
        .with_reset()
        .with_effect(Effect::Bold)
        .with_effect(Effect::Dim)
        .with_effect(Effect::Italic)
        .with_effect(Effect::Overline)
        .with_effect(Effect::Inverse)
        .with_effect(Effect::Hidden)
        .with_effect(Effect::Strikethrough)
        .with_underline(UnderlineStyle::Dashed)
        .with_foreground(Color::Ansi(AnsiColor::Red))
        .with_background(Color::Ansi(AnsiColor::Blue))
        .with_underline_color(Color::Ansi(AnsiColor::Cyan));

    assert_eq!(
        ANSI16.paint(STYLE, "x"),
        concat!(
            "\x1b[0m\x1b[1m\x1b[2m\x1b[3m\x1b[53m\x1b[7m",
            "\x1b[8m\x1b[9m\x1b[4:5m\x1b[31m\x1b[44m\x1b[58;5;6m",
            "x",
            "\x1b[59m\x1b[49m\x1b[39m\x1b[24m\x1b[29m\x1b[28m",
            "\x1b[27m\x1b[55m\x1b[23m\x1b[22m\x1b[22m\x1b[0m"
        )
    );
}

#[test]
fn restores_an_outer_style_after_nested_same_property_output() {
    let inner = ANSI16.paint(Style::new().with_foreground(AnsiColor::Red.into()), "B");
    let text = format!("A{inner}C");
    assert_eq!(
        ANSI16.paint(Style::new().with_foreground(AnsiColor::Green.into()), &text),
        "\x1b[32mA\x1b[31mB\x1b[39m\x1b[32mC\x1b[39m"
    );
}

#[test]
fn preserves_nested_different_properties_without_blanket_resets() {
    let inner = ANSI16.paint(Style::new().with_underline(UnderlineStyle::Single), "B");
    let text = format!("A{inner}C");
    assert_eq!(
        ANSI16.paint(Style::new().with_foreground(AnsiColor::Green.into()), &text),
        "\x1b[32mA\x1b[4mB\x1b[24mC\x1b[39m"
    );
}

#[test]
fn reopens_every_effect_that_shares_a_nested_close_code() {
    let inner = ANSI16.paint(Style::new().with_effect(Effect::Bold), "B");
    let text = format!("A{inner}C");
    let outer = Style::new()
        .with_effect(Effect::Bold)
        .with_effect(Effect::Dim);
    assert_eq!(
        ANSI16.paint(outer, &text),
        "\x1b[1m\x1b[2mA\x1b[1mB\x1b[22m\x1b[1m\x1b[2mC\x1b[22m\x1b[22m"
    );
}

#[test]
fn an_embedded_full_reset_terminates_the_surrounding_style() {
    let style = Style::new()
        .with_effect(Effect::Bold)
        .with_foreground(AnsiColor::Cyan.into());
    assert_eq!(
        ANSI16.paint(style, "A\x1b[0mB"),
        "\x1b[1m\x1b[36mA\x1b[0mB\x1b[39m\x1b[22m"
    );
}

#[test]
fn reset_is_a_full_boundary_and_later_styling_is_explicit() {
    let green = Style::new().with_foreground(AnsiColor::Green.into());
    let reset = Style::new().with_reset();
    let reset_text = ANSI16.paint(reset, "B");
    assert_eq!(reset_text, "\x1b[0mB\x1b[0m");
    assert_eq!(
        ANSI16.paint(green, &format!("A{reset_text}C")),
        "\x1b[32mA\x1b[0mB\x1b[0mC\x1b[39m"
    );
    assert_eq!(
        format!(
            "{}{}{}",
            ANSI16.paint(green, "A"),
            reset_text,
            ANSI16.paint(green, "C")
        ),
        "\x1b[32mA\x1b[39m\x1b[0mB\x1b[0m\x1b[32mC\x1b[39m"
    );
    assert_eq!(
        ANSI16.paint(reset.with_effect(Effect::Bold), "B"),
        "\x1b[0m\x1b[1mB\x1b[22m\x1b[0m"
    );
    assert_eq!(ANSI16.paint(reset.without_reset(), "B"), "B");
}

#[test]
fn reset_order_changes_the_effective_terminal_state() {
    let bold_then_reset = Style::new().with_effect(Effect::Bold).with_reset();
    assert_eq!(
        ANSI16.paint(bold_then_reset, "x"),
        "\x1b[1m\x1b[0mx\x1b[0m\x1b[22m"
    );

    let reset_then_bold = Style::new().with_reset().with_effect(Effect::Bold);
    assert_eq!(
        ANSI16.paint(reset_then_bold, "x"),
        "\x1b[0m\x1b[1mx\x1b[22m\x1b[0m"
    );

    let reapplied_bold = bold_then_reset.with_effect(Effect::Bold);
    assert_eq!(
        ANSI16.paint(reapplied_bold, "x"),
        ANSI16.paint(reset_then_bold, "x")
    );
}

#[test]
fn does_not_reopen_an_attribute_shadowed_by_reset() {
    let style = Style::new().with_effect(Effect::Bold).with_reset();
    assert_eq!(
        ANSI16.paint(style, "A\x1b[22mB"),
        "\x1b[1m\x1b[0mA\x1b[22mB\x1b[0m\x1b[22m"
    );
}

#[test]
fn closes_and_reopens_styles_around_lf_and_crlf() {
    let style = Style::new()
        .with_effect(Effect::Bold)
        .with_foreground(AnsiColor::Cyan.into());
    assert_eq!(
        ANSI16.paint(style, "A\r\nB\nC"),
        concat!(
            "\x1b[1m\x1b[36mA\x1b[39m\x1b[22m\r\n",
            "\x1b[1m\x1b[36mB\x1b[39m\x1b[22m\n",
            "\x1b[1m\x1b[36mC\x1b[39m\x1b[22m"
        )
    );
}

#[test]
fn applies_plain_visible_and_empty_text_contracts() {
    let disabled = Renderer::new(ColorLevel::None);
    let styled = Style::new()
        .with_effect(Effect::Bold)
        .with_foreground(AnsiColor::Red.into());
    assert_eq!(disabled.level(), ColorLevel::None);
    assert_eq!(disabled.paint(styled, "text"), "text");
    assert_eq!(
        disabled.paint(styled.with_visibility(Visibility::ColorEnabled), "cosmetic"),
        ""
    );
    assert_eq!(
        ANSI16.paint(
            Style::new().with_visibility(Visibility::ColorEnabled),
            "cosmetic"
        ),
        "cosmetic"
    );
    assert_eq!(ANSI16.paint(Style::default(), "plain"), "plain");
    assert_eq!(ANSI16.paint(styled, ""), "");
}

#[test]
fn leaves_unrelated_embedded_ansi_content_opaque() {
    assert_eq!(
        ANSI16.paint(
            Style::new().with_underline(UnderlineStyle::Single),
            "before\x1b[31mafter"
        ),
        "\x1b[4mbefore\x1b[31mafter\x1b[24m"
    );
}

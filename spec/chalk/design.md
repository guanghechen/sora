# Chalk Design

## Scope

`guanghechen-chalk` is a zero-dependency, deterministic ANSI styling engine. It turns explicit
style, capability, and text inputs into an owned string. It does not read process state, inspect a
TTY, interpret `NO_COLOR` or `FORCE_COLOR`, select a stream, or write output. Those policies remain
with Commander, Reporter, or another caller.

The crate does not strip arbitrary ANSI sequences, compute terminal display width, parse CSS color
names, provide logging semantics, or depend on Commander or Reporter. RGB is the canonical Truecolor
representation. Hexadecimal input is a strict boundary convenience and does not add another stored
color model.

## Modules and Dependency Direction

- `color` owns capability levels, named colors, exact color values, and deterministic downgrade
  rules;
- `effect` owns independent effects and the mutually exclusive underline style;
- `style` owns the ordered style value and its invariants;
- `renderer` consumes the other modules and owns ANSI encoding, nesting repair, and line handling.

Dependencies flow from `renderer` to `style`, `color`, and `effect`; `style` depends only on `color`
and `effect`. Leaf modules never depend on the renderer.

## Capability and Color

`ColorLevel` is explicit:

- `None` emits no ANSI styling;
- `Ansi16` emits the named 16-color palette;
- `Ansi256` additionally emits the xterm-compatible 256-color palette;
- `TrueColor` additionally emits 24-bit RGB colors.

`Color` accepts a named `AnsiColor`, an `Ansi256(u8)` index, or `Rgb { red, green, blue }`. Named
colors retain their ANSI 16-color sequence at every enabled level. At `Ansi16`, indexed and RGB
colors are deterministically reduced to the closest ANSI color using the same cube and grayscale
mapping as Chalk's ANSI styling implementation. At `Ansi256`, RGB is reduced to the xterm palette.
At `TrueColor`, RGB is emitted as-is while an explicit `Ansi256` choice remains indexed.

`Color::from_hex` accepts exactly `#RGB` or `#RRGGBB`, with case-insensitive ASCII hexadecimal
digits, and returns the equivalent RGB color. Missing `#`, whitespace, other lengths, invalid digits,
and alpha-bearing `#RGBA` or `#RRGGBBAA` input return `ParseHexColorError`. ANSI text colors have no
alpha channel, and the renderer never guesses a terminal background for compositing.

The same color model applies independently to foreground, background, and underline color. Their
paired close codes are SGR 39, 49, and 59. Because underline color has no ANSI 16-color form, named
and downgraded underline colors use indices 0 through 15 with SGR 58.

## Effects and Style State

`Effect` contains independent toggles: bold, dim, italic, overline, inverse, hidden, and
strikethrough. Bold and dim may coexist even though both use SGR 22 as their close code.

Reset is not an independent effect. It is a full state boundary controlled by `with_reset` and
`without_reset`, and its position relative to other attributes is significant. An attribute applied
after reset affects the text; an attribute applied before the last reset does not. Closing sequences
are emitted in reverse application order, so reset also terminates attributes opened after it.
Attributes before reset remain represented to preserve the requested operation order, but are
shadowed when determining which attributes are active inside the text.

Underline forms are mutually exclusive and therefore use `UnderlineStyle`: single, double, curly,
dotted, or dashed. Selecting one replaces the previous underline style. Foreground, background, and
underline color are also independent single-value properties; setting a property replaces only its
previous value.

`Style` retains the application order of its selected attributes. Applying an existing effect or
replacing a single-value property moves that attribute to the latest position. This preserves
meaningful ordering such as `bold` then `reset`, while discarding overwritten ANSI operations such as
intermediate foreground colors. Removing an attribute preserves the relative order of everything
else. The representation has fixed capacity for reset, seven effects, underline, foreground,
background, and underline color; construction performs no allocation.

`Visibility::Always` renders text even when styling is disabled. `Visibility::ColorEnabled` renders
the text only when `ColorLevel` is not `None`, matching Chalk's cosmetic `visible` behavior.

`Style` is an immutable builder-style value. Paired `with_*` and `without_*` operations make ordered
application, replacement, and removal explicit. `Style::new` and `Style::default` are plain and
always visible.

## Rendering Contract

`Renderer` owns exactly one `ColorLevel`. `Renderer::paint(style, text)` is total and has no shared
state or side effects.

At `ColorLevel::None`, an always-visible style returns the input unchanged and a color-enabled-only
style returns an empty string. Empty input always returns an empty string without control bytes. If
an enabled style resolves to no ANSI attributes, painting returns the input unchanged.

For styled text, the renderer:

1. emits retained open sequences in their `Style` application order;
2. preserves the input bytes except for the repairs below;
3. emits property-specific close sequences in reverse order instead of a blanket SGR reset.

If input contains a close sequence for an active property, the renderer immediately reopens every
active attribute sharing that close code. Only reset and attributes after it are active when reset
is present; otherwise every selected attribute is active. This makes independently painted strings
nest correctly, including bold and dim sharing SGR 22. A full SGR reset is repaired only when reset
itself is active; otherwise it intentionally terminates the surrounding style, matching Chalk's
reset boundary. A caller that needs styling after a reset must explicitly paint that later segment.
Other ANSI content remains opaque.

Before each LF or CRLF, the renderer closes and reopens all retained attributes in paired order.
This prevents terminal line-boundary bleed while preserving the original line ending and requested
operation order.

## Failure Strategy and Open Questions

Constructed color and style values are structurally valid: palette indices and RGB components are
`u8`, and enums constrain capability and style states. `Color::from_hex` validates its external
string boundary and returns `ParseHexColorError` without producing a color when validation fails.
Rendering itself cannot fail and performs no fallback outside the documented color downgrade rules.

There are no blocking open design questions. Terminal detection and higher-level color parsing are
explicit non-goals until a real caller requires their contracts.

## Verification

Tests cover every effect and named color; strict Hex parsing and rejection; all foreground,
background, and underline color domains; capability disablement and downgrade boundaries; ordered,
replaceable, and removable state; order-sensitive reset and intensity combinations; nested same and
different properties; shared close codes; reset boundaries and explicit repainting; LF and CRLF
repair; plain, visible-only, empty, and opaque text; and deterministic rendering.

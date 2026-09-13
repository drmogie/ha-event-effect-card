# HA Event Effect Card

A dependency-free custom Home Assistant Lovelace card that plays any of
**15 full-screen effects** — streamers, fireworks, confetti bursts,
balloons, hearts, bubbles, sparkles, configurable emoji rain, a color
spotlight sweep, falling leaves, wind-blown leaves, rain, snow, hail, and
lightning — over your whole dashboard whenever chosen calendar events, a
switch, or the weather triggers it.

## v0.10.1 — windy leaves now fall while they blow

The Windy effect's leaves previously traveled purely horizontally (with
just a side-to-side flutter, no net downward movement) — separate from
Falling Leaves, which only falls straight down. Real wind-blown leaves
still fall due to gravity, though, so Windy now moves leaves diagonally:
blowing left-to-right *and* drifting downward together, layered under
the same flutter wobble. `windy` and `leaves` remain independent effects
(you can still combine both on one rule if you want an even busier
scene), but `windy` alone now looks like leaves being blown across and
down, rather than floating sideways.

## v0.10.0 — windy effect

Added **Windy 🍃** — leaves blown horizontally left-to-right, with a
vertical "flutter" wobble and a rotation that flips back and forth like
paper caught in a gust rather than a steady spin, plus a few faint
fast-dashing streak lines layered behind them to sell the sense of a
gust passing through. (See v0.10.1 right above — the initial version had
no downward fall; that was fixed shortly after.) Same lightweight
CSS-animation approach as everything else.

Like `hail`, `windy` is both a weather **trigger** condition
(`weather_conditions: [windy]`) and now also an **effect** name — they're
independent fields, so you can combine them: a rule with
`trigger_type: weather`, `weather_conditions: [windy]`, and
`effects: [windy]` plays the windy visual specifically when the weather
entity reports windy conditions.

Placed right after Falling Leaves in the Effects list (thematically
related, and still ahead of Rain/Snow/Hail/Lightning).

## v0.9.0 — seven new effects: confetti burst, balloons, hearts, bubbles, sparkles, emoji rain, spotlight

Added a batch of new effects, all built the same lightweight way as the
existing ones (pure CSS keyframe animation, no per-frame JS):

- **Confetti Burst 🎊** — colorful pieces burst upward from the bottom of
  the screen, then fall back down and off — a "cannon" burst rather than
  a continuous rain, like Streamers.
- **Balloons 🎈**, **Hearts 💕**, **Bubbles 🫧** — rise from the bottom
  of the screen up and off the top, each with its own drift/sway and
  timing. Bubbles get a little "pop" (quick scale-up + fade) near the
  top instead of just fading out.
- **Sparkles ✨** — small twinkling points scattered anywhere on screen,
  each with its own randomized pulse timing so they don't blink in
  unison. Unlike the other effects, these don't fall or rise — they just
  twinkle in place.
- **Emoji Rain** — a configurable version of the falling-particle
  pattern: pick your own set of emoji per rule (e.g. 🎂 🎓 🥳), and each
  falling glyph is chosen at random from that list, so multiple emoji
  fall mixed together rather than uniformly. Leave it blank to use a
  built-in default set (🎉 ✨ 🎊 ⭐). The glyphs field only appears in the
  editor once you check the Emoji Rain box.
- **Spotlight** — a soft, hue-cycling colored glow that sweeps across the
  screen. More ambient/subtle than the other effects — good for a gentle
  "something happened" cue rather than a full celebration.

Also added **Falling Leaves 🍂** (tumbling fall with more pronounced sway
than Snow), and reordered the Effects checkboxes to **Streamers,
Fireworks, Confetti Burst, Balloons, Hearts, Bubbles, Sparkles, Emoji
Rain, Spotlight, Falling Leaves, Rain, Snow, Hail, Lightning** — the two
most commonly used "celebration" picks first, then the new effects, with
Falling Leaves last right before the weather-flavored group (Rain, Snow,
Hail, Lightning).

Every new falling/rising effect was checked against the same class of
bug fixed in v0.8.1 (an effect visibly stopping short of clearing the
screen) before shipping.

## v0.8.1 — fix: hail stopped short of the bottom of the screen

The bounce keyframe's Y positions (87-94vh) never actually reached the
bottom of the viewport, so hail visibly stopped mid-screen and faded out
instead of falling all the way down. Fixed: the fall now reaches 100vh
(and the bounce touches ground again at 100vh a second time) before
continuing off-screen to 112vh while fading — matching how rain, snow,
and streamers all travel past 100vh so they clear the screen rather than
fading in place.

Also reordered the Effects checkboxes on each rule to **Streamers,
Fireworks, Rain, Snow, Hail, Lightning** — streamers and fireworks first
since they're the most commonly used "celebration" picks, then the
weather-flavored effects grouped together after.

## v0.8.0 — hail effect

Added a sixth effect: **hail 🧊** — small icy pellets falling faster than
rain, with a bit of rotation and a couple of small upward "bounce" steps
right near the ground before fading out (no real physics, just a
keyframe shaped to read as a bounce). Same lightweight CSS-animation
approach as the other particle effects — no added per-frame JS cost.

Note: this is a new visual **effect** (`rain`/`snow`/`hail`/etc. — what
plays on screen), separate from the existing weather **trigger**
condition of the same name (`weather_conditions: [hail]` — what makes a
rule fire). You can use them independently, or combine them: a rule with
`trigger_type: weather`, `weather_conditions: [hail]`, and
`effects: [hail]` will play the hail visual specifically when the
weather entity reports hail.

## v0.7.0 — collapsible rules

Each rule can now be collapsed/expanded by clicking its title bar. To
keep a long rule list manageable: rules that already existed when you
open the editor start **collapsed** (showing just a one-line summary —
trigger type and effects), while a rule you just added with "+ Add rule"
starts **expanded** so you can fill it in right away. Collapse state is
UI-only — it's never written into the saved card config.

## v0.6.1 — better-looking lightning bolts

The bolts used a plain "⚡" character, which on most platforms/fonts
renders as a thick, flat yellow flash icon — notably close to the old
Winamp logo, and pretty clip-art-y. Replaced it with a procedurally
generated SVG streak: a thin, randomly jagged path from top to bottom
(different every time it fires), occasionally forked partway down like a
real strike splitting, with a soft blurred glow behind a crisp white
core line. Still pure CSS-driven timing (no extra per-frame JS) — only
the bolt's shape changed.

## v0.6.0 — lightning effect

Added a fifth effect: **lightning ⚡** — a couple of full-screen ambient
sky flashes plus a handful of bolt glyphs near the top of the screen,
each on its own randomized, desynced flicker cycle so they don't strobe
in unison. Same pattern as snow/rain/streamers: pure CSS keyframe
animation, no per-frame JS, so it's essentially free performance-wise.
Pick it from the Effects checkboxes on any rule, same as the others.

## v0.5.1 — fix: all three trigger sections were showing at once

The `.trigger-section { display: flex; ... }` styling rule (added for the
box/border look) was silently overriding the `hidden` attribute JS uses
to show only the selected trigger type. This is a well-known CSS gotcha:
an author stylesheet's `display` value for an element always wins over
the browser's built-in `[hidden] { display: none }` default, regardless
of selector specificity — so all three sections stayed visible no matter
which trigger type was selected. Fixed with an explicit
`.trigger-section[hidden] { display: none; }` override, which has higher
specificity than the bare `.trigger-section` rule and correctly wins.

## v0.5.0 — exclusive trigger type per rule, reordered editor

- Each rule now picks **exactly one** trigger type — Calendar, Weather, or
  Switch — via a dropdown, instead of the three trigger sections all being
  live/OR'd together. The editor shows only the fields for the chosen
  type; the other two are hidden (their values are kept in the saved
  config if you had any, so switching back and forth doesn't lose your
  settings, but they're inert while not selected).
- The **Effects** picker now appears near the top of each rule, above the
  trigger configuration, so you set what should happen before configuring
  when it happens.
- Trigger type options (and their sections) are ordered **Calendar →
  Weather → Switch**.
- Rules saved by earlier versions (which had no `trigger_type` field) are
  handled automatically: if the rule has calendars, it's treated as a
  calendar rule; else if it has switch entities, a switch rule; else if it
  has a weather entity, a weather rule; otherwise it defaults to calendar.
  No manual migration needed.

## v0.4.0 — switch and weather triggers

Rules can now trigger on more than just calendars. Each rule may combine
any mix of three trigger types — the rule fires if **any one** of its
configured triggers currently matches (leave a trigger's fields empty to
skip it for that rule):

- **Calendar** (unchanged from before): matching events on chosen
  calendars.
- **Switch**: fires while any of the chosen `switch` / `input_boolean` /
  `binary_sensor` entities is in a given state (default `"on"`). Handy for
  a manual "trigger fireworks now" switch, or wiring the effect to an
  existing automation/scene via a helper.
- **Weather**: fires based on a `weather.` entity's current condition
  (e.g. `snowy`, `pouring`, `sunny`), a numeric attribute threshold (e.g.
  `temperature < 32`), or both together (both must be true at once). Lets
  you trigger snow effects automatically when it's actually snowing
  outside, for example.

Existing calendar-only rules from earlier versions keep working exactly
as before — the new fields just add more optional trigger types per rule.

## v0.3.0 — FPS improvements

The snow/rain/streamer particles were already cheap (pure CSS `transform`/
`opacity` animation on the compositor thread — no per-frame JS at all), so
the fireworks canvas loop was the actual bottleneck. Changes:

- **Removed a per-frame array allocation.** The old code did
  `this._fireworkParticles = this._fireworkParticles.filter(...)` on
  *every animation frame* to drop dead sparks — `.filter()` allocates a
  brand-new array and copies every survivor into it, 60 times a second.
  Under a busy burst (hundreds of live sparks) that's real, constant
  garbage-collection pressure, which shows up as stutter. Replaced with an
  in-place swap-compaction (`particles[alive++] = particle; ...
  particles.length = alive`) — zero allocations per frame.
- **Cheaper per-particle drawing.** Sparks were drawn with
  `beginPath()` + `arc()` + `fill()`, where `arc()` does curve-approximation
  math per call. Switched to `fillRect()` for a small square — visually
  indistinguishable at these particle sizes, but meaningfully less CPU per
  particle, especially with many sparks on screen.
- **Lower default canvas resolution.** The canvas was rendered at up to
  full native `devicePixelRatio` (2x on many displays — a ~7680×4320
  canvas on a 4K panel at dpr 2). Default cap lowered to 1.5x; every
  `clearRect`/`fillRect` scales with canvas pixel count, so this is a
  direct, proportional win.
- **Hard cap on total live sparks** (500, or 300 in performance mode) so a
  slow device that can't keep up with normal decay never spirals into an
  ever-growing per-frame draw cost.
- **New `performance_mode` option** (checkbox in the editor, or
  `performance_mode: true` in YAML) for weaker hardware — Raspberry
  Pi-class wall tablets are common for HA dashboards. It caps the canvas
  to native resolution (dpr 1), cuts all particle/spark counts by ~40%,
  and slows the firework launch rate to match.
- `globalCompositeOperation` was being reset to `"lighter"` on every
  single frame even though it never changes while fireworks are running;
  it's now set once when the effect starts instead.

None of this changes visuals in any effect other than fireworks, and
fireworks itself should look essentially the same — just smoother, especially
during large bursts or on constrained hardware.

## v0.2.0 — fixes vs the previous build

If you installed an earlier copy and effects weren't playing (card showed
up fine, but nothing animated), this version fixes it:

- **Particle styling bug:** particles were styled with
  `el.style.setProperty("fontSize", ...)` (and similarly for
  `animationDuration`, `animationDelay`, `left`, `opacity`, etc.).
  `setProperty()` only accepts real, kebab-case CSS property names
  (`font-size`, not `fontSize`) — passing camelCase is silently ignored.
  With `animation-duration` left at its default of `0s`, every snow/rain/
  streamer particle was created but never actually animated; it just
  appeared in its near-invisible starting keyframe and sat there. Fixed by
  assigning standard properties directly (`el.style[key] = value`, which
  the browser does map correctly from camelCase) and reserving
  `setProperty()` for the one real custom property, `--drift`.
- **Overlay containment risk:** the effects layer was `position: fixed`
  *inside the card's own Shadow DOM*. Home Assistant's grid/sections
  dashboards sometimes apply CSS containment or transforms to ancestor
  card wrappers, which can silently turn `position: fixed` into "fixed
  relative to that ancestor" instead of the real viewport — clipping or
  hiding the effect. Fixed by porting the overlay (particle layer +
  fireworks canvas) out to `document.body` on connect, and removing it on
  disconnect, so it always paints relative to the true viewport no matter
  how the dashboard wraps the card.
- Fireworks (canvas-based, unaffected by the styling bug) should have
  already worked in v0.1.0; it's unchanged in logic, just now also
  benefits from the more reliable body-level overlay.

## Features

- One or more **rules**, each with exactly **one** trigger type — pick
  **calendar**, **weather**, or **switch/input_boolean/binary_sensor** per
  rule from a dropdown; only that trigger's fields are shown/active. Want
  an effect to respond to more than one kind of trigger? Add another rule
  with the same effects and a different trigger type.
- Per-rule **match type**: contains / exact / regular expression / any
  event — matched against the event **title, description, location, or
  all three**.
- Per-rule **effect selection** — a single rule can trigger more than one
  effect at once (e.g. snow + fireworks together).
- **Multiple rules can be active simultaneously**; toggle
  `allow_multiple_effects` to cap it to just the first match instead.
- **Enable/disable** built into the card config, optionally linked to an
  `input_boolean` or `switch` entity so automations/voice can control it.
- **Reduced-motion aware** — respects the OS/browser
  "prefers-reduced-motion" setting by default (toggleable).
- **Intensity slider** (10–100) controlling particle counts / firework
  launch rate.
- In dashboard **edit mode**, the card shows a small banner with its
  friendly name, enabled state, rule count, and current match count — so
  it's easy to find and to confirm your rules are wired up correctly.
- Effects always render **full-screen** (not just inside the card's box)
  since the whole point is a dashboard-wide celebration effect.
- Full **GUI configuration**, no YAML required — built with plain
  `HTMLElement`/Shadow DOM, no external libraries.

## Installation

### HACS

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=drmogie&repository=ha-event-effect-card&category=plugin)

1. Open the badge above (or add `drmogie/ha-event-effect-card` as a custom repository in HACS, category "Dashboard").
2. Install **HA Event Effect Card**.
3. Add the resource to your dashboard (HACS does this automatically for most setups).

### Manual

1. Copy this whole `ha-event-effect-card` folder into `<config>/www/`, so
   the file ends up at:
   `<config>/www/ha-event-effect-card/ha-event-effect-card.js`
2. Go to **Settings → Dashboards → Resources** (enable *Advanced Mode* in
   your user profile first if you don't see the *Resources* tab under the
   dashboards ⋮ menu).
3. **Add Resource**:

[![Open your Home Assistant instance and show your dashboard resources.](https://my.home-assistant.io/badges/lovelace_resources.svg)](https://my.home-assistant.io/redirect/lovelace_resources/)

   - URL: `/local/ha-event-effect-card/ha-event-effect-card.js`
   - Resource type: **JavaScript Module**
4. Hard refresh your browser (Ctrl/Cmd+Shift+R).
5. Edit a dashboard → **Add Card** → search **"HA Event Effect Card"** (or
   Manual → `type: custom:ha-event-effect-card`).

If you're upgrading from the previous build, remove the old resource entry
first so you don't have two versions loaded at once, and make sure any
card already on a dashboard still says `type: custom:ha-event-effect-card`
(unchanged from before, so existing cards should just start working once
the file is swapped).

## Troubleshooting "card not found" / resource not loading

1. **Path mismatch.** The URL `/local/...` maps directly to
   `<config>/www/...`. Confirm the file really sits at
   `<config>/www/ha-event-effect-card/ha-event-effect-card.js` via the
   File Editor add-on or SSH/Samba. Test it directly by visiting
   `http://<your-ha-url>:8123/local/ha-event-effect-card/ha-event-effect-card.js`
   in a browser tab — you should see raw JS, not a 404.
2. **Resource type** must be **JavaScript Module**, not "JavaScript File".
3. **Browser cache** — hard refresh after any resource change, or bump the
   URL with `?v=2` and hard refresh again.
4. **Stale resource entries** from earlier renamed versions
   (`calendar-effects-card.js`, `ha-event-visualization-effect-card.js`) —
   remove those, keep only one resource entry for this card.
5. **Check the browser console** (F12 → Console) while the dashboard
   loads — a genuine load failure (404, syntax error, wrong MIME type)
   shows up there.

## Example YAML

```yaml
type: custom:ha-event-effect-card
name: Holiday Effects
enabled: true
enable_entity: input_boolean.calendar_effects_enabled
allow_multiple_effects: true
respect_reduced_motion: true
performance_mode: false
intensity: 65
rules:
  - enabled: true
    trigger_type: calendar
    calendars:
      - calendar.family
      - calendar.holidays
    match: |
      Christmas
      Winter Break
    match_type: contains
    field: summary
    effects:
      - snow
  - enabled: true
    trigger_type: calendar
    calendars:
      - calendar.family
    match: |
      Birthday
    match_type: contains
    field: summary
    effects:
      - streamers
  - enabled: true
    trigger_type: calendar
    calendars:
      - calendar.family
      - calendar.holidays
    match: |
      New Year
    match_type: contains
    field: summary
    effects:
      - fireworks
  # Automatically snow when it's actually snowing outside.
  - enabled: true
    trigger_type: weather
    weather_entity: weather.home
    weather_conditions:
      - snowy
      - snowy-rainy
    weather_attribute: temperature
    weather_operator: "<"
    weather_value: 32
    effects:
      - snow
  # Manual trigger via a helper switch — no calendar or weather needed.
  - enabled: true
    trigger_type: switch
    switch_entities:
      - input_boolean.party_button
    switch_state: "on"
    effects:
      - streamers
      - fireworks
  # Birthday: a mix of falling emoji, not just one repeated glyph.
  - enabled: true
    trigger_type: calendar
    calendars:
      - calendar.family
    match: |
      Birthday
    match_type: contains
    field: summary
    effects:
      - emoji-rain
      - balloons
    emoji_rain_glyphs: "🎂 🎉 🥳 🎈"
```

### Config reference

| Key                       | Type    | Default                  | Description |
|----------------------------|---------|---------------------------|-------------|
| `name`                     | string  | HA Event Effect Card      | Shown in the edit-mode banner. |
| `enabled`                  | bool    | `true`                    | Master on/off (ignored if `enable_entity` says otherwise — the entity, when set, is authoritative). |
| `enable_entity`             | string  | —                         | An `input_boolean` or `switch` entity id to drive enable/disable. |
| `allow_multiple_effects`   | bool    | `true`                    | If `false`, only the first matching rule's effects play at a time. |
| `respect_reduced_motion`   | bool    | `true`                    | If `true`, effects are suppressed when the OS/browser requests reduced motion. |
| `performance_mode`         | bool    | `false`                   | Caps canvas resolution to native (dpr 1) and cuts particle/spark counts by ~40% — for weaker hardware (e.g. Raspberry Pi wall tablets). |
| `intensity`                | number  | `60`                      | 10–100. Scales particle counts and firework launch frequency. |
| `rules`                    | list    | `[]`                      | See below. |

Each item in `rules` uses exactly **one** trigger type, chosen with
`trigger_type`. Fields for the other trigger types can still be present
in the YAML (e.g. left over from switching types in the GUI) but are
ignored while a different type is selected:

| Key          | Type    | Default    | Description |
|--------------|---------|------------|-------------|
| `enabled`      | bool   | `true`     | Turn this rule off without deleting it. |
| `trigger_type` | string | `calendar` | `calendar`, `weather`, or `switch`. Selects which trigger below is active for this rule. |
| **Calendar trigger** (`trigger_type: calendar`) | | | |
| `calendars`  | list    | `[]`       | Calendar entity ids this rule watches. |
| `match`      | string  | `""`       | One phrase per line. Blank = match any active event on the listed calendars. |
| `match_type` | string  | `contains` | `contains`, `exact`, `regex`, or `any` (any event, ignores `match`). |
| `field`      | string  | `summary`  | Which event field to match against: `summary` (title), `description`, `location`, or `any` (all three). |
| **Weather trigger** (`trigger_type: weather`) | | | |
| `weather_entity` | string | —      | A `weather.*` entity id. |
| `weather_conditions` | list | `[]` | Any of the standard HA weather conditions (`sunny`, `rainy`, `snowy`, `pouring`, `cloudy`, `partlycloudy`, `fog`, `hail`, `lightning`, `lightning-rainy`, `snowy-rainy`, `windy`, `windy-variant`, `clear-night`, `exceptional`). Empty = ignore condition. |
| `weather_attribute` | string | —   | One of `temperature`, `apparent_temperature`, `dew_point`, `humidity`, `pressure`, `wind_speed`, `wind_bearing`, `wind_gust_speed`, `visibility`, `cloud_coverage`, `uv_index`, `ozone`. Not every weather integration populates every attribute. |
| `weather_operator` | string | `"<"` | `<`, `<=`, `>`, `>=`, or `==`. |
| `weather_value` | number | —      | Threshold to compare the attribute against. |
| **Switch trigger** (`trigger_type: switch`) | | | |
| `switch_entities` | list | `[]`     | `switch.*` / `input_boolean.*` / `binary_sensor.*` entity ids. Fires while **any** is in the target state. |
| `switch_state` | string | `"on"`   | The state to match against (case-insensitive). |
| **Effects** | | | |
| `effects`    | list    | `[]`       | Any of `streamers`, `fireworks`, `confetti-burst`, `balloons`, `hearts`, `bubbles`, `sparkles`, `emoji-rain`, `spotlight`, `leaves`, `windy`, `rain`, `snow`, `hail`, `lightning` — can list more than one. |
| `emoji_rain_glyphs` | string | —  | Only used when `emoji-rain` is in `effects`. Space/comma-separated list of emoji (e.g. `"🎉 🎂 🎓"`); each falling particle picks one at random from this list, so they fall mixed together. Blank = a built-in default set (🎉 ✨ 🎊 ⭐). |

For a weather rule, if both `weather_conditions` and
`weather_attribute`/`weather_value` are set, **both** must currently be
true for the trigger to fire (e.g. "condition is snowy AND temperature is
below 32"). Set only one of the two to use it alone.

Want a single effect to trigger from more than one type of source (say, a
calendar event *or* a manual switch)? Add a second rule with the same
`effects` list but a different `trigger_type` — rules are independent, so
any number of them can point at the same effects.

## How "active" is detected

The card subscribes to each watched calendar via Home Assistant's
`calendar/event/subscribe` websocket command for a rolling 24h-before /
48h-after window (renewed every 6 hours), so it reacts immediately as
events start and end. If that subscription isn't available for a given
calendar (older HA core, integration quirk, etc.), it falls back to
reading the calendar entity's current `state` (`on` = an event is active
right now) and its `message`/`start_time`/`end_time`/`description`/
`location` attributes — so the card keeps working either way.

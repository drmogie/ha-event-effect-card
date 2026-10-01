/*
 * HA Event Effect Card for Home Assistant
 * v2026.09.30.01 (same code as 0.10.1)
 * Dependency-free custom Lovelace card.
 *
 * Fixes vs v0.1.0:
 *  - Particle styles (left/font-size/animation-duration/animation-delay/
 *    opacity/etc.) were being set with el.style.setProperty("fontSize", ...)
 *    -- setProperty requires kebab-case CSS property names, so every one of
 *    those calls silently failed except the literal "--drift" custom
 *    property. With animation-duration defaulting to 0s, particles never
 *    animated - they just appeared and sat in their initial (near-invisible)
 *    keyframe state. Fixed by assigning camelCase props directly via
 *    el.style[key] = value (which the CSSOM does map correctly) and only
 *    using setProperty for custom properties ("--drift").
 *  - The effects overlay was position:fixed *inside the card's own Shadow
 *    DOM*. Home Assistant's grid/sections dashboards frequently apply CSS
 *    containment (`contain`) or transforms to ancestor card wrappers, which
 *    silently turns position:fixed into "fixed relative to that ancestor"
 *    instead of the viewport - so effects could end up invisible or
 *    clipped to the card's own box. Fixed by "porting" the overlay out to
 *    document.body, so it is always relative to the real viewport no
 *    matter what dashboard layout wraps the card.
 */

const CARD_TAG = "ha-event-effect-card";
const EDITOR_TAG = "ha-event-effect-card-editor";
const VERSION = "2026.09.30.01";
const EFFECTS = [
  "streamers",
  "fireworks",
  "confetti-burst",
  "balloons",
  "hearts",
  "bubbles",
  "sparkles",
  "emoji-rain",
  "spotlight",
  "leaves",
  "windy",
  "rain",
  "snow",
  "hail",
  "lightning",
];

const EFFECT_LABELS = {
  streamers: "Streamers",
  fireworks: "Fireworks",
  "confetti-burst": "Confetti Burst",
  balloons: "Balloons",
  hearts: "Hearts",
  bubbles: "Bubbles",
  sparkles: "Sparkles",
  "emoji-rain": "Emoji Rain",
  spotlight: "Spotlight",
  leaves: "Falling Leaves",
  windy: "Windy",
  rain: "Rain",
  snow: "Snow",
  hail: "Hail",
  lightning: "Lightning",
};

const DEFAULT_EMOJI_RAIN_GLYPHS = ["🎉", "✨", "🎊", "⭐"];

function parseEmojiGlyphs(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[\s,]+/)
    .map((glyph) => glyph.trim())
    .filter(Boolean);
}

const GLOBAL_STYLE_ID = "haeec-global-overlay-styles";


// Standard Home Assistant weather entity "condition" states.
const WEATHER_CONDITIONS = [
  "clear-night",
  "cloudy",
  "exceptional",
  "fog",
  "hail",
  "lightning",
  "lightning-rainy",
  "partlycloudy",
  "pouring",
  "rainy",
  "snowy",
  "snowy-rainy",
  "sunny",
  "windy",
  "windy-variant",
];

// Commonly-present numeric attributes on weather entities. Not every
// integration populates every one of these - unsupported attributes just
// won't match (see _weatherMatches).
const WEATHER_ATTRIBUTES = [
  ["temperature", "Temperature"],
  ["apparent_temperature", "Apparent temperature"],
  ["dew_point", "Dew point"],
  ["humidity", "Humidity (%)"],
  ["pressure", "Pressure"],
  ["wind_speed", "Wind speed"],
  ["wind_bearing", "Wind bearing (°)"],
  ["wind_gust_speed", "Wind gust speed"],
  ["visibility", "Visibility"],
  ["cloud_coverage", "Cloud coverage (%)"],
  ["uv_index", "UV index"],
  ["ozone", "Ozone"],
];

const WEATHER_OPERATORS = [
  ["<", "is less than"],
  ["<=", "is at most"],
  [">", "is greater than"],
  [">=", "is at least"],
  ["==", "equals"],
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const unique = (items) => [...new Set(items)];
const esc = (value = "") => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;");

// Each rule uses exactly one trigger type. Rules saved before this option
// existed have no explicit `trigger_type`, so infer one from whichever
// fields they already had populated, defaulting to "calendar".
function ruleTriggerType(rule) {
  if (rule?.trigger_type) return rule.trigger_type;
  if (Array.isArray(rule?.switch_entities) && rule.switch_entities.length) return "switch";
  if (rule?.weather_entity) return "weather";
  return "calendar";
}

// -- lightning bolt generation ---------------------------------------------
//
// A plain "⚡" glyph renders, on most platforms/fonts, as a thick flat
// yellow flash icon (notably close to the old Winamp logo) - it reads as
// clip art, not weather. Instead we procedurally build a thin, randomly
// jagged streak per bolt (occasionally with a branch), which looks like an
// actual lightning strike and is different every time it fires.

function randomBoltPoints(width, height, segments) {
  const points = [];
  let x = width / 2 + (Math.random() - 0.5) * width * 0.15;
  points.push([x, 0]);

  for (let i = 1; i <= segments; i++) {
    const y = (height / segments) * i;
    x += (Math.random() - 0.5) * width * 0.55;
    x = Math.max(width * 0.12, Math.min(width * 0.88, x));
    points.push([x, y]);
  }

  return points;
}

function pointsToPath(points) {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function buildLightningBoltSvg(width, height) {
  const mainPoints = randomBoltPoints(width, height, 5 + Math.floor(Math.random() * 3));
  let path = pointsToPath(mainPoints);

  // Roughly 65% of bolts get a shorter forked branch partway down, like a
  // real strike splitting.
  if (Math.random() > 0.35) {
    const startIndex = 1 + Math.floor(Math.random() * (mainPoints.length - 2));
    const [sx, sy] = mainPoints[startIndex];
    const forkSegments = 2 + Math.floor(Math.random() * 2);
    const forkPoints = [[sx, sy]];
    let x = sx;

    for (let i = 1; i <= forkSegments; i++) {
      const y = sy + ((height - sy) / forkSegments) * i * (0.5 + Math.random() * 0.3);
      x += (0.15 + Math.random() * 0.5) * width * (Math.random() > 0.5 ? 1 : -1);
      forkPoints.push([x, y]);
    }

    path += ` ${pointsToPath(forkPoints)}`;
  }

  // Unique filter id per bolt so multiple simultaneous bolts don't share
  // (and fight over) the same <filter> definition.
  const filterId = `haeec-bolt-glow-${Math.random().toString(36).slice(2, 9)}`;

  return `
    <svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible; display:block;">
      <defs>
        <filter id="${filterId}" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
      <path d="${path}" fill="none" stroke="#eaf4ff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" opacity="0.55" filter="url(#${filterId})" />
      <path d="${path}" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  `;
}

function injectGlobalOverlayStyles() {
  if (document.getElementById(GLOBAL_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = GLOBAL_STYLE_ID;
  style.textContent = `
    .haeec-overlay {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 9999;
      display: none;
    }

    .haeec-overlay.active {
      display: block;
    }

    .haeec-particle-layer,
    .haeec-fireworks-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }

    .haeec-particle-layer {
      overflow: hidden;
    }

    .haeec-particle {
      position: absolute;
      top: -12vh;
      will-change: transform, opacity;
    }

    .haeec-snow {
      color: white;
      text-shadow: 0 0 5px rgba(255, 255, 255, .85);
      animation: haeec-fall-snow linear infinite;
    }

    .haeec-rain {
      width: 2px;
      height: 58px;
      border-radius: 2px;
      background: linear-gradient(
        to bottom,
        rgba(180, 220, 255, 0),
        rgba(180, 220, 255, .85)
      );
      animation: haeec-fall-rain linear infinite;
    }

    .haeec-hail {
      border-radius: 50%;
      background: radial-gradient(circle at 35% 30%, #ffffff, #d9ecff 55%, #a7cdec 100%);
      box-shadow: 0 0 3px rgba(255, 255, 255, .8);
      animation: haeec-fall-hail linear infinite;
    }

    .haeec-streamer {
      width: 9px;
      height: 32px;
      border-radius: 2px;
      animation: haeec-fall-streamer linear infinite;
    }

    .haeec-confetti-burst {
      border-radius: 2px;
      animation: haeec-confetti-burst-path ease-out infinite;
    }

    .haeec-balloon,
    .haeec-heart,
    .haeec-leaf,
    .haeec-emoji-rain,
    .haeec-sparkle {
      line-height: 1;
    }

    .haeec-balloon {
      animation: haeec-rise-balloon ease-in-out infinite;
    }

    .haeec-heart {
      animation: haeec-rise-heart ease-in-out infinite;
    }

    .haeec-bubble {
      border-radius: 50%;
      background: radial-gradient(
        circle at 35% 30%,
        rgba(255, 255, 255, .9),
        rgba(160, 215, 255, .4) 55%,
        rgba(160, 215, 255, .05) 100%
      );
      border: 1px solid rgba(255, 255, 255, .5);
      animation: haeec-rise-bubble ease-in-out infinite;
    }

    .haeec-sparkle {
      animation: haeec-twinkle ease-in-out infinite;
    }

    .haeec-emoji-rain {
      animation: haeec-fall-emoji linear infinite;
    }

    .haeec-spotlight {
      position: absolute;
      top: 0;
      left: 0;
      width: 55vw;
      height: 140vh;
      background: radial-gradient(
        circle at 50% 45%,
        rgba(255, 255, 255, .32),
        rgba(120, 180, 255, .16) 45%,
        rgba(120, 180, 255, 0) 75%
      );
      mix-blend-mode: screen;
      animation: haeec-spotlight-sweep linear infinite;
    }

    .haeec-leaf {
      animation: haeec-fall-leaf ease-in-out infinite;
    }

    .haeec-wind-leaf {
      animation: haeec-blow-leaf ease-in-out infinite;
    }

    .haeec-wind-streak {
      height: 2px;
      border-radius: 2px;
      background: linear-gradient(
        to right,
        rgba(255, 255, 255, 0),
        rgba(255, 255, 255, .55) 45%,
        rgba(255, 255, 255, 0)
      );
      animation: haeec-wind-streak-dash ease-in infinite;
    }

    .haeec-lightning-flash {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(
        circle at 50% 15%,
        rgba(255, 255, 255, .95),
        rgba(210, 225, 255, .55) 55%,
        rgba(210, 225, 255, 0) 100%
      );
      mix-blend-mode: screen;
      opacity: 0;
      animation: haeec-lightning-flash linear infinite;
    }

    .haeec-lightning-bolt {
      opacity: 0;
      filter: drop-shadow(0 0 10px rgba(255, 255, 255, .55));
      animation: haeec-lightning-bolt-flash linear infinite;
    }

    .haeec-lightning-bolt svg {
      display: block;
      overflow: visible;
    }

    @keyframes haeec-fall-snow {
      from {
        transform: translate3d(0, -8vh, 0) rotate(0deg);
        opacity: 0;
      }
      8% {
        opacity: .95;
      }
      to {
        transform: translate3d(var(--drift, 35px), 118vh, 0) rotate(360deg);
        opacity: .65;
      }
    }

    @keyframes haeec-fall-rain {
      from {
        transform: translate3d(0, -15vh, 0) rotate(7deg);
        opacity: .1;
      }
      to {
        transform: translate3d(-45px, 125vh, 0) rotate(7deg);
        opacity: .85;
      }
    }

    /* Fast, mostly-straight fall to the bottom of the screen, then a
       couple of small upward "bounce" steps at ground level before
       continuing off-screen while fading - hail hitting a surface and
       kicking back up, without any real per-particle physics. */
    @keyframes haeec-fall-hail {
      0% {
        transform: translate3d(0, -10vh, 0) rotate(0deg);
        opacity: 0;
      }
      6% {
        opacity: 1;
      }
      75% {
        transform: translate3d(var(--drift, 15px), 100vh, 0) rotate(300deg);
        opacity: 1;
      }
      81% {
        transform: translate3d(var(--drift, 15px), 94vh, 0) rotate(315deg);
        opacity: 1;
      }
      87% {
        transform: translate3d(var(--drift, 15px), 100vh, 0) rotate(330deg);
        opacity: 1;
      }
      92% {
        transform: translate3d(var(--drift, 15px), 97vh, 0) rotate(345deg);
        opacity: 1;
      }
      100% {
        transform: translate3d(var(--drift, 15px), 112vh, 0) rotate(360deg);
        opacity: 0;
      }
    }

    @keyframes haeec-fall-streamer {
      from {
        transform: translate3d(0, -10vh, 0) rotate(0deg);
        opacity: 0;
      }
      6% {
        opacity: 1;
      }
      to {
        transform: translate3d(var(--drift, 30px), 120vh, 0) rotate(900deg);
        opacity: .8;
      }
    }

    /* Bursts upward from a randomized start near the bottom of the screen
       (--rise controls how high), then falls back down and off-screen
       while fading - a cannon-style confetti burst rather than a
       continuous fall. Particles start positioned at top:100vh via
       inline style (see _createConfettiBurst); this keyframe only
       supplies the relative motion from there. */
    @keyframes haeec-confetti-burst-path {
      0% {
        transform: translate3d(0, 0, 0) scale(.5) rotate(0deg);
        opacity: 0;
      }
      6% {
        opacity: 1;
      }
      38% {
        transform: translate3d(var(--drift-x, 40px), calc(var(--rise, 55vh) * -1), 0) scale(1)
          rotate(220deg);
        opacity: 1;
      }
      100% {
        transform: translate3d(var(--drift-x2, 90px), 25vh, 0) scale(.85) rotate(760deg);
        opacity: 0;
      }
    }

    /* Balloons/hearts/bubbles start below the viewport (top set inline,
       see their _create* methods) and rise up past the top of the
       screen - the mirror image of the falling effects above, so the
       same "must clear the visible area, not stop partway" rule applies
       to the negative end value here too. */
    @keyframes haeec-rise-balloon {
      0% {
        transform: translate3d(0, 0, 0) rotate(-4deg);
        opacity: 0;
      }
      8% {
        opacity: 1;
      }
      50% {
        transform: translate3d(var(--drift, 30px), -140vh, 0) rotate(4deg);
      }
      100% {
        transform: translate3d(calc(var(--drift, 30px) * -1), -260vh, 0) rotate(-4deg);
        opacity: .9;
      }
    }

    @keyframes haeec-rise-heart {
      0% {
        transform: translate3d(0, 0, 0) scale(.7) rotate(-6deg);
        opacity: 0;
      }
      10% {
        opacity: 1;
      }
      50% {
        transform: translate3d(var(--drift, 25px), -150vh, 0) scale(1) rotate(6deg);
      }
      100% {
        transform: translate3d(calc(var(--drift, 25px) * -1), -280vh, 0) scale(.9) rotate(-6deg);
        opacity: 0;
      }
    }

    @keyframes haeec-rise-bubble {
      0% {
        transform: translate3d(0, 0, 0) scale(.8);
        opacity: 0;
      }
      8% {
        opacity: .85;
      }
      85% {
        transform: translate3d(var(--drift, 25px), -210vh, 0) scale(1);
        opacity: .8;
      }
      93% {
        transform: translate3d(var(--drift, 25px), -230vh, 0) scale(1.4);
        opacity: .5;
      }
      100% {
        transform: translate3d(var(--drift, 25px), -238vh, 0) scale(.2);
        opacity: 0;
      }
    }

    /* Sparkles don't travel anywhere - each one is placed at a random
       fixed spot (see _createSparkles) and just twinkles in place, with
       its own randomized duration/delay so they don't pulse in unison. */
    @keyframes haeec-twinkle {
      0%,
      100% {
        opacity: 0;
        transform: scale(.4) rotate(0deg);
      }
      50% {
        opacity: 1;
        transform: scale(1) rotate(20deg);
      }
    }

    @keyframes haeec-fall-emoji {
      from {
        transform: translate3d(0, -10vh, 0) rotate(0deg) scale(.85);
        opacity: 0;
      }
      8% {
        opacity: 1;
      }
      to {
        transform: translate3d(var(--drift, 40px), 118vh, 0) rotate(200deg) scale(1);
        opacity: .9;
      }
    }

    @keyframes haeec-spotlight-sweep {
      0% {
        transform: translate3d(-45vw, -20vh, 0);
        filter: hue-rotate(0deg);
      }
      50% {
        filter: hue-rotate(180deg);
      }
      100% {
        transform: translate3d(145vw, -20vh, 0);
        filter: hue-rotate(360deg);
      }
    }

    /* More pronounced side-to-side sway and reversing rotation than snow,
       to read as a tumbling leaf rather than a straight-falling flake. */
    @keyframes haeec-fall-leaf {
      0% {
        transform: translate3d(0, -10vh, 0) rotate(-15deg);
        opacity: 0;
      }
      8% {
        opacity: 1;
      }
      25% {
        transform: translate3d(var(--drift, 50px), 25vh, 0) rotate(35deg);
      }
      50% {
        transform: translate3d(calc(var(--drift, 50px) * -1), 55vh, 0) rotate(-25deg);
      }
      75% {
        transform: translate3d(var(--drift, 50px), 85vh, 0) rotate(30deg);
      }
      100% {
        transform: translate3d(calc(var(--drift, 50px) * -0.6), 118vh, 0) rotate(-10deg);
        opacity: .85;
      }
    }

    /* Windy: leaves travel horizontally (left to right) *and* drift
       downward at the same time - real wind-blown leaves still fall due
       to gravity, they don't float purely sideways. The downward drift
       (12vh -> 28vh -> 46vh -> 62vh) is layered underneath the same
       side-to-side "flutter" wobble (--flutter, randomized per particle)
       and a rotation that flips back and forth like paper caught in a
       gust, instead of a steady spin. Particles start positioned off the
       left edge (left:-15vw, see _createWindy) at a randomized height, so
       the 0-based transform values below are purely the additional
       distance travelled - net final horizontal position needs to clear
       the right edge, same "must clear the screen" rule as every other
       falling/rising effect (a leaf may also exit off the bottom before
       finishing its horizontal travel, which is fine and looks natural). */
    @keyframes haeec-blow-leaf {
      0% {
        transform: translate3d(0, 0, 0) rotate(-15deg);
        opacity: 0;
      }
      8% {
        opacity: 1;
      }
      25% {
        transform: translate3d(32vw, calc(12vh + var(--flutter, -18px)), 0) rotate(25deg);
      }
      50% {
        transform: translate3d(65vw, calc(28vh - var(--flutter, -18px)), 0) rotate(-20deg);
      }
      75% {
        transform: translate3d(98vw, calc(46vh + var(--flutter, -18px)), 0) rotate(15deg);
      }
      100% {
        transform: translate3d(130vw, 62vh, 0) rotate(-10deg);
        opacity: .85;
      }
    }

    /* Faint, fast-dashing streak lines layered behind the wind-blown
       leaves to sell the sense of a gust passing through - same
       left-to-right travel pattern and off-screen start as the leaves. */
    @keyframes haeec-wind-streak-dash {
      0% {
        transform: translate3d(0, 0, 0);
        opacity: 0;
      }
      10% {
        opacity: .8;
      }
      90% {
        opacity: .5;
      }
      100% {
        transform: translate3d(140vw, 0, 0);
        opacity: 0;
      }
    }

    /* Each lightning layer gets its own randomized animation-duration and
       a negative animation-delay (see _createLightning), so instances
       flicker at their own out-of-sync moment within the loop instead of
       all strobing together in lockstep. The keyframe itself just packs
       a quick double-flash near the end of each cycle, then stays dark
       for the rest of it. */
    @keyframes haeec-lightning-flash {
      0%, 90% {
        opacity: 0;
      }
      90.5% {
        opacity: .85;
      }
      91% {
        opacity: .15;
      }
      91.6% {
        opacity: .7;
      }
      92.4% {
        opacity: 0;
      }
      100% {
        opacity: 0;
      }
    }

    @keyframes haeec-lightning-bolt-flash {
      0%, 90% {
        opacity: 0;
        transform: scale(.85);
      }
      90.5% {
        opacity: 1;
        transform: scale(1);
      }
      91% {
        opacity: .2;
        transform: scale(.97);
      }
      91.6% {
        opacity: .9;
        transform: scale(1);
      }
      92.4% {
        opacity: 0;
        transform: scale(.9);
      }
      100% {
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

class HAEventEffectCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._editMode = false;
    this._eventsByCalendar = new Map();
    this._unsubs = [];
    this._subKey = "";
    this._activeEffects = new Set();
    this._activeMatches = [];
    this._activeEmojiGlyphs = [];
    this._resubscribeTimer = null;
    this._minuteTimer = null;
    this._raf = null;
    this._fireworkLastLaunch = 0;
    this._fireworkParticles = [];
    this._resizeHandler = () => this._resizeCanvas();

    // Overlay lives outside the shadow root, ported to document.body, so it
    // always paints relative to the real viewport (see header note above).
    this._overlayEl = null;
    this._particleLayerEl = null;
    this._fireworksCanvasEl = null;
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig() {
    return {
      name: "HA Event Effect Card",
      enabled: true,
      allow_multiple_effects: true,
      rules: [],
    };
  }

  setConfig(config) {
    if (!config) throw new Error("Configuration is required");
    this._config = {
      name: "HA Event Effect Card",
      enabled: true,
      allow_multiple_effects: true,
      respect_reduced_motion: true,
      performance_mode: false,
      intensity: 60,
      rules: [],
      ...clone(config),
    };
    this._renderBase();
    this._ensureSubscriptions(true);
    this._evaluate();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first) this._ensureSubscriptions(true);
    else this._ensureSubscriptions(false);
    this._evaluate();
    this._renderStatus();
  }

  get hass() {
    return this._hass;
  }

  set editMode(value) {
    this._editMode = Boolean(value);
    this._evaluate();
    this._renderStatus();
  }

  get editMode() {
    return this._editMode;
  }

  connectedCallback() {
    this._renderBase();
    this._ensureOverlay();
    this._ensureSubscriptions(true);
    window.addEventListener("resize", this._resizeHandler);
    if (!this._minuteTimer) {
      this._minuteTimer = setInterval(() => this._evaluate(), 30_000);
    }
  }

  disconnectedCallback() {
    this._unsubscribeAll();
    window.removeEventListener("resize", this._resizeHandler);
    if (this._minuteTimer) clearInterval(this._minuteTimer);
    this._minuteTimer = null;
    if (this._resubscribeTimer) clearTimeout(this._resubscribeTimer);
    this._resubscribeTimer = null;
    this._stopEffects(true);
    this._removeOverlay();
  }

  getCardSize() {
    return this._editMode ? 1 : 0;
  }

  getGridOptions() {
    return { rows: 1, columns: 12, min_rows: 1, min_columns: 3 };
  }

  // -- overlay (ported to document.body) ---------------------------------

  _ensureOverlay() {
    if (this._overlayEl && document.body.contains(this._overlayEl)) return;

    injectGlobalOverlayStyles();

    const overlay = document.createElement("div");
    overlay.className = "haeec-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const layer = document.createElement("div");
    layer.className = "haeec-particle-layer";

    const canvas = document.createElement("canvas");
    canvas.className = "haeec-fireworks-canvas";

    overlay.appendChild(layer);
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    this._overlayEl = overlay;
    this._particleLayerEl = layer;
    this._fireworksCanvasEl = canvas;
  }

  _removeOverlay() {
    this._overlayEl?.remove();
    this._overlayEl = null;
    this._particleLayerEl = null;
    this._fireworksCanvasEl = null;
  }

  // -- shadow-root status banner / root markup ----------------------------

  _renderBase() {
    if (!this.shadowRoot || this.shadowRoot.querySelector("#root")) {
      this._renderStatus();
      return;
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        #root {
          position: relative;
        }

        #status {
          display: none;
          box-sizing: border-box;
          min-height: 58px;
          border: 1px dashed var(--primary-color, #03a9f4);
          border-radius: var(--ha-card-border-radius, 12px);
          background: color-mix(
            in srgb,
            var(--primary-color, #03a9f4) 9%,
            var(--card-background-color, #fff)
          );
          color: var(--primary-text-color, #222);
          padding: 12px 14px;
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
          line-height: 1.35;
        }

        #status.visible {
          display: block;
        }

        #status .title {
          font-weight: 700;
          font-size: 15px;
        }

        #status .meta {
          margin-top: 3px;
          opacity: .72;
          font-size: 12px;
        }
      </style>

      <div id="root">
        <div id="status"></div>
      </div>
    `;

    this._renderStatus();
  }

  _renderStatus() {
    const status = this.shadowRoot?.querySelector("#status");

    if (!status || !this._config) return;

    if (!this._editMode) {
      status.classList.remove("visible");
      return;
    }

    const enabled = this._isEnabled();
    const matches = this._activeMatches.length;

    status.classList.add("visible");

    status.innerHTML = `
      <div class="title">
        ✨ ${esc(this._config.name || "HA Event Effect Card")}
      </div>

      <div class="meta">
        Dashboard edit mode •
        ${enabled ? "Enabled" : "Disabled"} •
        ${this._config.rules?.length || 0} rule(s) •
        ${matches} active match(es)
      </div>
    `;
  }

  // -- calendar subscriptions ---------------------------------------------

  _calendarIds() {
    const rules = Array.isArray(this._config?.rules) ? this._config.rules : [];

    return unique(
      rules
        .flatMap((rule) => (Array.isArray(rule.calendars) ? rule.calendars : []))
        .filter((id) => id?.startsWith("calendar."))
    ).sort();
  }

  _ensureSubscriptions(force = false) {
    if (!this.isConnected || !this._hass?.connection || !this._config) {
      return;
    }

    const ids = this._calendarIds();
    const key = ids.join("|");

    if (!force && key === this._subKey) return;

    this._subKey = key;
    this._subscribe(ids);
  }

  async _subscribe(ids) {
    await this._unsubscribeAll();

    this._eventsByCalendar.clear();

    if (!ids.length || !this._hass?.connection) return;

    // Keep the subscribed range small, then renew it periodically.
    const now = Date.now();
    const start = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const end = new Date(now + 48 * 60 * 60 * 1000).toISOString();

    for (const entityId of ids) {
      try {
        const maybeUnsub = await this._hass.connection.subscribeMessage(
          (payload) => {
            const events = Array.isArray(payload)
              ? payload
              : Array.isArray(payload?.events)
              ? payload.events
              : Array.isArray(payload?.event?.events)
              ? payload.event.events
              : [];

            this._eventsByCalendar.set(entityId, events || []);
            this._evaluate();
          },
          {
            type: "calendar/event/subscribe",
            entity_id: entityId,
            start,
            end,
          }
        );

        if (typeof maybeUnsub === "function") {
          this._unsubs.push(maybeUnsub);
        }
      } catch (err) {
        console.warn(
          `[${CARD_TAG}] Calendar subscription failed for ${entityId}, falling back to entity state`,
          err
        );
        this._eventsByCalendar.set(entityId, []);
      }
    }

    if (this._resubscribeTimer) clearTimeout(this._resubscribeTimer);
    this._resubscribeTimer = setTimeout(
      () => this._ensureSubscriptions(true),
      6 * 60 * 60 * 1000
    );
  }

  async _unsubscribeAll() {
    const unsubs = this._unsubs.splice(0);
    for (const unsub of unsubs) {
      try {
        await unsub();
      } catch (_) {
        /* ignore */
      }
    }
  }

  // -- enable/disable -------------------------------------------------------

  _isEnabled() {
    if (!this._config || this._config.enabled === false) return false;

    const entityId = this._config.enable_entity;
    if (!entityId) return true;

    const state = this._hass?.states?.[entityId]?.state;
    return state === "on" || state === "open" || state === "home" || state === "true";
  }

  // -- date/event matching ---------------------------------------------------

  _haDateString(date = new Date()) {
    const tz = this._hass?.config?.time_zone;

    if (!tz) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, "0");
      const d = String(date.getDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    }

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const get = (type) => parts.find((part) => part.type === type)?.value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  _eventIsActive(event, now = new Date()) {
    if (!event?.start || !event?.end) return false;

    const start = String(event.start);
    const end = String(event.end);
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

    // All-day events use an exclusive end date.
    if (dateOnly.test(start) && dateOnly.test(end)) {
      const today = this._haDateString(now);
      return start <= today && today < end;
    }

    const s = Date.parse(start);
    const e = Date.parse(end);
    const n = now.getTime();
    return Number.isFinite(s) && Number.isFinite(e) && s <= n && n < e;
  }

  _eventsForCalendar(calendarId) {
    const subscribed = this._eventsByCalendar.get(calendarId);

    if (Array.isArray(subscribed) && subscribed.length) {
      return subscribed;
    }

    // Fallback for older HA versions, failed subscriptions, or while a
    // subscription is still connecting: read straight from entity state.
    const state = this._hass?.states?.[calendarId];
    if (!state || state.state !== "on") return [];

    const attributes = state.attributes || {};
    const normalize = (value) =>
      typeof value === "string" && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)
        ? value.replace(" ", "T")
        : value;

    return [
      {
        start: normalize(attributes.start_time),
        end: normalize(attributes.end_time),
        summary: attributes.message || attributes.friendly_name || calendarId,
        description: attributes.description || "",
        location: attributes.location || "",
        all_day: Boolean(attributes.all_day),
      },
    ];
  }

  _textForField(event, field) {
    const summary = event?.summary || event?.message || "";
    const description = event?.description || "";
    const location = event?.location || "";

    if (field === "description") return description;
    if (field === "location") return location;
    if (field === "any") return `${summary}\n${description}\n${location}`;
    return summary;
  }

  _matches(event, rule) {
    const type = rule.match_type || "contains";
    if (type === "any") return true;

    const patterns = String(rule.match || "")
      .split("\n")
      .map((value) => value.trim())
      .filter(Boolean);

    if (!patterns.length) return true;

    const haystack = this._textForField(event, rule.field || "summary");

    if (type === "exact") {
      return patterns.some(
        (pattern) => haystack.localeCompare(pattern, undefined, { sensitivity: "accent" }) === 0
      );
    }

    if (type === "regex") {
      return patterns.some((pattern) => {
        try {
          return new RegExp(pattern, "i").test(haystack);
        } catch (_) {
          return false;
        }
      });
    }

    const lower = haystack.toLowerCase();
    return patterns.some((pattern) => lower.includes(pattern.toLowerCase()));
  }

  _evaluate() {
    if (!this._config) return;

    const matches = [];
    const rules = Array.isArray(this._config.rules) ? this._config.rules : [];
    const now = new Date();

    if (this._isEnabled()) {
      for (const [ruleIndex, rule] of rules.entries()) {
        if (rule?.enabled === false) continue;

        const triggerType = ruleTriggerType(rule);

        if (triggerType === "calendar") {
          const calendars = Array.isArray(rule.calendars) ? rule.calendars : [];

          for (const calendarId of calendars) {
            const events = this._eventsForCalendar(calendarId);

            for (const event of events) {
              if (this._eventIsActive(event, now) && this._matches(event, rule)) {
                matches.push({ ruleIndex, rule, source: "calendar", calendarId, event });
              }
            }
          }
        } else if (triggerType === "switch") {
          if (this._switchMatches(rule)) {
            matches.push({ ruleIndex, rule, source: "switch" });
          }
        } else if (triggerType === "weather") {
          if (this._weatherMatches(rule)) {
            matches.push({ ruleIndex, rule, source: "weather" });
          }
        }
      }
    }

    this._activeMatches = matches;

    // Keep the dashboard editor clear/readable. The banner still reports
    // matches even while effects themselves are suppressed.
    if (this._editMode) {
      this._setEffects([]);
      this._renderStatus();
      return;
    }

    let desired = [];
    const emojiGlyphs = new Set();

    for (const match of matches) {
      const effects = Array.isArray(match.rule.effects) ? match.rule.effects : [];
      desired.push(...effects.filter((effect) => EFFECTS.includes(effect)));

      if (effects.includes("emoji-rain")) {
        for (const glyph of parseEmojiGlyphs(match.rule.emoji_rain_glyphs)) {
          emojiGlyphs.add(glyph);
        }
      }

      if (!this._config.allow_multiple_effects && desired.length) break;
    }

    desired = this._config.allow_multiple_effects ? unique(desired) : desired.slice(0, 1);
    this._activeEmojiGlyphs = [...emojiGlyphs];

    this._setEffects(desired);
    this._renderStatus();
  }

  // A rule uses exactly one trigger type (see ruleTriggerType above) -
  // these helpers just evaluate the switch/weather trigger for a rule that
  // has been routed to them; they don't need to know about the others.

  _switchMatches(rule) {
    const entities = Array.isArray(rule.switch_entities) ? rule.switch_entities : [];
    if (!entities.length || !this._hass) return false;

    const targetState = String(rule.switch_state ?? "on").trim().toLowerCase() || "on";

    return entities.some((entityId) => {
      const state = this._hass.states?.[entityId]?.state;
      return typeof state === "string" && state.toLowerCase() === targetState;
    });
  }

  _weatherMatches(rule) {
    const entityId = rule.weather_entity;
    if (!entityId || !this._hass) return false;

    const state = this._hass.states?.[entityId];
    if (!state) return false;

    const conditions = Array.isArray(rule.weather_conditions) ? rule.weather_conditions : [];
    const hasConditionFilter = conditions.length > 0;
    const conditionMatch = hasConditionFilter ? conditions.includes(state.state) : null;

    const attribute = rule.weather_attribute;
    const hasAttributeFilter =
      attribute &&
      rule.weather_value !== undefined &&
      rule.weather_value !== null &&
      rule.weather_value !== "";

    let attributeMatch = null;
    if (hasAttributeFilter) {
      const current = Number(state.attributes?.[attribute]);
      const target = Number(rule.weather_value);

      if (!Number.isFinite(current) || !Number.isFinite(target)) {
        attributeMatch = false;
      } else {
        switch (rule.weather_operator || "<") {
          case "<=":
            attributeMatch = current <= target;
            break;
          case ">":
            attributeMatch = current > target;
            break;
          case ">=":
            attributeMatch = current >= target;
            break;
          case "==":
            attributeMatch = current === target;
            break;
          default:
            attributeMatch = current < target;
        }
      }
    }

    // Nothing configured for this weather trigger - don't let a bare
    // entity selection with no condition/attribute silently match always.
    if (!hasConditionFilter && !hasAttributeFilter) return false;

    if (hasConditionFilter && hasAttributeFilter) {
      return Boolean(conditionMatch) && Boolean(attributeMatch);
    }

    return hasConditionFilter ? Boolean(conditionMatch) : Boolean(attributeMatch);
  }

  // -- effects lifecycle -----------------------------------------------------

  _motionAllowed() {
    if (this._config?.respect_reduced_motion === false) return true;
    return !window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  }

  _setEffects(effectList) {
    const desired = new Set(this._motionAllowed() ? effectList : []);

    const same =
      desired.size === this._activeEffects.size &&
      [...desired].every((effect) => this._activeEffects.has(effect));

    if (same) return;

    this._activeEffects = desired;
    this._restartEffects();
  }

  _restartEffects() {
    this._stopEffects(false);
    this._ensureOverlay();

    if (!this._activeEffects.size) return;

    this._overlayEl.classList.add("active");

    const intensity = Math.max(10, Math.min(100, Number(this._config?.intensity ?? 60)));
    const perfScale = this._config?.performance_mode ? 0.6 : 1;

    if (this._activeEffects.has("snow")) {
      this._createSnow(Math.max(4, Math.round((16 + intensity * 0.45) * perfScale)));
    }
    if (this._activeEffects.has("rain")) {
      this._createRain(Math.max(6, Math.round((30 + intensity * 0.9) * perfScale)));
    }
    if (this._activeEffects.has("hail")) {
      this._createHail(Math.max(6, Math.round((22 + intensity * 0.55) * perfScale)));
    }
    if (this._activeEffects.has("streamers")) {
      this._createStreamers(Math.max(4, Math.round((12 + intensity * 0.35) * perfScale)));
    }
    if (this._activeEffects.has("confetti-burst")) {
      this._createConfettiBurst(Math.max(6, Math.round((14 + intensity * 0.3) * perfScale)));
    }
    if (this._activeEffects.has("balloons")) {
      this._createBalloons(Math.max(3, Math.round((6 + intensity * 0.12) * perfScale)));
    }
    if (this._activeEffects.has("hearts")) {
      this._createHearts(Math.max(4, Math.round((10 + intensity * 0.25) * perfScale)));
    }
    if (this._activeEffects.has("bubbles")) {
      this._createBubbles(Math.max(5, Math.round((14 + intensity * 0.35) * perfScale)));
    }
    if (this._activeEffects.has("sparkles")) {
      this._createSparkles(Math.max(8, Math.round((20 + intensity * 0.5) * perfScale)));
    }
    if (this._activeEffects.has("emoji-rain")) {
      this._createEmojiRain(
        Math.max(4, Math.round((10 + intensity * 0.25) * perfScale)),
        this._activeEmojiGlyphs
      );
    }
    if (this._activeEffects.has("spotlight")) {
      this._createSpotlight(Math.max(1, Math.round((1 + intensity * 0.02) * perfScale)));
    }
    if (this._activeEffects.has("leaves")) {
      this._createLeaves(Math.max(4, Math.round((12 + intensity * 0.3) * perfScale)));
    }
    if (this._activeEffects.has("windy")) {
      this._createWindy(Math.max(5, Math.round((14 + intensity * 0.3) * perfScale)));
    }
    if (this._activeEffects.has("lightning")) {
      this._createLightning(Math.max(2, Math.round((3 + intensity * 0.05) * perfScale)));
    }
    if (this._activeEffects.has("fireworks")) {
      this._startFireworks(intensity);
    }
  }

  _stopEffects(clearSet = false) {
    if (this._particleLayerEl) this._particleLayerEl.replaceChildren();
    if (this._overlayEl) this._overlayEl.classList.remove("active");

    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this._fireworkParticles = [];

    if (this._fireworksCanvasEl) {
      const ctx = this._fireworksCanvasEl.getContext("2d");
      ctx?.clearRect(0, 0, this._fireworksCanvasEl.width, this._fireworksCanvasEl.height);
      if (ctx) {
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }
    }

    if (clearSet) this._activeEffects.clear();
  }

  // -- particle creation -------------------------------------------------------
  //
  // IMPORTANT: standard (non-custom) CSS properties must be assigned via
  // el.style[camelCaseKey] = value, NOT el.style.setProperty(camelCaseKey, ...).
  // setProperty() requires the literal kebab-case CSS property name (e.g.
  // "font-size"); passing "fontSize" is silently ignored. Only custom
  // properties (keys starting with "--") should go through setProperty.

  _particle(cls, styles = {}, text = "") {
    if (!this._particleLayerEl) return;

    const el = document.createElement("div");
    el.className = `haeec-particle haeec-${cls}`;
    el.textContent = text;

    for (const [key, value] of Object.entries(styles)) {
      if (key.startsWith("--")) {
        el.style.setProperty(key, value);
      } else {
        el.style[key] = value;
      }
    }

    this._particleLayerEl.appendChild(el);
  }

  // Lightning bolts need real markup (an inline SVG), not a text glyph, so
  // they get their own creation path rather than going through _particle().
  _lightningBoltElement(styles = {}) {
    if (!this._particleLayerEl) return;

    const width = 60 + Math.random() * 40;
    const height = 140 + Math.random() * 160;

    const el = document.createElement("div");
    el.className = "haeec-particle haeec-lightning-bolt";
    el.innerHTML = buildLightningBoltSvg(width, height);

    for (const [key, value] of Object.entries(styles)) {
      if (key.startsWith("--")) {
        el.style.setProperty(key, value);
      } else {
        el.style[key] = value;
      }
    }

    this._particleLayerEl.appendChild(el);
  }

  _createSnow(count) {
    for (let i = 0; i < count; i++) {
      const size = 8 + Math.random() * 16;

      this._particle(
        "snow",
        {
          left: `${Math.random() * 100}vw`,
          fontSize: `${size}px`,
          animationDuration: `${6 + Math.random() * 10}s`,
          animationDelay: `${-Math.random() * 12}s`,
          "--drift": `${-60 + Math.random() * 120}px`,
          opacity: `${0.45 + Math.random() * 0.5}`,
        },
        Math.random() > 0.45 ? "❄" : "•"
      );
    }
  }

  _createRain(count) {
    for (let i = 0; i < count; i++) {
      this._particle("rain", {
        left: `${Math.random() * 105}vw`,
        height: `${35 + Math.random() * 60}px`,
        animationDuration: `${0.45 + Math.random() * 0.55}s`,
        animationDelay: `${-Math.random() * 2}s`,
        opacity: `${0.25 + Math.random() * 0.55}`,
      });
    }
  }

  _createHail(count) {
    for (let i = 0; i < count; i++) {
      const size = 4 + Math.random() * 5;

      this._particle("hail", {
        left: `${Math.random() * 105}vw`,
        width: `${size}px`,
        height: `${size}px`,
        animationDuration: `${0.55 + Math.random() * 0.5}s`,
        animationDelay: `${-Math.random() * 3}s`,
        "--drift": `${-30 + Math.random() * 60}px`,
      });
    }
  }

  _createStreamers(count) {
    const palette = [
      "#ff3b30",
      "#ffcc00",
      "#34c759",
      "#0a84ff",
      "#bf5af2",
      "#ff9f0a",
      "#ff2d55",
    ];

    for (let i = 0; i < count; i++) {
      this._particle("streamer", {
        left: `${Math.random() * 100}vw`,
        background: palette[Math.floor(Math.random() * palette.length)],
        width: `${6 + Math.random() * 8}px`,
        height: `${18 + Math.random() * 28}px`,
        animationDuration: `${4 + Math.random() * 5}s`,
        animationDelay: `${-Math.random() * 8}s`,
        "--drift": `${-80 + Math.random() * 160}px`,
      });
    }
  }

  _createConfettiBurst(count) {
    const palette = [
      "#ff3b30",
      "#ffcc00",
      "#34c759",
      "#0a84ff",
      "#bf5af2",
      "#ff9f0a",
      "#ff2d55",
    ];

    for (let i = 0; i < count; i++) {
      const rise = 35 + Math.random() * 45;

      this._particle("confetti-burst", {
        left: `${Math.random() * 100}vw`,
        top: "100vh",
        background: palette[Math.floor(Math.random() * palette.length)],
        width: `${5 + Math.random() * 6}px`,
        height: `${5 + Math.random() * 6}px`,
        animationDuration: `${2.4 + Math.random() * 2.2}s`,
        animationDelay: `${-Math.random() * 6}s`,
        "--rise": `${rise}vh`,
        "--drift-x": `${-70 + Math.random() * 140}px`,
        "--drift-x2": `${-110 + Math.random() * 220}px`,
      });
    }
  }

  _createBalloons(count) {
    for (let i = 0; i < count; i++) {
      const size = 34 + Math.random() * 30;

      this._particle(
        "balloon",
        {
          left: `${Math.random() * 100}vw`,
          top: "108vh",
          fontSize: `${size}px`,
          animationDuration: `${9 + Math.random() * 7}s`,
          animationDelay: `${-Math.random() * 16}s`,
          "--drift": `${-40 + Math.random() * 80}px`,
        },
        "🎈"
      );
    }
  }

  _createHearts(count) {
    const glyphs = ["❤️", "💕", "💖", "💗", "💓"];

    for (let i = 0; i < count; i++) {
      const size = 22 + Math.random() * 22;

      this._particle(
        "heart",
        {
          left: `${Math.random() * 100}vw`,
          top: "106vh",
          fontSize: `${size}px`,
          animationDuration: `${6 + Math.random() * 5}s`,
          animationDelay: `${-Math.random() * 11}s`,
          "--drift": `${-35 + Math.random() * 70}px`,
        },
        glyphs[Math.floor(Math.random() * glyphs.length)]
      );
    }
  }

  _createBubbles(count) {
    for (let i = 0; i < count; i++) {
      const size = 14 + Math.random() * 26;

      this._particle("bubble", {
        left: `${Math.random() * 100}vw`,
        top: "104vh",
        width: `${size}px`,
        height: `${size}px`,
        animationDuration: `${7 + Math.random() * 6}s`,
        animationDelay: `${-Math.random() * 13}s`,
        "--drift": `${-30 + Math.random() * 60}px`,
      });
    }
  }

  _createSparkles(count) {
    for (let i = 0; i < count; i++) {
      const size = 14 + Math.random() * 18;
      const duration = 1.4 + Math.random() * 2.4;

      this._particle(
        "sparkle",
        {
          left: `${Math.random() * 100}vw`,
          top: `${Math.random() * 100}vh`,
          fontSize: `${size}px`,
          animationDuration: `${duration}s`,
          animationDelay: `${-Math.random() * duration}s`,
        },
        "✨"
      );
    }
  }

  _createEmojiRain(count, glyphs) {
    const pool = glyphs && glyphs.length ? glyphs : DEFAULT_EMOJI_RAIN_GLYPHS;

    for (let i = 0; i < count; i++) {
      const glyph = pool[Math.floor(Math.random() * pool.length)];
      const size = 24 + Math.random() * 26;

      this._particle(
        "emoji-rain",
        {
          left: `${Math.random() * 100}vw`,
          fontSize: `${size}px`,
          animationDuration: `${6 + Math.random() * 7}s`,
          animationDelay: `${-Math.random() * 13}s`,
          "--drift": `${-70 + Math.random() * 140}px`,
        },
        glyph
      );
    }
  }

  _createSpotlight(count) {
    for (let i = 0; i < count; i++) {
      const duration = 9 + Math.random() * 8;

      this._particle("spotlight", {
        animationDuration: `${duration}s`,
        animationDelay: `${-Math.random() * duration}s`,
      });
    }
  }

  _createLeaves(count) {
    const glyphs = ["🍂", "🍁", "🍃"];

    for (let i = 0; i < count; i++) {
      const size = 20 + Math.random() * 20;

      this._particle(
        "leaf",
        {
          left: `${Math.random() * 100}vw`,
          fontSize: `${size}px`,
          animationDuration: `${7 + Math.random() * 6}s`,
          animationDelay: `${-Math.random() * 13}s`,
          "--drift": `${40 + Math.random() * 40}px`,
        },
        glyphs[Math.floor(Math.random() * glyphs.length)]
      );
    }
  }

  _createWindy(count) {
    const leafGlyphs = ["🍃", "🍂", "🍁"];
    const leafCount = Math.max(3, Math.round(count * 0.7));
    const streakCount = Math.max(2, Math.round(count * 0.3));

    for (let i = 0; i < leafCount; i++) {
      const size = 20 + Math.random() * 18;

      this._particle(
        "wind-leaf",
        {
          left: "-15vw",
          top: `${Math.random() * 90}vh`,
          fontSize: `${size}px`,
          animationDuration: `${3.5 + Math.random() * 3}s`,
          animationDelay: `${-Math.random() * 6}s`,
          "--flutter": `${-24 + Math.random() * 48}px`,
        },
        leafGlyphs[Math.floor(Math.random() * leafGlyphs.length)]
      );
    }

    for (let i = 0; i < streakCount; i++) {
      this._particle("wind-streak", {
        left: "-25vw",
        top: `${Math.random() * 100}vh`,
        width: `${60 + Math.random() * 80}px`,
        animationDuration: `${1 + Math.random() * 1.2}s`,
        animationDelay: `${-Math.random() * 2.2}s`,
      });
    }
  }

  _createLightning(count) {
    // Ambient sky flashes: a couple of full-viewport overlays, each with
    // its own randomized cycle length and a negative delay so they start
    // at a random point already in progress - this desyncs them from each
    // other instead of all strobing in lockstep.
    const flashLayers = Math.max(2, Math.round(count / 2));
    for (let i = 0; i < flashLayers; i++) {
      const duration = 4 + Math.random() * 6;
      this._particle("lightning-flash", {
        animationDuration: `${duration}s`,
        animationDelay: `${-Math.random() * duration}s`,
      });
    }

    // Bolt streaks near the top of the screen, flashing on roughly the
    // same cadence as the sky flashes above.
    for (let i = 0; i < count; i++) {
      const duration = 4 + Math.random() * 6;

      this._lightningBoltElement({
        left: `${5 + Math.random() * 90}vw`,
        top: `${-2 + Math.random() * 14}vh`,
        animationDuration: `${duration}s`,
        animationDelay: `${-Math.random() * duration}s`,
      });
    }
  }

  // -- fireworks (canvas) -------------------------------------------------------

  _maxPixelRatio() {
    // A 4K wall panel at native dpr 2 means a ~7680x4320 canvas - every
    // clearRect/fillRect scales with that pixel count. Cap lower by default,
    // and lower further in performance_mode for weak devices (Pi-class wall
    // tablets are common in HA setups).
    const cap = this._config?.performance_mode ? 1 : 1.5;
    return Math.min(window.devicePixelRatio || 1, cap);
  }

  _resizeCanvas() {
    const canvas = this._fireworksCanvasEl;
    if (!canvas) return;

    const dpr = this._maxPixelRatio();

    this._viewportW = window.innerWidth;
    this._viewportH = window.innerHeight;

    canvas.width = Math.floor(this._viewportW * dpr);
    canvas.height = Math.floor(this._viewportH * dpr);
    canvas.style.width = `${this._viewportW}px`;
    canvas.style.height = `${this._viewportH}px`;

    const ctx = canvas.getContext("2d");
    ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  _startFireworks(intensity) {
    const canvas = this._fireworksCanvasEl;
    if (!canvas) return;

    this._resizeCanvas();
    const ctx = canvas.getContext("2d");

    const palette = [
      "#ff453a",
      "#ffd60a",
      "#30d158",
      "#64d2ff",
      "#bf5af2",
      "#ff9f0a",
      "#ff375f",
      "#ffffff",
    ];

    const perfScale = this._config?.performance_mode ? 0.6 : 1;
    const launchEvery = Math.max(260, 1050 - intensity * 7.2) / perfScale;
    const particleCount = Math.max(6, Math.round((28 + intensity * 0.35) * perfScale));
    // Safety cap so a slow device that can't keep up with decay never ends
    // up drawing an ever-growing spark count - this bounds worst-case cost
    // per frame regardless of how long fireworks have been running.
    const maxParticles = Math.round(500 * perfScale);

    this._fireworkLastLaunch = 0;
    ctx.globalCompositeOperation = "lighter";

    const launch = () => {
      if (this._fireworkParticles.length >= maxParticles) return;

      const x = this._viewportW * (0.12 + Math.random() * 0.76);
      const y = this._viewportH * (0.12 + Math.random() * 0.48);
      const color = palette[Math.floor(Math.random() * palette.length)];
      const budget = Math.min(particleCount, maxParticles - this._fireworkParticles.length);

      for (let i = 0; i < budget; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + Math.random() * 0.18;
        const speed = 1.8 + Math.random() * 4.8;

        this._fireworkParticles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          decay: 0.01 + Math.random() * 0.014,
          color,
          size: 1.2 + Math.random() * 2.1,
        });
      }
    };

    const frame = (ts) => {
      if (!this._activeEffects.has("fireworks")) return;

      ctx.clearRect(0, 0, this._viewportW, this._viewportH);

      if (!this._fireworkLastLaunch || ts - this._fireworkLastLaunch > launchEvery) {
        launch();
        if (Math.random() > 0.72) launch();
        this._fireworkLastLaunch = ts;
      }

      // In-place compaction instead of Array#filter: filter() allocates a
      // brand-new array every single frame, which under a busy firework
      // burst (hundreds of live particles, 60x/sec) creates constant GC
      // pressure and is a common source of animation jank/stutter. Swapping
      // surviving particles down to the front of the same array and just
      // truncating `.length` avoids that allocation entirely.
      const particles = this._fireworkParticles;
      let alive = 0;

      for (let i = 0; i < particles.length; i++) {
        const particle = particles[i];

        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vx *= 0.992;
        particle.vy = particle.vy * 0.992 + 0.035;
        particle.life -= particle.decay;

        if (particle.life <= 0.02) continue;

        particles[alive++] = particle;

        // fillRect is meaningfully cheaper per particle than beginPath +
        // arc + fill (arc involves curve-approximation math per call); at
        // these particle sizes a small square reads visually as a spark
        // just the same as a circle would.
        ctx.globalAlpha = particle.life;
        ctx.fillStyle = particle.color;
        ctx.fillRect(
          particle.x - particle.size,
          particle.y - particle.size,
          particle.size * 2,
          particle.size * 2
        );
      }

      particles.length = alive;

      ctx.globalAlpha = 1;

      this._raf = requestAnimationFrame(frame);
    };

    this._raf = requestAnimationFrame(frame);
  }
}

class HAEventEffectCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = null;
    this._hass = null;
    this._entityOptionsKey = "";
    // UI-only state, never saved to config: which rules are collapsed.
    // null means "not yet initialized" - see setConfig.
    this._collapsedRules = null;
  }

  setConfig(config) {
    this._config = {
      name: "HA Event Effect Card",
      enabled: true,
      allow_multiple_effects: true,
      respect_reduced_motion: true,
      performance_mode: false,
      intensity: 60,
      rules: [],
      ...clone(config || {}),
    };

    const rules = Array.isArray(this._config.rules) ? this._config.rules : [];

    if (this._collapsedRules === null) {
      // First time this editor sees a config: start every existing rule
      // collapsed so the list opens tidy. Rules added afterward via
      // "+ Add rule" are pushed already-expanded (see the addRule handler)
      // before this branch would ever see them again.
      this._collapsedRules = rules.map(() => true);
    } else if (this._collapsedRules.length !== rules.length) {
      // Reconcile after some external change to rule count: keep whatever
      // per-rule state we already tracked for the rules still present at
      // the front, and default anything beyond that to expanded.
      this._collapsedRules = rules.map((_, i) =>
        i < this._collapsedRules.length ? this._collapsedRules[i] : false
      );
    }

    this._render();
  }

  set hass(hass) {
    this._hass = hass;

    const key = Object.keys(hass?.states || {})
      .filter(
        (id) =>
          id.startsWith("calendar.") ||
          id.startsWith("input_boolean.") ||
          id.startsWith("switch.") ||
          id.startsWith("binary_sensor.") ||
          id.startsWith("weather.")
      )
      .sort()
      .join("|");

    // Only rebuild the editor when available entity options change. This
    // prevents typing interruptions during normal HA state refreshes.
    if (key !== this._entityOptionsKey) {
      this._entityOptionsKey = key;
      this._render();
    }
  }

  get hass() {
    return this._hass;
  }

  _entitiesByDomains(domains) {
    return Object.keys(this._hass?.states || {})
      .filter((id) => domains.some((domain) => id.startsWith(`${domain}.`)))
      .map((id) => ({
        id,
        name: this._hass.states[id]?.attributes?.friendly_name || id,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  _calendars() {
    return this._entitiesByDomains(["calendar"]);
  }

  _enableEntities() {
    return this._entitiesByDomains(["input_boolean", "switch"]);
  }

  _switchTriggerEntities() {
    return this._entitiesByDomains(["switch", "input_boolean", "binary_sensor"]);
  }

  _weatherEntities() {
    return this._entitiesByDomains(["weather"]);
  }

  _render() {
    if (!this.shadowRoot || !this._config) return;

    const calendars = this._calendars();
    const enableEntities = this._enableEntities();
    const switchEntities = this._switchTriggerEntities();
    const weatherEntities = this._weatherEntities();
    const rules = Array.isArray(this._config.rules) ? this._config.rules : [];

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          color: var(--primary-text-color);
          font-family: var(--paper-font-body1_-_font-family, sans-serif);
        }

        .wrap {
          display: grid;
          gap: 14px;
          padding: 4px 0 8px;
        }

        .section {
          border: 1px solid var(--divider-color, #ddd);
          border-radius: 12px;
          padding: 14px;
          background: var(--card-background-color, #fff);
        }

        .heading {
          font-weight: 700;
          font-size: 15px;
          margin-bottom: 10px;
        }

        .grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        label {
          display: grid;
          gap: 5px;
          font-size: 12px;
          color: var(--secondary-text-color, #666);
        }

        input[type="text"],
        input[type="number"],
        select,
        textarea {
          width: 100%;
          box-sizing: border-box;
          border: 1px solid var(--divider-color, #bbb);
          border-radius: 9px;
          background: var(--card-background-color, #fff);
          color: var(--primary-text-color, #222);
          padding: 9px 10px;
          font: inherit;
        }

        textarea {
          min-height: 72px;
          resize: vertical;
        }

        select[multiple] {
          min-height: 112px;
        }

        .toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--primary-text-color);
          font-size: 14px;
        }

        .effects {
          display: flex;
          flex-wrap: wrap;
          gap: 10px 14px;
          margin-top: 8px;
        }

        .effects label {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--primary-text-color);
          font-size: 13px;
        }

        .rule {
          border-left: 4px solid var(--primary-color, #03a9f4);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .subheading {
          font-weight: 700;
          font-size: 12.5px;
          text-transform: uppercase;
          letter-spacing: .02em;
          color: var(--secondary-text-color, #777);
          margin-top: 6px;
          padding-top: 8px;
          border-top: 1px solid var(--divider-color, #eee);
        }

        .rule > .subheading:first-of-type {
          border-top: 0;
          padding-top: 0;
        }

        .trigger-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding: 10px 12px;
          border: 1px solid var(--divider-color, #eee);
          border-radius: 8px;
          background: var(--secondary-background-color, rgba(127, 127, 127, 0.04));
        }

        /* The [hidden] attribute is how JS toggles which single trigger
           section shows. Author CSS beats the browser's built-in
           "[hidden] { display:none }" default regardless of specificity,
           so without this explicit override the display:flex above would
           always win and every section would stay visible. */
        .trigger-section[hidden] {
          display: none;
        }

        .checklist {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 4px 10px;
          max-height: 140px;
          overflow-y: auto;
          padding: 8px 10px;
          border: 1px solid var(--divider-color, #ccc);
          border-radius: 8px;
        }

        .checklist-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12.5px;
          color: var(--primary-text-color);
        }

        @media (max-width: 600px) {
          .checklist {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        .rulebar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .rule-toggle {
          display: flex;
          align-items: center;
          gap: 8px;
          background: none;
          border: 0;
          padding: 0;
          margin: 0;
          cursor: pointer;
          color: inherit;
          font: inherit;
          text-align: left;
          flex: 1;
          min-width: 0;
        }

        .rule-toggle .chevron {
          font-size: 12px;
          color: var(--secondary-text-color, #777);
          width: 1em;
          flex-shrink: 0;
        }

        .rule-toggle .rule-summary {
          font-weight: 400;
          font-size: 12.5px;
          color: var(--secondary-text-color, #777);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .rule-body {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Same specificity fix as .trigger-section[hidden] above: without
           this, the display:flex on .rule-body would always beat the
           browser's default [hidden] styling and the body would never
           actually collapse. */
        .rule-body[hidden] {
          display: none;
        }

        button {
          border: 0;
          border-radius: 9px;
          padding: 9px 12px;
          background: var(--primary-color, #03a9f4);
          color: var(--text-primary-color, #fff);
          cursor: pointer;
          font-weight: 600;
        }

        button.danger {
          background: var(--error-color, #db4437);
        }

        .help {
          font-size: 12px;
          line-height: 1.4;
          color: var(--secondary-text-color, #777);
          margin-top: 5px;
        }

        @media (max-width: 600px) {
          .grid {
            grid-template-columns: 1fr;
          }
        }
      </style>

      <div class="wrap">
        <div class="section">
          <div class="heading">Card settings</div>

          <div class="grid">
            <label>
              Friendly name
              <input id="name" type="text" value="${esc(this._config.name || "")}">
            </label>

            <label>
              Enable/disable entity (optional)
              <select id="enable_entity">
                <option value="">Always controlled by card setting</option>
                ${enableEntities
                  .map(
                    (entity) => `
                      <option value="${esc(entity.id)}" ${
                      entity.id === this._config.enable_entity ? "selected" : ""
                    }>
                        ${esc(entity.name)} — ${esc(entity.id)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>

            <label>
              Intensity (10–100)
              <input
                id="intensity"
                type="number"
                min="10"
                max="100"
                step="5"
                value="${Number(this._config.intensity ?? 60)}"
              >
            </label>
          </div>

          <div class="effects">
            <label>
              <input id="enabled" type="checkbox" ${
                this._config.enabled !== false ? "checked" : ""
              }>
              Card enabled
            </label>

            <label>
              <input id="allow_multiple_effects" type="checkbox" ${
                this._config.allow_multiple_effects !== false ? "checked" : ""
              }>
              Allow multiple effects together
            </label>

            <label>
              <input id="respect_reduced_motion" type="checkbox" ${
                this._config.respect_reduced_motion !== false ? "checked" : ""
              }>
              Respect reduced-motion setting
            </label>

            <label>
              <input id="performance_mode" type="checkbox" ${
                this._config.performance_mode ? "checked" : ""
              }>
              Performance mode (lower-power devices)
            </label>
          </div>

          <div class="help">
            The optional entity is ideal for an <code>input_boolean</code>
            such as "Dashboard Effects Enabled". Performance mode caps the
            canvas resolution and cuts particle counts by about 40% -
            useful on Raspberry Pi-class wall tablets or older hardware
            driving the dashboard.
          </div>
        </div>

        <div class="section">
          <div class="rulebar">
            <div class="heading" style="margin:0">Event rules</div>
            <button id="addRule">+ Add rule</button>
          </div>

          <div class="help">
            Each rule can watch several calendars. Put one event phrase per
            line. Leave the match box blank to match any active event.
            Click a rule's title to expand or collapse it — existing rules
            start collapsed, new ones start open.
          </div>
        </div>

        ${rules
          .map((rule, index) =>
            this._ruleHtml(
              rule,
              index,
              calendars,
              switchEntities,
              weatherEntities,
              Boolean(this._collapsedRules?.[index])
            )
          )
          .join("")}
      </div>
    `;

    this._bind();
  }

  _ruleHtml(rule, index, calendars, switchEntities, weatherEntities, collapsed) {
    const selectedCalendars = new Set(Array.isArray(rule.calendars) ? rule.calendars : []);
    const selectedEffects = new Set(Array.isArray(rule.effects) ? rule.effects : []);
    const selectedSwitches = new Set(
      Array.isArray(rule.switch_entities) ? rule.switch_entities : []
    );
    const selectedConditions = new Set(
      Array.isArray(rule.weather_conditions) ? rule.weather_conditions : []
    );
    const triggerType = ruleTriggerType(rule);

    const triggerSummary = { calendar: "📅 Calendar", weather: "⛅ Weather", switch: "🔘 Switch" }[
      triggerType
    ];
    const effectsSummary = selectedEffects.size
      ? [...selectedEffects].map((effect) => EFFECT_LABELS[effect] || effect).join(", ")
      : "no effects yet";

    return `
      <div class="section rule" data-rule="${index}">
        <div class="rulebar">
          <button class="rule-toggle" data-index="${index}" aria-expanded="${!collapsed}">
            <span class="chevron">${collapsed ? "▸" : "▾"}</span>
            <span class="heading" style="margin:0">Rule ${index + 1}</span>
            ${
              collapsed
                ? `<span class="rule-summary">${triggerSummary} — ${esc(effectsSummary)}</span>`
                : ""
            }
          </button>

          <div style="display:flex;gap:10px;align-items:center;">
            <label class="toggle">
              <input class="rule-enabled" type="checkbox" ${
                rule.enabled !== false ? "checked" : ""
              }>
              Enabled
            </label>

            <button class="danger removeRule" data-index="${index}">Remove</button>
          </div>
        </div>

        <div class="rule-body" ${collapsed ? "hidden" : ""}>
        <div class="subheading">✨ Effects</div>
        <div class="effects">
          ${EFFECTS.map(
            (effect) => `
              <label>
                <input class="effect" data-effect="${effect}" type="checkbox" ${
              selectedEffects.has(effect) ? "checked" : ""
            }>
                ${EFFECT_LABELS[effect] || effect}
              </label>
            `
          ).join("")}
        </div>

        ${
          selectedEffects.has("emoji-rain")
            ? `
              <label>
                Emoji Rain glyphs — separate multiple with spaces or commas
                <input
                  class="emoji_rain_glyphs"
                  type="text"
                  placeholder="🎉 🎂 🎓"
                  value="${esc(rule.emoji_rain_glyphs || "")}"
                >
              </label>
              <div class="help">
                Each falling glyph is picked at random from this list. Leave
                blank to use a default set (🎉 ✨ 🎊 ⭐).
              </div>
            `
            : `<input class="emoji_rain_glyphs" type="hidden" value="${esc(
                rule.emoji_rain_glyphs || ""
              )}">`
        }

        <div class="subheading">🎯 Trigger type</div>
        <label>
          This rule fires when…
          <select class="trigger_type">
            <option value="calendar" ${triggerType === "calendar" ? "selected" : ""}>
              📅 A calendar event is active
            </option>
            <option value="weather" ${triggerType === "weather" ? "selected" : ""}>
              ⛅ A weather condition or attribute matches
            </option>
            <option value="switch" ${triggerType === "switch" ? "selected" : ""}>
              🔘 A switch / input_boolean / binary_sensor is in a state
            </option>
          </select>
        </label>
        <div class="help">
          Pick one trigger type per rule. Add another rule (with the same
          effects) if you want more than one way to trigger the same
          effect.
        </div>

        <div class="trigger-section" data-type="calendar" ${
          triggerType !== "calendar" ? "hidden" : ""
        }>
          <div class="grid">
            <label>
              Calendars
              <select class="calendars" multiple>
                ${calendars
                  .map(
                    (calendar) => `
                      <option value="${esc(calendar.id)}" ${
                      selectedCalendars.has(calendar.id) ? "selected" : ""
                    }>
                        ${esc(calendar.name)} — ${esc(calendar.id)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>

            <label>
              Event phrase(s)
              <textarea class="match" placeholder="Birthday&#10;Anniversary">${esc(
                rule.match || ""
              )}</textarea>
            </label>

            <label>
              Match type
              <select class="match_type">
                ${[
                  ["contains", "Contains"],
                  ["exact", "Exact"],
                  ["regex", "Regular expression"],
                  ["any", "Any event"],
                ]
                  .map(
                    ([value, name]) => `
                      <option value="${value}" ${
                      value === (rule.match_type || "contains") ? "selected" : ""
                    }>${name}</option>
                    `
                  )
                  .join("")}
              </select>
            </label>

            <label>
              Search field
              <select class="field">
                ${[
                  ["summary", "Event title / summary"],
                  ["description", "Description"],
                  ["location", "Location"],
                  ["any", "Title + description + location"],
                ]
                  .map(
                    ([value, name]) => `
                      <option value="${value}" ${
                      value === (rule.field || "summary") ? "selected" : ""
                    }>${name}</option>
                    `
                  )
                  .join("")}
              </select>
            </label>
          </div>
        </div>

        <div class="trigger-section" data-type="weather" ${
          triggerType !== "weather" ? "hidden" : ""
        }>
          <div class="grid">
            <label>
              Weather entity
              <select class="weather_entity">
                <option value="">— none —</option>
                ${weatherEntities
                  .map(
                    (entity) => `
                      <option value="${esc(entity.id)}" ${
                      rule.weather_entity === entity.id ? "selected" : ""
                    }>
                        ${esc(entity.name)} — ${esc(entity.id)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>
          </div>

          <label>
            Condition(s) — leave all unchecked to ignore condition
            <div class="checklist weather-conditions">
              ${WEATHER_CONDITIONS.map(
                (condition) => `
                  <label class="checklist-item">
                    <input
                      type="checkbox"
                      class="weather_condition"
                      data-condition="${condition}"
                      ${selectedConditions.has(condition) ? "checked" : ""}
                    >
                    ${condition}
                  </label>
                `
              ).join("")}
            </div>
          </label>

          <div class="grid">
            <label>
              Attribute (optional)
              <select class="weather_attribute">
                <option value="">— none —</option>
                ${WEATHER_ATTRIBUTES.map(
                  ([value, name]) => `
                    <option value="${value}" ${
                    rule.weather_attribute === value ? "selected" : ""
                  }>${name}</option>
                  `
                ).join("")}
              </select>
            </label>

            <label>
              Operator
              <select class="weather_operator">
                ${WEATHER_OPERATORS.map(
                  ([value, name]) => `
                    <option value="${value}" ${
                    (rule.weather_operator || "<") === value ? "selected" : ""
                  }>${name}</option>
                  `
                ).join("")}
              </select>
            </label>

            <label>
              Value
              <input
                class="weather_value"
                type="number"
                step="any"
                placeholder="e.g. 32"
                value="${rule.weather_value ?? ""}"
              >
            </label>
          </div>
          <div class="help">
            If both a condition and an attribute are set, both must be
            true at once. Set only one to use it alone.
          </div>
        </div>

        <div class="trigger-section" data-type="switch" ${
          triggerType !== "switch" ? "hidden" : ""
        }>
          <div class="grid">
            <label>
              Switch / input_boolean / binary_sensor entities
              <select class="switch_entities" multiple>
                ${switchEntities
                  .map(
                    (entity) => `
                      <option value="${esc(entity.id)}" ${
                      selectedSwitches.has(entity.id) ? "selected" : ""
                    }>
                        ${esc(entity.name)} — ${esc(entity.id)}
                      </option>
                    `
                  )
                  .join("")}
              </select>
            </label>

            <label>
              Trigger when state equals
              <input
                class="switch_state"
                type="text"
                placeholder="on"
                value="${esc(rule.switch_state ?? "on")}"
              >
            </label>
          </div>
          <div class="help">
            Fires while <strong>any</strong> of the selected entities are
            currently in the given state (default "on" — works for
            switches, input_booleans, and binary_sensors alike).
          </div>
        </div>
        </div>
      </div>
    `;
  }

  _bind() {
    const root = this.shadowRoot;

    root.querySelector("#name")?.addEventListener("input", (event) =>
      this._patch({ name: event.target.value })
    );

    root.querySelector("#enable_entity")?.addEventListener("change", (event) =>
      this._patch({ enable_entity: event.target.value || undefined })
    );

    root.querySelector("#intensity")?.addEventListener("change", (event) =>
      this._patch({
        intensity: Math.max(10, Math.min(100, Number(event.target.value) || 60)),
      })
    );

    root.querySelector("#enabled")?.addEventListener("change", (event) =>
      this._patch({ enabled: event.target.checked })
    );

    root.querySelector("#allow_multiple_effects")?.addEventListener("change", (event) =>
      this._patch({ allow_multiple_effects: event.target.checked })
    );

    root.querySelector("#respect_reduced_motion")?.addEventListener("change", (event) =>
      this._patch({ respect_reduced_motion: event.target.checked })
    );

    root.querySelector("#performance_mode")?.addEventListener("change", (event) =>
      this._patch({ performance_mode: event.target.checked })
    );

    root.querySelector("#addRule")?.addEventListener("click", () => {
      const rules = clone(this._config.rules || []);
      rules.push({
        enabled: true,
        trigger_type: "calendar",
        calendars: [],
        match: "",
        match_type: "contains",
        field: "summary",
        weather_entity: "",
        weather_conditions: [],
        weather_attribute: "",
        weather_operator: "<",
        weather_value: "",
        switch_entities: [],
        switch_state: "on",
        effects: ["streamers"],
        emoji_rain_glyphs: "",
      });
      // New rules start expanded, per rule request: everything already on
      // the page stays collapsed, a rule you just added stays open.
      this._collapsedRules = [...(this._collapsedRules || []), false];
      this._patch({ rules }, true);
    });

    root.querySelectorAll(".removeRule").forEach((button) =>
      button.addEventListener("click", () => {
        const index = Number(button.dataset.index);
        const rules = clone(this._config.rules || []);
        rules.splice(index, 1);
        if (Array.isArray(this._collapsedRules)) {
          this._collapsedRules = this._collapsedRules.filter((_, i) => i !== index);
        }
        this._patch({ rules }, true);
      })
    );

    root.querySelectorAll(".rule-toggle").forEach((button) =>
      button.addEventListener("click", () => {
        const index = Number(button.dataset.index);
        if (!Array.isArray(this._collapsedRules)) return;
        this._collapsedRules[index] = !this._collapsedRules[index];
        this._render();
      })
    );

    root.querySelectorAll("[data-rule]").forEach((section) => {
      const index = Number(section.dataset.rule);

      const updateRule = (forceRerender = false) => {
        const rules = clone(this._config.rules || []);
        const rule = rules[index] || {};

        rule.enabled = section.querySelector(".rule-enabled").checked;
        rule.trigger_type = section.querySelector(".trigger_type").value || "calendar";

        rule.calendars = [...section.querySelector(".calendars").selectedOptions].map(
          (option) => option.value
        );
        rule.match = section.querySelector(".match").value;
        rule.match_type = section.querySelector(".match_type").value;
        rule.field = section.querySelector(".field").value;

        rule.switch_entities = [
          ...section.querySelector(".switch_entities").selectedOptions,
        ].map((option) => option.value);
        rule.switch_state = section.querySelector(".switch_state").value.trim() || "on";

        rule.weather_entity = section.querySelector(".weather_entity").value || undefined;
        rule.weather_conditions = [
          ...section.querySelectorAll(".weather_condition:checked"),
        ].map((input) => input.dataset.condition);
        rule.weather_attribute = section.querySelector(".weather_attribute").value || undefined;
        rule.weather_operator = section.querySelector(".weather_operator").value || "<";

        const rawWeatherValue = section.querySelector(".weather_value").value;
        rule.weather_value = rawWeatherValue === "" ? undefined : Number(rawWeatherValue);

        rule.effects = [...section.querySelectorAll(".effect:checked")].map(
          (input) => input.dataset.effect
        );
        rule.emoji_rain_glyphs = section.querySelector(".emoji_rain_glyphs")?.value || "";

        rules[index] = rule;
        this._patch({ rules }, forceRerender);
      };

      // The trigger-type select, and the "emoji-rain" effect checkbox
      // specifically, need a full re-render so their conditional fields
      // (trigger sections / the glyphs input) show or hide immediately;
      // every other field just patches the config in place (no re-render)
      // to avoid disrupting typing/focus.
      section.querySelectorAll("input,select,textarea").forEach((element) => {
        if (element.classList.contains("trigger_type")) return;
        if (element.classList.contains("effect") && element.dataset.effect === "emoji-rain") {
          return;
        }
        element.addEventListener(
          element.tagName === "TEXTAREA" ? "input" : "change",
          () => updateRule(false)
        );
      });

      section
        .querySelector(".trigger_type")
        ?.addEventListener("change", () => updateRule(true));

      section
        .querySelector('.effect[data-effect="emoji-rain"]')
        ?.addEventListener("change", () => updateRule(true));
    });
  }

  _patch(patch, rerender = false) {
    const next = { ...clone(this._config), ...patch };
    if (!next.enable_entity) delete next.enable_entity;

    this._config = next;

    const event = new Event("config-changed", { bubbles: true, composed: true });
    event.detail = { config: next };
    this.dispatchEvent(event);

    if (rerender) this._render();
  }
}

if (!customElements.get(CARD_TAG)) {
  customElements.define(CARD_TAG, HAEventEffectCard);
}

if (!customElements.get(EDITOR_TAG)) {
  customElements.define(EDITOR_TAG, HAEventEffectCardEditor);
}

window.customCards = window.customCards || [];

if (!window.customCards.some((card) => card.type === CARD_TAG)) {
  window.customCards.push({
    type: CARD_TAG,
    name: "HA Event Effect Card",
    description:
      "Full-dashboard fireworks, rain, snow, and streamers triggered by active calendar events.",
    preview: false,
  });
}

console.info(
  `%c HA EVENT EFFECT CARD %c v${VERSION} `,
  "color:white;background:#03a9f4;font-weight:700",
  "color:#03a9f4;background:#fff"
);

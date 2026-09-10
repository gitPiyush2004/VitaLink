/**
 * The opening title card: an articulated truck crossing the screen, once.
 *
 * ## Why it is allowed to exist in a project this severe about honesty
 *
 * Because it makes no claim. Everything else on screen is a number that has to
 * carry its origin; this is a wordmark on a lorry. The line it must not cross is
 * pretending to be a loading bar — a progress indicator that is really a timer
 * is a lie about the system's state, and this project has spent a lot of effort
 * not telling those.
 *
 * So it does not gate anything. The app is mounted and the session restore and
 * the eight overview fetches are all in flight underneath while it plays. Any
 * click or key removes it immediately, and `prefers-reduced-motion` skips it
 * before it ever renders — checked in JavaScript rather than CSS, because the
 * global reduce rule collapses animation durations to nothing and would leave a
 * motionless truck parked on the screen for five seconds.
 *
 * ## Why a tractor-trailer and not a van
 *
 * Because that is what actually moves pharmaceuticals between a plant and a
 * distribution centre. The silhouette carries the detail that says so: a
 * high-roof sleeper cab with a roof air deflector, a fifth-wheel coupling,
 * landing legs, side under-run guards and a tri-axle bogie at the rear. A
 * delivery van would say "parcels", which is the wrong scale for the problem
 * this system is about.
 *
 * ## The proportions are measured, not invented
 *
 * From a side-on photograph of a curtain-side artic: the tractor is a quarter
 * of the overall length, wheel diameter is a little over half the trailer's
 * body height, the trailer body is about five times longer than it is tall, and
 * the roof deflector — not the trailer — is the highest point. Getting those
 * four ratios right is most of what makes a flat drawing read as a real
 * vehicle; the rivets and door hinges do much less work than they look like
 * they do.
 *
 * ## Two coordinate facts worth knowing before editing
 *
 * The viewBox is cropped so its bottom edge is exactly the wheel contact line
 * (y=264). That means `bottom` in CSS puts the wheels on the road at *any*
 * rendered width, with no constant to re-derive when the size changes. The
 * ground shadow is therefore a CSS `drop-shadow` rather than an ellipse inside
 * the drawing, which would have needed room below that line.
 *
 * The truck faces left, so the tractor is at the left of the drawing and the
 * trailer extends right.
 */

import { useEffect } from 'react';

/** Overlay fade ends at 4.5s + 0.55s. Kept in step with `theme.css`. */
const SPLASH_MS = 5100;

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function Splash({ onDone }: { onDone: () => void }): React.ReactElement {
  useEffect(() => {
    const timer = window.setTimeout(onDone, SPLASH_MS);
    const skip = (): void => {
      onDone();
    };

    window.addEventListener('keydown', skip);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip);
    };
  }, [onDone]);

  return (
    <div className="vl-splash" onClick={onDone} role="presentation">
      <div className="vl-splash-stage">
        <div className="vl-splash-lane">
          <div className="vl-splash-road" />
          <div className="vl-splash-dashes" />
          <div className="vl-splash-truck">
            <ArticulatedTruck />
          </div>
        </div>
        <p className="vl-splash-word">VITALINK</p>
        <p className="vl-splash-tag">Pharmaceutical supply-chain control tower</p>
      </div>
      <span className="vl-splash-skip">click to skip</span>
    </div>
  );
}

/** Vertical seams in the curtain, at the spacing a real tensioner sits at. */
const CURTAIN_RIBS = Array.from({ length: 13 }, (_unused, index) => 344 + index * 48);

/** Amber side markers along the bottom rail, as the regulations require. */
const SIDE_MARKERS = [400, 560, 720, 880];

/** Steer, drive, then the three of the rear bogie. */
const AXLES = [150, 372, 738, 820, 902];

const WHEEL = { radius: 36, centreY: 228 };

function ArticulatedTruck(): React.ReactElement {
  return (
    <svg viewBox="0 0 1000 264" width="100%" fill="none" aria-hidden="true">
      <Paints />
      <Trailer />
      <Tractor />

      {/* Arches before wheels, so each sits in a dark recess rather than on top
          of the paintwork. */}
      {AXLES.map((cx) => (
        <path
          key={`arch${String(cx)}`}
          d={`M${String(cx - 38)} 210a38 38 0 0 1 76 0Z`}
          fill="#080c11"
        />
      ))}
      {AXLES.map((cx) => (
        <Wheel key={cx} cx={cx} />
      ))}

      <rect x="414" y="226" width="14" height="34" rx="2" fill="#0f141b" />
      <rect x="944" y="226" width="14" height="34" rx="2" fill="#0f141b" />
    </svg>
  );
}

function Paints(): React.ReactElement {
  return (
    <defs>
      <linearGradient id="vlCurtain" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#21486f" />
        <stop offset="0.55" stopColor="#16324f" />
        <stop offset="1" stopColor="#0c1c2d" />
      </linearGradient>
      <linearGradient id="vlCabPaint" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="0.55" stopColor="#eff3f8" />
        <stop offset="1" stopColor="#bcc8d6" />
      </linearGradient>
      <linearGradient id="vlTarp" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#4ae8d2" />
        <stop offset="1" stopColor="#12a294" />
      </linearGradient>
      <linearGradient id="vlGlass" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stopColor="#2b4759" />
        <stop offset="0.5" stopColor="#16242f" />
        <stop offset="1" stopColor="#0e1820" />
      </linearGradient>
      <linearGradient id="vlSteel" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#d3dbe4" />
        <stop offset="1" stopColor="#798797" />
      </linearGradient>
      {/* Tyres are lit from above, so the shading is offset upward. */}
      <radialGradient id="vlTyre" cx="0.42" cy="0.34" r="0.78">
        <stop offset="0" stopColor="#252c36" />
        <stop offset="0.62" stopColor="#151b23" />
        <stop offset="1" stopColor="#080b10" />
      </radialGradient>
    </defs>
  );
}

function Trailer(): React.ReactElement {
  return (
    <g>
      {/* Tarpaulin roof, in the accent — the one place the brand colour sits on
          the vehicle, the way a real livery puts it on the roof sheet. */}
      <rect x="296" y="38" width="694" height="24" rx="6" fill="url(#vlTarp)" />
      <rect x="302" y="42" width="682" height="4" rx="2" fill="#ffffff" opacity="0.28" />

      <rect x="300" y="58" width="686" height="138" fill="url(#vlCurtain)" />
      <rect x="300" y="58" width="686" height="138" stroke="#081522" strokeWidth="2" />

      {CURTAIN_RIBS.map((x) => (
        <path
          key={x}
          d={`M${String(x)} 64V190`}
          stroke="#ffffff"
          strokeOpacity="0.05"
          strokeWidth="3"
        />
      ))}
      {/* Tensioner buckles, where the curtain straps meet the rail. */}
      {CURTAIN_RIBS.map((x) => (
        <rect
          key={`buckle${String(x)}`}
          x={x - 4}
          y="182"
          width="8"
          height="12"
          rx="2"
          fill="#0a1a2a"
        />
      ))}

      <Livery />

      {/* Corner posts front and rear, and the door furniture on the back. */}
      <rect x="300" y="58" width="14" height="138" fill="#2a5480" opacity="0.75" />
      <rect x="968" y="58" width="18" height="138" fill="#2a5480" />
      <rect x="972" y="82" width="11" height="8" rx="2" fill="#93a8bd" />
      <rect x="972" y="164" width="11" height="8" rx="2" fill="#93a8bd" />

      <rect x="300" y="196" width="686" height="14" fill="#0a1826" />
      {SIDE_MARKERS.map((x) => (
        <rect key={x} x={x} y="198" width="20" height="9" rx="2" fill="#f2b134" opacity="0.85" />
      ))}

      <Runningear />
    </g>
  );
}

/**
 * Landing legs, side under-run guards and the rear under-run bar.
 *
 * The guards start clear of the legs on purpose. An earlier version ran them
 * straight through, and two horizontals crossing two verticals draws a hash
 * symbol — the eye reads the glyph before it reads the mechanism.
 */
function Runningear(): React.ReactElement {
  return (
    <g>
      <rect x="470" y="210" width="12" height="40" rx="2" fill="#3c4b5b" />
      <rect x="496" y="210" width="12" height="40" rx="2" fill="#3c4b5b" />
      <rect x="462" y="250" width="54" height="9" rx="3" fill="#2c3948" />
      <path d="M540 219h164M540 232h164" stroke="#3f4d5c" strokeWidth="5" strokeLinecap="round" />
      <rect x="912" y="236" width="74" height="12" rx="4" fill="#2c3948" />
    </g>
  );
}

/** The mark and the wordmark, sized and placed the way a real livery is. */
function Livery(): React.ReactElement {
  return (
    <g>
      <rect x="340" y="88" width="80" height="80" rx="19" fill="#2dd4bf" />
      <path
        d="M358 128h10l5-14 8 25 5-11h10"
        stroke="#052220"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="722"
        y="156"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="90"
        fontWeight="800"
        letterSpacing="3"
        fontFamily="var(--vl-font)"
      >
        VITALINK
      </text>
    </g>
  );
}

function Tractor(): React.ReactElement {
  return (
    <g>
      <rect x="52" y="206" width="372" height="16" fill="#18202a" />
      <rect x="310" y="186" width="104" height="22" rx="3" fill="#2b3644" />
      {/* Saddle tank. Kept dark and narrow: a wide pale one reads as a shelf
          bridging the cab to the drive axle rather than as a tank behind it. */}
      <rect x="272" y="192" width="88" height="38" rx="19" fill="#5c6875" />
      <rect x="274" y="198" width="84" height="4" rx="2" fill="#ffffff" opacity="0.28" />
      <path d="M300 192v38M330 192v38" stroke="#3d4753" strokeWidth="4" />
      <rect x="190" y="208" width="40" height="28" rx="3" fill="#212a35" />

      {/* Cab, then the roof deflector that fairs it into the taller trailer.
          The deflector reaches forward to the middle of the roof so it reads as
          one fairing with the cab, not as a box sitting on top of it. */}
      <path
        d="M262 210V56c0-9-7-16-17-16H88c-16 0-28 10-31 26L44 154c-3 18-3 34 0 46l2 10Z"
        fill="url(#vlCabPaint)"
        stroke="#93a2b3"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M114 40h148V12c0-6-4-10-11-10h-53c-8 0-15 3-20 9Z"
        fill="#eef2f7"
        stroke="#b6c2d0"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M262 40v170" stroke="#aab6c4" strokeWidth="2" />

      <Glazing />

      {/* Door seam, handle, side skirt. */}
      <path d="M188 56v154" stroke="#aeb9c7" strokeWidth="2" />
      <rect x="156" y="150" width="24" height="8" rx="4" fill="#8d9bab" />
      <rect x="50" y="196" width="164" height="14" fill="#c7d1dd" />

      {/* Mirror arm and head, headlamp, wrap-around bumper. */}
      <path d="M56 74H40" stroke="#75828f" strokeWidth="4" strokeLinecap="round" />
      <rect x="24" y="56" width="14" height="50" rx="6" fill="#28323d" />
      <rect x="40" y="168" width="24" height="21" rx="5" fill="#ffeec2" />
      <path
        d="M40 190h48v22H36c-6 0-10-4-10-10v-2c0-6 4-10 14-10Z"
        fill="#dfe6ee"
        stroke="#93a2b3"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </g>
  );
}

/** The door window with its low vision pane — the giveaway of a modern cab. */
function Glazing(): React.ReactElement {
  return (
    <g>
      <path d="M180 56v80H88l9-72c1-5 4-8 10-8Z" fill="url(#vlGlass)" />
      <path d="M180 56v80h-32V56Z" fill="#3c6076" opacity="0.32" />
      {/* The low vision pane sits at the FRONT of the door, level with the
          driver's knee. Set back in the middle of the panel it reads as a hole. */}
      <path d="M84 148h26v38H80Z" fill="url(#vlGlass)" />
      <path d="M58 60h54v10H56Z" fill="#28323d" />
    </g>
  );
}

/**
 * One wheel, spinning.
 *
 * The rotation is on an inner group with `transform-box: fill-box`, because the
 * outer group already owns a `translate` and a second transform on the same
 * element would replace it rather than compose with it.
 */
function Wheel({ cx }: { cx: number }): React.ReactElement {
  return (
    <g transform={`translate(${String(cx)} ${String(WHEEL.centreY)})`}>
      <circle r={WHEEL.radius} fill="url(#vlTyre)" />
      <circle
        r={WHEEL.radius - 2}
        fill="none"
        stroke="#000000"
        strokeOpacity="0.55"
        strokeWidth="3"
      />
      <circle r="20" fill="none" stroke="#0d1219" strokeWidth="7" />
      <g className="vl-wheel">
        <circle r="16" fill="url(#vlSteel)" />
        <circle r="16" fill="none" stroke="#5f6c7b" strokeWidth="1.5" />
        <circle r="5" fill="#6a7788" />
        {[0, 60, 120, 180, 240, 300].map((angle) => (
          <circle
            key={angle}
            cx={10 * Math.cos((angle * Math.PI) / 180)}
            cy={10 * Math.sin((angle * Math.PI) / 180)}
            r="2.6"
            fill="#5c6a7a"
          />
        ))}
      </g>
    </g>
  );
}

import { useId, useMemo } from "react";

/**
 * PulseSeal — the official Pulse IP mark.
 *
 * A guilloche (banknote-lathe) rosette whose geometry is derived deterministically
 * from the notarized document's SHA-256 fingerprint. Two counter-rotating
 * epitrochoid bands, a micro-text legend ring, a latent pulse trace and a
 * hash-locked code. Because every curve parameter is a function of the digest,
 * a mark lifted from one document will not verify against another, and the
 * line work is impractical to redraw or photocopy cleanly.
 */

type SealTone = "foil" | "ink";

interface PulseSealProps {
  /** Hex SHA-256 digest of the sealed document. */
  hash: string;
  /** Registry identifier printed in the legend ring. */
  legend?: string;
  /** Short code engraved under the wordmark. */
  code?: string;
  size?: number;
  tone?: SealTone;
  animated?: boolean;
  className?: string;
}

function byteAt(hash: string, index: number): number {
  const clean = hash.replace(/[^0-9a-f]/gi, "").padEnd(64, "0");
  const i = (index * 2) % clean.length;
  return parseInt(clean.slice(i, i + 2), 16);
}

/** Epitrochoid / hypotrochoid lathe curve, the classic guilloche primitive. */
function latheCurve(
  cx: number,
  cy: number,
  R: number,
  r: number,
  d: number,
  phase: number,
  steps = 720,
): string {
  const pts: string[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * Math.PI * 2;
    const k = (R - r) / r;
    const x = cx + (R - r) * Math.cos(t + phase) + d * Math.cos(k * (t + phase));
    const y = cy + (R - r) * Math.sin(t + phase) - d * Math.sin(k * (t + phase));
    pts.push(`${s === 0 ? "M" : "L"}${x.toFixed(2)} ${y.toFixed(2)}`);
  }
  return pts.join(" ") + " Z";
}

/** Cardioid-style rosette used for the inner lathe field. */
function rosetteCurve(
  cx: number,
  cy: number,
  base: number,
  petals: number,
  amp: number,
  phase: number,
  steps = 540,
): string {
  const pts: string[] = [];
  for (let s = 0; s <= steps; s++) {
    const t = (s / steps) * Math.PI * 2;
    const rad = base + amp * Math.sin(petals * t + phase);
    pts.push(
      `${s === 0 ? "M" : "L"}${(cx + rad * Math.cos(t)).toFixed(2)} ${(cy + rad * Math.sin(t)).toFixed(2)}`,
    );
  }
  return pts.join(" ") + " Z";
}

export function PulseSeal({
  hash,
  legend = "PULSE NOTARY REGISTRY",
  code,
  size = 260,
  tone = "foil",
  animated = false,
  className,
}: PulseSealProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const shortCode = (code ?? hash.slice(0, 12)).toUpperCase();

  const geometry = useMemo(() => {
    const outerBand = Array.from({ length: 9 }, (_, i) => {
      const r = 20 + (byteAt(hash, i) % 11);
      const d = 12 + (byteAt(hash, i + 9) % 16);
      return latheCurve(200, 200, 168, r, d, (i * Math.PI * 2) / 9);
    });

    const midBand = Array.from({ length: 7 }, (_, i) => {
      const r = 14 + (byteAt(hash, i + 18) % 9);
      const d = 9 + (byteAt(hash, i + 25) % 12);
      return latheCurve(200, 200, 128, r, d, -(i * Math.PI * 2) / 7);
    });

    const petals = 12 + (byteAt(hash, 30) % 9);
    const inner = Array.from({ length: 5 }, (_, i) =>
      rosetteCurve(200, 200, 74 - i * 6, petals, 7 + (byteAt(hash, 31 + i) % 6), (i * Math.PI) / petals),
    );

    // Latent pulse trace: an ECG-like line whose beats encode digest bytes.
    const beats = Array.from({ length: 24 }, (_, i) => byteAt(hash, i) / 255);
    const w = 128;
    const trace = beats
      .map((b, i) => {
        const x = 136 + (i / (beats.length - 1)) * w;
        const spike = i % 4 === 2 ? 1 : 0.22;
        const y = 214 - (b - 0.5) * 34 * spike;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

    return { outerBand, midBand, inner, trace };
  }, [hash]);

  const legendText = `${legend} \u2022 ${shortCode} \u2022 ZERO-TRUST CHAIN OF CUSTODY \u2022 `;
  const isFoil = tone === "foil";

  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      role="img"
      aria-label={`Pulse IP mark for document ${shortCode}`}
      className={className}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id={`foil-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brass-dim)" />
          <stop offset="38%" stopColor="var(--brass)" />
          <stop offset="52%" stopColor="oklch(0.95 0.06 88)" />
          <stop offset="70%" stopColor="var(--brass)" />
          <stop offset="100%" stopColor="var(--brass-dim)" />
        </linearGradient>
        <radialGradient id={`core-${uid}`} cx="50%" cy="42%">
          <stop offset="0%" stopColor={isFoil ? "oklch(0.28 0.02 252)" : "oklch(0.98 0.01 88)"} />
          <stop offset="100%" stopColor={isFoil ? "oklch(0.17 0.014 252)" : "oklch(0.94 0.015 88)"} />
        </radialGradient>
        <path
          id={`legendring-${uid}`}
          d="M 200 200 m -152 0 a 152 152 0 1 1 304 0 a 152 152 0 1 1 -304 0"
          fill="none"
        />
        <clipPath id={`disc-${uid}`}>
          <circle cx="200" cy="200" r="186" />
        </clipPath>
      </defs>

      <g
        stroke={isFoil ? `url(#foil-${uid})` : "var(--seal)"}
        fill="none"
        clipPath={`url(#disc-${uid})`}
      >
        {/* Outer guilloche band */}
        <g strokeWidth="0.55" opacity={isFoil ? 0.75 : 0.62}>
          {geometry.outerBand.map((d, i) => (
            <path key={`o${i}`} d={d} />
          ))}
        </g>

        {/* Counter-rotating mid band */}
        <g strokeWidth="0.45" opacity={isFoil ? 0.6 : 0.5}>
          {geometry.midBand.map((d, i) => (
            <path key={`m${i}`} d={d} />
          ))}
        </g>
      </g>

      {/* Rule circles */}
      <g fill="none" stroke={isFoil ? `url(#foil-${uid})` : "var(--seal)"}>
        <circle cx="200" cy="200" r="186" strokeWidth="2.2" />
        <circle cx="200" cy="200" r="178" strokeWidth="0.7" opacity="0.8" />
        <circle cx="200" cy="200" r="164" strokeWidth="0.7" opacity="0.55" />
        <circle cx="200" cy="200" r="140" strokeWidth="1.4" />
        <circle cx="200" cy="200" r="96" strokeWidth="1.1" />
        <circle cx="200" cy="200" r="90" strokeWidth="0.5" opacity="0.7" />
      </g>

      {/* Inner lathe rosette */}
      <circle cx="200" cy="200" r="90" fill={`url(#core-${uid})`} />
      <g
        fill="none"
        stroke={isFoil ? `url(#foil-${uid})` : "var(--seal)"}
        strokeWidth="0.5"
        opacity={isFoil ? 0.55 : 0.45}
      >
        {geometry.inner.map((d, i) => (
          <path key={`i${i}`} d={d} />
        ))}
      </g>

      {/* Micro-text legend ring */}
      <text
        fill={isFoil ? "var(--brass)" : "var(--seal)"}
        fontFamily="var(--font-mono)"
        fontSize="8.6"
        letterSpacing="2.1"
        opacity="0.95"
      >
        <textPath href={`#legendring-${uid}`} startOffset="0">
          {legendText.repeat(3).slice(0, 118)}
        </textPath>
      </text>

      {/* Pulse trace */}
      <path
        d={geometry.trace}
        fill="none"
        stroke={isFoil ? "var(--verdigris)" : "var(--seal)"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={isFoil ? 0.95 : 0.7}
        style={
          animated
            ? { strokeDasharray: 240, animation: "var(--animate-trace)" }
            : undefined
        }
      />

      {/* Wordmark */}
      <text
        x="200"
        y="182"
        textAnchor="middle"
        fill={isFoil ? "var(--brass)" : "var(--seal)"}
        fontFamily="var(--font-display)"
        fontSize="30"
        letterSpacing="1"
      >
        PULSE
      </text>
      <text
        x="200"
        y="236"
        textAnchor="middle"
        fill={isFoil ? "var(--brass-dim)" : "var(--ink-muted)"}
        fontFamily="var(--font-mono)"
        fontSize="8.2"
        letterSpacing="2.4"
      >
        CERTIFIED NOTARY
      </text>
      <text
        x="200"
        y="252"
        textAnchor="middle"
        fill={isFoil ? "var(--verdigris)" : "var(--seal)"}
        fontFamily="var(--font-mono)"
        fontSize="10"
        letterSpacing="1.6"
      >
        {shortCode}
      </text>

      {/* Registration ticks */}
      <g stroke={isFoil ? "var(--brass-dim)" : "var(--seal)"} strokeWidth="1.4">
        {Array.from({ length: 72 }, (_, i) => {
          const a = (i / 72) * Math.PI * 2;
          const long = i % 6 === 0;
          const r1 = long ? 168 : 173;
          return (
            <line
              key={`t${i}`}
              x1={200 + r1 * Math.cos(a)}
              y1={200 + r1 * Math.sin(a)}
              x2={200 + 178 * Math.cos(a)}
              y2={200 + 178 * Math.sin(a)}
              opacity={long ? 0.9 : 0.4}
            />
          );
        })}
      </g>
    </svg>
  );
}

export default PulseSeal;

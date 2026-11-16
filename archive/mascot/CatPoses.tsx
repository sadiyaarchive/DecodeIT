import { useId } from "react"

/*
 * Static mascot art for review. Nothing here is animated yet.
 *
 * One cat, one head. Every pose places the same <CatHead> (tall left ear, shorter
 * right ear with the bow, mismatched round eyes), so the character cannot drift
 * between poses. Bodies are solid black shapes; the only other marks are white
 * eyes, a tiny white nose and the white notch on the bow.
 *
 * Poses draw in a 240 x 200 frame. Yarn is flat: a rose gradient ball with
 * strand lines in --strand.
 */

const INK = "#111111"
const WHITE = "#ffffff"
const GRAD_A = "#C98291"
const GRAD_B = "#F0C8D0"
const STRAND = "#7E3A4B"

type Look = [number, number]

/** The head, centred on 0,0 and about 56 wide. Place it with a transform. */
export function CatHead({
  look = [0, 0],
  closed = false,
  narrow = false,
  simpleBow = false,
}: {
  look?: Look
  closed?: boolean
  narrow?: boolean
  simpleBow?: boolean
}) {
  const [lx, ly] = look
  return (
    <g>
      <path
        fill={INK}
        d="M-27 -2 C-28 -16 -25 -28 -20 -41 L-8 -27 C-3 -29 5 -29 11 -26 L21 -35 C26 -26 28 -14 27 -2 C28 16 14 26 0 26 C-14 26 -26 16 -27 -2 Z"
      />
      {/* ear bow: black loops sit over the right ear, the white outline is the notch that separates them from it */}
      <g
        transform="translate(28.5 -15) rotate(26) scale(0.66)"
        fill={INK}
        stroke={WHITE}
        strokeWidth="2"
        strokeLinejoin="round"
        paintOrder="stroke"
      >
        {!simpleBow && <path d="M-2 3 L-8 19 L0 14 Z" />}
        {!simpleBow && <path d="M2 3 L8 19 L0 14 Z" />}
        <path d="M0 0 C-12 -12 -26 -8 -24 1 C-26 10 -12 12 0 0 Z" />
        <path d="M0 0 C12 -12 26 -8 24 1 C26 10 12 12 0 0 Z" />
        <circle r="4.8" />
      </g>
      {closed ? (
        <g fill="none" stroke={WHITE} strokeWidth="2.6" strokeLinecap="round">
          <path d="M-17 2 C-13 7 -7 7 -3 2" />
          <path d="M5 0 C9 5 15 5 18 0" />
        </g>
      ) : (
        <g>
          <ellipse cx="-10" cy="1" rx="8.4" ry={narrow ? 5.2 : 8.4} fill={WHITE} />
          <ellipse cx="11.5" cy="-1" rx="7.4" ry={narrow ? 4.6 : 7.4} fill={WHITE} />
          <circle cx={-10 + lx} cy={1 + ly} r="3.5" fill={INK} />
          <circle cx={11.5 + lx} cy={-1 + ly} r="3.2" fill={INK} />
        </g>
      )}
      <path d="M-2.4 12 L2.4 12 L0 15.6 Z" fill={WHITE} />
    </g>
  )
}

/** Thick round-capped stroke used for tails and stubby legs. */
function Stroke({ d, w }: { d: string; w: number }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={INK}
      strokeWidth={w}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

/** Sitting, head turned toward us. `thinking` tilts the head and glances up-left. */
export function SitPose({ thinking = false }: { thinking?: boolean }) {
  return (
    <g>
      <Stroke
        w={11}
        d="M72 184 C44 190 30 166 36 142 C40 126 52 114 46 100 C42 90 54 82 62 88 C68 93 64 102 58 100"
      />
      <path
        fill={INK}
        d="M92 98 C70 118 56 148 62 172 C66 184 84 190 108 190 C142 190 158 182 154 160 C151 136 128 118 118 98 Z"
      />
      <ellipse cx="86" cy="188" rx="12" ry="5.5" fill={INK} />
      <g
        transform={
          thinking
            ? "translate(104 72) rotate(-13) scale(1.12)"
            : "translate(104 74) rotate(4) scale(1.12)"
        }
      >
        <CatHead look={thinking ? [-2.4, -2.6] : [2.4, 1.4]} />
      </g>
    </g>
  )
}

/** Mid-pounce, facing left toward the comment, tail a question mark. */
export function RunPose() {
  return (
    <g>
      <Stroke
        w={10}
        d="M180 112 C204 108 206 84 192 78 C178 72 178 56 192 52 C201 50 206 57 201 62"
      />
      <Stroke w={11} d="M168 134 C184 142 198 146 214 142" />
      <Stroke w={11} d="M152 138 C168 150 184 158 200 157" />
      <path
        fill={INK}
        d="M80 114 C98 92 150 90 178 108 C194 118 188 136 172 140 C150 146 112 144 92 138 C78 132 72 122 80 114 Z"
      />
      <Stroke w={11} d="M88 132 C72 138 56 146 44 158" />
      <Stroke w={11} d="M100 138 C88 150 78 158 62 164" />
      <g transform="translate(66 108) rotate(-14) scale(1.12)">
        <CatHead look={[-3, 0.6]} narrow />
      </g>
    </g>
  )
}

/** Low and flat, chin down, eyes locked on the yarn to the right. */
export function LoungePose() {
  return (
    <g>
      <Stroke
        w={11}
        d="M54 184 C28 190 14 166 22 144 C28 128 40 120 34 106 C30 96 42 90 50 96 C56 101 52 108 46 106"
      />
      <path
        fill={INK}
        d="M52 188 C44 160 78 142 128 142 C168 142 176 156 168 188 Z"
      />
      <Stroke w={11} d="M148 176 C164 182 180 184 196 182" />
      <g transform="translate(150 150) rotate(16) scale(1.1)">
        <CatHead look={[3.2, 2.6]} />
      </g>
    </g>
  )
}

/** Curled loaf, head down on the paws, eyes shut, tail laid round the front. */
export function SleepPose() {
  return (
    <g>
      <path
        fill={INK}
        d="M44 188 C36 150 76 126 130 128 C184 130 214 152 206 188 Z"
      />
      <Stroke
        w={11}
        d="M194 184 C222 186 232 162 222 144 C216 132 226 120 236 126 C242 130 238 138 232 136"
      />
      <g transform="translate(76 156) rotate(-10) scale(1.1)">
        <CatHead closed />
      </g>
    </g>
  )
}

/** Flat rose yarn. `tangled` has loose looping threads; `wound` is tidy bands. */
export function YarnArt({
  kind,
  x = 0,
  y = 0,
  s = 1,
}: {
  kind: "tangled" | "wound"
  x?: number
  y?: number
  s?: number
}) {
  const id = useId()
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={GRAD_A} />
          <stop offset="1" stopColor={GRAD_B} />
        </linearGradient>
      </defs>
      <circle r="22" fill={`url(#${id})`} />
      {kind === "wound" ? (
        <g
          fill="none"
          stroke={STRAND}
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M-18 -9 Q0 -19 18 -9" />
          <path d="M-21 -1 Q0 -11 21 -1" />
          <path d="M-20 8 Q0 -2 20 8" />
          <path d="M-12 17 Q0 11 12 17" />
          <path d="M20 14 C26 20 24 28 16 29" />
        </g>
      ) : (
        <g
          fill="none"
          stroke={STRAND}
          strokeWidth="2"
          strokeLinecap="round"
        >
          <path d="M-18 -9 Q0 -19 18 -9" />
          <path d="M-20 6 Q0 -4 21 4" />
          <path d="M-12 17 Q0 10 12 17" />
          <path d="M-8 -22 C-30 -44 14 -52 14 -28" />
          <path d="M20 -10 C42 -22 52 6 30 14 C18 19 10 8 22 4" />
          <path d="M-22 4 C-44 8 -42 32 -22 30 C-8 29 -6 20 -14 18" />
        </g>
      )}
    </g>
  )
}

/** Thread trailing from the yarn. */
export function Thread({ d }: { d: string }) {
  return (
    <path
      d={d}
      fill="none"
      stroke={STRAND}
      strokeWidth="2.4"
      strokeLinecap="round"
    />
  )
}

/** Header icon: head, shoulders, bow and the question-mark tail in a square. */
export function CatChip({ size = 40 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      role="img"
      aria-label="Cat mascot"
    >
      <Stroke w={10} d="M66 94 C86 96 94 76 84 66 C76 58 66 66 72 72" />
      <path
        fill={INK}
        d="M30 62 C20 76 18 92 28 97 C38 100 58 100 68 96 C74 86 66 70 62 62 Z"
      />
      <g transform="translate(46 40) scale(1.28)">
        <CatHead look={[1.6, 1]} simpleBow />
      </g>
    </svg>
  )
}

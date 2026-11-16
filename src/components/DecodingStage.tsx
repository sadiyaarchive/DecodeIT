import { useEffect, useState } from 'react';

const STATUS_MESSAGES = [
  'Reading between the lines…',
  'Finding the signal…',
  'Connecting feedback to design…',
] as const;

const MESSAGE_MS = 2200;

// Three lines of text-like fragments (width in px). They start scattered, then a thin scan mark passes
// over and each fragment settles into order. `key` marks the few that resolve to the purple accent.
const LINES: { w: number; dx: number; dy: number; key?: true }[][] = [
  [
    { w: 34, dx: -12, dy: -3 },
    { w: 52, dx: 9, dy: 2, key: true },
    { w: 22, dx: -7, dy: 3 },
    { w: 48, dx: 11, dy: -2 },
  ],
  [
    { w: 58, dx: 8, dy: 3 },
    { w: 30, dx: -10, dy: -2 },
    { w: 44, dx: 6, dy: 3 },
    { w: 20, dx: -9, dy: -3, key: true },
  ],
  [
    { w: 26, dx: -8, dy: 2 },
    { w: 62, dx: 12, dy: -3, key: true },
    { w: 38, dx: -6, dy: 2 },
  ],
];

const GAP = 6;
const WIDTH = 196;

interface Props {
  slow: boolean;
  onCancel: () => void;
}

export function DecodingStage({ slow, onCancel }: Props) {
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx((i) => (i + 1) % STATUS_MESSAGES.length), MESSAGE_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="work" aria-label="Decoding your feedback">
      <div className="decode-mark" role="progressbar" aria-label="Decoding feedback" style={{ width: WIDTH }}>
        <span className="decode-scan" aria-hidden />
        {LINES.map((line, row) => {
          let x = 0;
          return (
            <div className="decode-line" key={row} aria-hidden>
              {line.map((seg, i) => {
                // Settle just after the scan mark passes this fragment.
                const delay = Math.round((x / WIDTH) * 1100 + row * 90);
                x += seg.w + GAP;
                return (
                  <span
                    key={i}
                    className="decode-frag"
                    data-key={seg.key || undefined}
                    style={{ width: seg.w, ['--dx' as string]: `${seg.dx}px`, ['--dy' as string]: `${seg.dy}px`, animationDelay: `${delay}ms` }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      <p className="work-status" key={slow ? 'slow' : msgIdx}>
        {slow ? 'This is taking longer than usual. You can cancel and try again. Your feedback is kept.' : STATUS_MESSAGES[msgIdx]}
      </p>

      <button type="button" className="mini work-cancel" onClick={onCancel}>
        Cancel
      </button>
    </section>
  );
}

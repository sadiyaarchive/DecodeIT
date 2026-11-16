import { forwardRef } from 'react';
import { ArrowRight, Check, ChevronDown, Copy, Info } from 'lucide-react';
import type { DecodeResult } from '../lib/decoder';
import { describeDesign } from '../lib/design';
import type { DesignInput } from '../lib/design';

export interface Recap {
  design: Pick<DesignInput, 'kind' | 'name' | 'width' | 'height'>;
  previewUrl: string;
}

interface Props {
  result: DecodeResult;
  comment: string;
  recap: Recap;
  copied: string | null;
  onCopyQuestion: (q: string) => void;
}

/**
 * One reading of the result: what you gave, then three sections in order. The demo's wording makes
 * clear that none of this comes from looking at the design.
 */
export const Results = forwardRef<HTMLElement, Props>(function Results({ result, comment, recap, copied, onCopyQuestion }, ref) {
  return (
    <article ref={ref} tabIndex={-1} aria-label="Decoded result" className="res rise">
      <section className="res-context" aria-label="What we know">
        <div className="recap">
          <img className="thumb" src={recap.previewUrl} alt={`Design: ${describeDesign(recap.design)}`} />
          <div className="recap-body">
            <p className="quote">“{comment.trim()}”</p>
            <ul className="known" aria-label="What we know">
              {result.observed.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
        </div>
        {result.source.isDemo && (
          <p className="notice">
            <Info size={13} aria-hidden />
            <span>Demo example. This response is predefined and does not analyse your design.</span>
          </p>
        )}
      </section>

      <div className="surface">
        <section className="sec" aria-labelledby="sec-mean">
          <div className="sec-head">
            <h2 className="sec-title" id="sec-mean">
              What's behind it
            </h2>
            <span className="tag tag-outline">Guesses, not facts</span>
          </div>
          <p className="lead">{result.summary}</p>
          <ol className="readings">
            {result.interpretations.map((it, i) => (
              <li className="reading" key={it.label}>
                <span className="num" aria-hidden>
                  {i + 1}
                </span>
                <div className="reading-body">
                  <p className="reading-title">{it.label}</p>
                  <p className="reading-text">{it.meaning}</p>
                  <details className="disc reading-disc">
                    <summary>
                      <span>Why this reading</span>
                      <ChevronDown className="chev" size={13} aria-hidden />
                    </summary>
                    <div className="disc-body reading-disc-body">
                      <p className="eyebrow">Look for</p>
                      <ul className="look">
                        {it.issues.map((x) => (
                          <li key={x}>{x}</li>
                        ))}
                      </ul>
                      <p className="why">{it.why}</p>
                    </div>
                  </details>
                </div>
              </li>
            ))}
          </ol>
          <div className="assume">
            <p className="eyebrow">Assuming</p>
            <ul>
              {result.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="sec" aria-labelledby="sec-try">
          <div className="sec-head">
            <h2 className="sec-title" id="sec-try">
              What to try
            </h2>
          </div>
          {result.interpretations.map((it, i) => (
            <div className="steps" key={it.label}>
              <p className="steps-for">
                {i + 1} · {it.label}
              </p>
              <ul>
                {it.tries.map((t) => (
                  <li key={t}>
                    <ArrowRight size={13} aria-hidden />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>

        <section className="sec" aria-labelledby="sec-ask">
          <div className="sec-head">
            <h2 className="sec-title" id="sec-ask">
              What to ask
            </h2>
          </div>
          {result.questions.length > 0 ? (
            <ul className="asks">
              {result.questions.map((q) => (
                <li className="ask" key={q}>
                  <p>{q}</p>
                  <button type="button" className="btn btn-ghost btn-icon ask-copy" aria-label={copied === q ? 'Copied' : `Copy question: ${q}`} onClick={() => onCopyQuestion(q)}>
                    {copied === q ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="ask-none">No question needed: this feedback is specific enough to act on.</p>
          )}
        </section>
      </div>
    </article>
  );
});

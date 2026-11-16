import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Check, Info, RotateCcw } from 'lucide-react';
import { Button } from './components/Button';
import { DecodingStage } from './components/DecodingStage';
import { DesignContext, type Shot, type Source } from './components/DesignContext';
import { NotesField, Samples, type Notes } from './components/Disclosures';
import { Results, type Recap } from './components/Results';
import DevSwitch from './DevSwitch';
import { initialMode, providerFor, type ProviderMode } from './lib/active';
import { useConsent } from './lib/consent';
import { loadScreenshot } from './lib/design';
import type { DesignInput } from './lib/design';
import { MAX_COMMENT_LENGTH, type DecodeResult } from './lib/decoder';
import { sendToPlugin, useFigmaHost } from './lib/figma/host';
import { DEFAULT_LIMITS, describeError, runDecode, type ErrorCopy } from './lib/run';
import { simLimits } from './lib/simulate';
import { buildSummary } from './lib/summary';

type Phase = 'compose' | 'working' | 'result' | 'error';

const SUMMARY_KEY = '__summary__';
const NO_NOTES: Notes = { description: '', audience: '', goal: '' };

function App() {
  const { host, simulated, selection, selectionVersion, refresh } = useFigmaHost();

  const [comment, setComment] = useState('');
  const [notes, setNotes] = useState<Notes>(NO_NOTES);
  const [notesOpen, setNotesOpen] = useState(false);
  const [samplesOpen, setSamplesOpen] = useState(false);
  const [mode, setMode] = useState<ProviderMode>(initialMode);
  const consent = useConsent();
  const provider = providerFor(mode);
  // Live mode sends the design to our server and Gemini, so the first Decode doubles as an explicit "Agree".
  const needsAck = mode === 'live' && consent.accepted !== true;
  const [source, setSource] = useState<Source>('frame');
  const [shot, setShot] = useState<Shot | null>(null);
  const [shotBusy, setShotBusy] = useState(false);
  const [shotError, setShotError] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const [phase, setPhase] = useState<Phase>('compose');
  const [slow, setSlow] = useState(false);
  const [result, setResult] = useState<DecodeResult | null>(null);
  const [recap, setRecap] = useState<Recap | null>(null);
  const [errorInfo, setErrorInfo] = useState<ErrorCopy | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);
  const [announce, setAnnounce] = useState('');

  const runId = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const shotRef = useRef<Shot | null>(null);
  shotRef.current = shot;

  const working = phase === 'working';
  const feedbackValid = comment.trim().length > 0;
  const activeSource: Source = source;
  const frameValid = host === 'figma' && selection.kind === 'frame';
  const designValid = activeSource === 'frame' ? frameValid : !!shot;
  const blockedByError = phase === 'error' && !!errorInfo && !errorInfo.retryable;
  const ready = feedbackValid && designValid && !blockedByError;

  useEffect(() => {
    if (selectionVersion > 0 && host === 'figma') {
      setSource('frame');
    }
  }, [selectionVersion, host]);

  // Why the button is unavailable, in words.
  const reason = (() => {
    if (!feedbackValid && !designValid) return 'Add the feedback and the design to continue.';
    if (!feedbackValid) return 'Paste the feedback you received to continue.';
    if (!designValid) {
      if (activeSource === 'screenshot') return shotBusy ? 'Reading your image…' : 'Add a screenshot of the design to continue.';
      if (host !== 'figma') return host === 'pending' ? 'Connecting to Figma…' : 'Select a frame in Figma, or upload a screenshot to continue.';
      switch (selection.kind) {
        case 'multiple':
          return 'Select just one frame to continue.';
        case 'unsupported':
          return 'Select a frame, component or section to continue.';
        case 'loading':
          return 'Reading your frame…';
        case 'error':
          return 'Fix the frame problem, or use a screenshot instead.';
        default:
          return 'Select a frame in Figma to continue.';
      }
    }
    if (blockedByError) return 'Change the feedback to try again.';
    return '';
  })();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
    // The button that was focused is gone once results show, so move focus to them.
    if (phase === 'result') resultRef.current?.focus({ preventScroll: true });
  }, [phase]);

  useEffect(() => {
    document.title = 'Decode It';
  }, []);

  // Free the image and stop any request still running when the panel goes away.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (shotRef.current) URL.revokeObjectURL(shotRef.current.url);
    },
    [],
  );

  // Escape cancels a decode in progress.
  useEffect(() => {
    if (!working) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [working]);

  const focusFeedback = () => requestAnimationFrame(() => document.getElementById('feedback-input')?.focus());

  const attachFile = async (file: File | null | undefined) => {
    if (!file || working) return;
    setShotBusy(true);
    setShotError(null);
    const loaded = await loadScreenshot(file);
    setShotBusy(false);
    if (!loaded.ok) {
      setShotError(loaded.reason);
      return;
    }
    if (shotRef.current) URL.revokeObjectURL(shotRef.current.url);
    setShot({ name: file.name || 'Pasted image', width: loaded.width, height: loaded.height, url: loaded.url, file });
    setSource('screenshot');
  };

  const clearShot = () => {
    if (shot) URL.revokeObjectURL(shot.url);
    setShot(null);
    setShotError(null);
    setSource('frame');
  };

  /** Invalidates the run in flight and tells the provider to stop. */
  const stopRun = () => {
    runId.current++;
    abortRef.current?.abort();
    abortRef.current = null;
  };

  const currentDesign = (): DesignInput | null => {
    if (activeSource === 'frame' && selection.kind === 'frame') {
      return { kind: 'figma-frame', name: selection.name, width: selection.width, height: selection.height, image: selection.blob };
    }
    if (activeSource === 'screenshot' && shot) {
      return { kind: 'screenshot', name: shot.name, width: shot.width, height: shot.height, image: shot.file };
    }
    return null;
  };

  const decode = async () => {
    if (working) return;
    const design = currentDesign();
    if (!feedbackValid || !design || blockedByError) {
      // Do not submit, and show what is missing.
      setAttempted(true);
      if (!design) requestAnimationFrame(() => (document.getElementById('design-focus') ?? document.getElementById('design-focus-frame'))?.focus());
      else if (!feedbackValid) focusFeedback();
      return;
    }
    if (needsAck) consent.grant(); // pressing "Agree and decode" is the acknowledgement; remembered from now on
    abortRef.current?.abort();
    const id = ++runId.current;
    const alive = () => id === runId.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setResult(null);
    setCopied(null);
    setErrorInfo(null);
    setSlow(false);
    setPhase('working');
    setAnnounce('Finding the signal in the noise');

    const out = await runDecode({
      provider,
      request: { comment, design, context: notes },
      signal: controller.signal,
      ...(import.meta.env.DEV ? { ...DEFAULT_LIMITS, ...simLimits() } : DEFAULT_LIMITS),
      onSlow: () => {
        if (!alive()) return;
        setSlow(true);
        setAnnounce('Still working. This is taking longer than usual.');
      },
    });
    if (!alive() || out.status === 'cancelled') return;

    if (out.status === 'error') {
      const info = describeError(out.error);
      setErrorInfo(info);
      if (info.kind === 'no_match') setSamplesOpen(true);
      setAnnounce(`${info.title}. ${info.body}`);
      setPhase('error');
      return;
    }
    setRecap((old) => {
      if (old) URL.revokeObjectURL(old.previewUrl);
      return { design: { kind: design.kind, name: design.name, width: design.width, height: design.height }, previewUrl: URL.createObjectURL(design.image) };
    });
    setResult(out.result);
    setAnnounce(`Done: ${out.result.interpretations.length} possible readings.`);
    setPhase('result');
  };

  /** Keyboard shortcuts must not stand in for the first "Agree and decode" click. */
  const decodeFromKeyboard = () => {
    if (needsAck) document.getElementById('decode-btn')?.focus();
    else void decode();
  };

  const cancel = () => {
    stopRun();
    setPhase('compose');
    setSlow(false);
    setAnnounce('Cancelled. Your feedback is still here.');
    focusFeedback();
  };

  const backToEdit = () => {
    stopRun();
    setPhase('compose');
    focusFeedback();
  };

  const decodeAnother = () => {
    stopRun();
    setComment('');
    setResult(null);
    setPhase('compose');
    setAttempted(false);
    focusFeedback();
  };

  const startOver = () => {
    decodeAnother();
    setNotes(NO_NOTES);
    setNotesOpen(false);
    clearShot();
    setSource('frame');
    setErrorInfo(null);
  };

  const copyText = async (text: string, key: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      // Some embedded views block the clipboard API; try the legacy route.
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      ta.remove();
    }
    if (!ok) {
      setCopyFailed(true);
      setAnnounce("Couldn't copy. Select the text and copy it yourself.");
      setTimeout(() => setCopyFailed(false), 4000);
      return;
    }
    setCopyFailed(false);
    setCopied(key);
    setAnnounce('Copied to clipboard');
    sendToPlugin({ type: 'notify', text: 'Copied' });
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 2200);
  };

  const showSamples = phase === 'compose' || phase === 'error';
  const noMatch = errorInfo?.kind === 'no_match';

  return (
    <div
      className="shell"
      onPaste={(e) => {
        const file = Array.from(e.clipboardData.files).find((f) => f.type.startsWith('image/'));
        if (file && !working) {
          e.preventDefault();
          void attachFile(file);
        }
      }}
    >
      <p className="sr-only" role="status" aria-live="polite">
        {announce}
      </p>

      <header className="hdr">
        <div>
          <h1 className="hdr-title">Decode It</h1>
          <p className="hdr-sub">Read between the lines.</p>
        </div>
        <div className="hdr-end">
          {provider.isDemo && (
            <span className="tag" title={provider.label}>
              Demo
            </span>
          )}
          <Button variant="ghost" icon aria-label="Start over and clear everything" onClick={startOver}>
            <RotateCcw size={16} aria-hidden />
          </Button>
        </div>
      </header>

      <div className="scroll" ref={scrollRef}>
        {phase === 'result' && result && recap ? (
          <Results ref={resultRef} result={result} comment={comment} recap={recap} copied={copied} onCopyQuestion={(q) => void copyText(q, q)} />
        ) : working ? (
          <DecodingStage slow={slow} onCancel={cancel} />
        ) : (
          <div className="stack rise">
            {errorInfo && (
              <div className="alert" data-tone={noMatch ? 'info' : 'error'} role={noMatch ? 'status' : 'alert'}>
                {noMatch ? <Info size={16} aria-hidden /> : <AlertCircle size={16} aria-hidden />}
                <div>
                  <p className="alert-title">{errorInfo.title}</p>
                  <p className="alert-body">{errorInfo.body}</p>
                </div>
              </div>
            )}

            <DesignContext
              host={host}
              simulated={simulated}
              selection={selection}
              onRefresh={refresh}
              source={activeSource}
              onSource={setSource}
              shot={shot}
              shotBusy={shotBusy}
              shotError={shotError}
              onFile={(f) => void attachFile(f)}
              onClearShot={clearShot}
              valid={designValid}
              attempted={attempted}
              disabled={working}
            />

            <div>
              <div className="field-head">
                <label className="field-label" htmlFor="feedback-input">
                  What feedback did you receive?
                </label>
                {(feedbackValid || attempted) && (
                  <span className="field-status" data-state={feedbackValid ? 'added' : 'missing'}>
                    {feedbackValid && <Check size={12} aria-hidden />}
                    {feedbackValid ? 'Added' : 'Needed'}
                  </span>
                )}
              </div>
              <textarea
                id="feedback-input"
                className="textarea"
                rows={3}
                maxLength={MAX_COMMENT_LENGTH}
                placeholder="Paste the reviewer's comment..."
                value={comment}
                data-invalid={attempted && !feedbackValid}
                onChange={(e) => {
                  setComment(e.target.value);
                  if (phase === 'error') {
                    setPhase('compose');
                    setErrorInfo(null);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    decodeFromKeyboard();
                  }
                }}
              />
              {comment.length > MAX_COMMENT_LENGTH * 0.8 && (
                <p className="field-hint field-hint-row" id="feedback-hint" style={{ justifyContent: 'flex-end', fontVariantNumeric: 'tabular-nums' }}>
                  {comment.length} / {MAX_COMMENT_LENGTH}
                </p>
              )}
              {showSamples && (
                <div style={{ marginTop: 6 }}>
                  <Samples
                    feedback={comment}
                    open={samplesOpen}
                    onToggle={setSamplesOpen}
                    disabled={working}
                    demo={mode === 'demo'}
                    onDemoChange={(on) => {
                      setMode(on ? 'demo' : 'live');
                      setErrorInfo(null);
                    }}
                    onPick={(f) => {
                      setComment(f);
                      setSamplesOpen(false);
                      setPhase('compose');
                      setErrorInfo(null);
                      focusFeedback();
                    }}
                  />
                </div>
              )}
            </div>

            <NotesField notes={notes} onChange={setNotes} open={notesOpen} onToggle={setNotesOpen} disabled={working} onEnter={decodeFromKeyboard} />
          </div>
        )}
      </div>

      {!working && (
        <footer className="ftr">
          {phase === 'result' ? (
            <div className="ftr-row">
              <Button variant="secondary" onClick={() => result && void copyText(buildSummary(comment, result), SUMMARY_KEY)}>
                {copied === SUMMARY_KEY ? 'Copied' : 'Copy summary'}
              </Button>
              <Button variant="primary" onClick={decodeAnother}>
                Decode another
              </Button>
            </div>
          ) : (
            <>
              <Button variant="primary" id="decode-btn" unavailable={!ready} aria-describedby={mode === 'live' ? 'ftr-note ftr-privacy' : 'ftr-note'} onClick={() => void decode()}>
                {needsAck ? 'Agree and decode' : phase === 'error' && errorInfo?.retryable ? 'Try again' : 'Decode feedback'}
              </Button>
              <p className={copyFailed || (attempted && !ready) ? 'ftr-note' : 'sr-only'} id="ftr-note" data-tone={attempted && !ready ? 'warn' : undefined}>
                {copyFailed ? 'Couldn’t copy. Select the text and copy it yourself.' : reason}
              </p>
              {mode === 'live' && (
                <p className="ftr-note" id="ftr-privacy">
                  Your design, feedback and context are sent to our server and Google Gemini to generate AI-powered suggestions. Please avoid confidential or sensitive information.
                </p>
              )}
            </>
          )}
          {phase === 'result' && (
            <p className="ftr-note" data-tone={copyFailed ? 'warn' : undefined}>
              {copyFailed ? 'Couldn’t copy. Select the text and copy it yourself.' : (
                <button type="button" className="dc-link" onClick={backToEdit}>
                  Edit feedback
                </button>
              )}
            </p>
          )}
        </footer>
      )}

      {import.meta.env.DEV && <DevSwitch />}
    </div>
  );
}

export default App;

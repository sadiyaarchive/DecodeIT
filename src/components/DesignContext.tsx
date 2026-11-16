import { useRef, useState } from 'react';
import { AlertCircle, Check, ImagePlus, RefreshCw } from 'lucide-react';
import type { HostKind, UiSelection } from '../lib/figma/host';
import { typeLabel } from '../lib/figma/selection';
import { ACCEPTED_IMAGE_TYPES } from '../lib/design';

export interface Shot {
  name: string;
  width: number;
  height: number;
  url: string;
  file: File;
}
export type Source = 'frame' | 'screenshot';

const KIND_LABEL: Record<string, string> = {
  FRAME: 'Frame',
  COMPONENT: 'Component',
  COMPONENT_SET: 'Component',
  INSTANCE: 'Instance',
  SECTION: 'Section',
  GROUP: 'Group',
};

interface Props {
  host: HostKind;
  simulated?: boolean;
  selection: UiSelection;
  onRefresh: () => void;
  source: Source;
  onSource: (s: Source) => void;
  shot: Shot | null;
  shotBusy: boolean;
  shotError: string | null;
  onFile: (f: File | null | undefined) => void;
  onClearShot: () => void;
  valid: boolean;
  /** The user pressed the button while this was missing. */
  attempted: boolean;
  disabled: boolean;
}

/** Minimal technical illustration of a Figma frame with corner selection handles. */
function FrameIllustration() {
  return (
    <svg className="dc-illus" width="116" height="68" viewBox="0 0 116 68" fill="none" aria-hidden>
      {/* Subtle canvas guide lines */}
      <line x1="8" y1="12" x2="108" y2="12" stroke="var(--line)" strokeDasharray="2 2" />
      <line x1="8" y1="56" x2="108" y2="56" stroke="var(--line)" strokeDasharray="2 2" />
      <line x1="22" y1="4" x2="22" y2="64" stroke="var(--line)" strokeDasharray="2 2" />
      <line x1="94" y1="4" x2="94" y2="64" stroke="var(--line)" strokeDasharray="2 2" />

      {/* Frame label pill above top-left */}
      <rect x="22" y="5" width="18" height="3.5" rx="1.75" fill="var(--accent)" fillOpacity="0.45" />

      {/* Main frame bounding box */}
      <rect x="22" y="12" width="72" height="44" rx="2" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.25" />

      {/* Minimal interior wireframe blocks */}
      <rect x="29" y="19" width="24" height="4" rx="2" fill="var(--line-strong)" />
      <rect x="29" y="27" width="58" height="12" rx="2" fill="var(--sunken)" />
      <rect x="29" y="43" width="27" height="6" rx="1.5" fill="var(--sunken)" />
      <rect x="60" y="43" width="27" height="6" rx="1.5" fill="var(--sunken)" />

      {/* Four corner selection handles */}
      <rect x="19.5" y="9.5" width="5" height="5" rx="1" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.25" />
      <rect x="91.5" y="9.5" width="5" height="5" rx="1" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.25" />
      <rect x="19.5" y="53.5" width="5" height="5" rx="1" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.25" />
      <rect x="91.5" y="53.5" width="5" height="5" rx="1" fill="var(--surface)" stroke="var(--accent)" strokeWidth="1.25" />

      {/* Cursor pointer at bottom-right corner */}
      <path
        d="M97 50L100.5 60.5L102.8 56.2L107.2 54.5L97 50Z"
        fill="var(--ink)"
        stroke="var(--surface)"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The design the feedback is about: a selected Figma frame or a screenshot. Required. */
export function DesignContext(p: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const showingShot = p.source === 'screenshot' && !!p.shot;
  const showingFrame = p.host === 'figma' && p.selection.kind === 'frame' && !showingShot;
  const status = p.valid ? 'added' : p.attempted ? 'missing' : 'required';

  const browse = () => fileRef.current?.click();

  const sel = p.selection;
  const isBusy = p.host === 'pending' || p.shotBusy || (p.host === 'figma' && sel.kind === 'loading' && !showingShot);
  const busyLabel = p.shotBusy ? 'Reading the image' : p.host === 'figma' && sel.kind === 'loading' ? `Reading ${sel.name}` : 'Connecting to Figma';

  const mainCard = (() => {
    if (isBusy) {
      return <div className="dc skeleton" role="status" aria-label={busyLabel} aria-busy="true" />;
    }

    if (showingShot && p.shot) {
      return (
        <div>
          <div className="dc dc-preview" data-over={over}>
            <img src={p.shot.url} alt={`Screenshot: ${p.shot.name}`} />
          </div>
          <div className="dc-meta">
            <span className="dc-name">
              <span className="status-dot" data-state="added" aria-hidden />
              <em>Image</em>
              <span>
                {p.shot.name} · {p.shot.width} × {p.shot.height}
              </span>
            </span>
            <span className="dc-actions">
              <button type="button" className="mini" onClick={browse} disabled={p.disabled}>
                Replace
              </button>
              <button type="button" className="mini" onClick={p.onClearShot} disabled={p.disabled}>
                Remove
              </button>
            </span>
          </div>
        </div>
      );
    }

    if (showingFrame && sel.kind === 'frame') {
      return (
        <div>
          <div className="dc dc-preview" data-over={over}>
            <img src={sel.previewUrl} alt={`Selected ${KIND_LABEL[sel.nodeType]?.toLowerCase() ?? 'layer'}: ${sel.name}`} />
          </div>
          <div className="dc-meta">
            <span className="dc-name">
              <span className="status-dot" data-state="added" aria-hidden />
              <em>{KIND_LABEL[sel.nodeType] ?? 'Frame'}</em>
              <span>
                {sel.name} · {sel.width} × {sel.height}
              </span>
            </span>
            <span className="dc-actions">
              <button type="button" className="mini" onClick={p.onRefresh} disabled={p.disabled} aria-label="Refresh the preview">
                <RefreshCw size={12} aria-hidden /> Refresh
              </button>
              <button id="design-focus" type="button" className="mini" onClick={browse} disabled={p.disabled}>
                <ImagePlus size={12} aria-hidden /> Upload image
              </button>
            </span>
          </div>
        </div>
      );
    }

    if (p.host === 'figma' && sel.kind === 'error') {
      return (
        <div className="dc dc-error" data-over={over} data-attempt={p.attempted && !p.valid} role="alert">
          <AlertCircle className="dc-icon" size={20} aria-hidden />
          <p className="dc-title">Couldn't read that frame</p>
          <p className="dc-sub">{sel.message}</p>
          <button type="button" className="mini" onClick={p.onRefresh}>
            <RefreshCw size={12} aria-hidden /> Try again
          </button>
        </div>
      );
    }

    const stateBadge =
      p.host === 'figma' && sel.kind === 'multiple'
        ? `${sel.count} layers selected · pick 1`
        : p.host === 'figma' && sel.kind === 'unsupported'
          ? `Selected ${typeLabel(sel.nodeType)}`
          : null;

    return (
      <div id="design-focus-frame" tabIndex={-1} className="dc dc-empty relative" style={{ position: 'relative' }} data-over={over} data-attempt={p.attempted && !p.valid}>
        <FrameIllustration />
        <p className="dc-title">{p.host === 'figma' && sel.kind === 'multiple' ? 'Select just one frame' : 'Select a frame'}</p>
        {stateBadge && <span className="dc-badge">{stateBadge}</span>}
      </div>
    );
  })();

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        if (!p.disabled) p.onFile(e.dataTransfer.files?.[0]);
      }}
    >
      <div className="field-head">
        <span className="field-label" id="design-label">
          Your selected design
        </span>
        <span className="field-status" data-state={status === 'added' ? 'added' : status === 'missing' ? 'missing' : 'waiting'}>
          {status === 'added' ? (
            <>
              <Check size={12} aria-hidden />
              {showingFrame ? 'Selected' : 'Added'}
            </>
          ) : status === 'missing' ? (
            'Needed'
          ) : (
            <>
              <span className="status-dot" data-state="waiting" aria-hidden />
              {p.simulated ? 'Simulated' : 'Waiting for selection'}
            </>
          )}
        </span>
      </div>

      {mainCard}

      {!showingShot && !showingFrame && (
        <button id="design-focus" type="button" className="upload-tile" onClick={browse} disabled={p.disabled}>
          <ImagePlus size={14} aria-hidden />
          <span>Upload image</span>
        </button>
      )}

      {p.shotError && (
        <p className="field-hint" data-tone="error" role="alert">
          {p.shotError}
        </p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        hidden
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          p.onFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}

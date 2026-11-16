import { ChevronDown } from 'lucide-react';
import { SAMPLE_SCENARIOS } from '../lib/decoder';

interface SamplesProps {
  feedback: string;
  onPick: (feedback: string) => void;
  open: boolean;
  onToggle: (open: boolean) => void;
  disabled: boolean;
}

/** The built-in sample scenarios, collapsed by default behind a subtle disclosure. */
export function Samples({ feedback, onPick, open, onToggle, disabled }: SamplesProps) {
  return (
    <details className="disc" open={open}>
      <summary
        onClick={(e) => {
          e.preventDefault();
          if (!disabled) onToggle(!open);
        }}
      >
        <span>Testing the plugin? Try sample feedback</span>
        <ChevronDown className="chev" size={16} aria-hidden />
      </summary>
      {open && (
        <div className="disc-body">
          <div className="chips" role="list" aria-label="Sample scenarios">
            {SAMPLE_SCENARIOS.map((s) => (
              <div role="listitem" key={s.id} className="chip-cell">
                <button
                  type="button"
                  className="chip"
                  aria-pressed={feedback === s.feedback}
                  title={s.feedback}
                  disabled={disabled}
                  onClick={() => {
                    onPick(s.feedback);
                    onToggle(false);
                  }}
                >
                  {s.title}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}

export interface Notes {
  description: string;
  audience: string;
  goal: string;
}

interface NotesProps {
  notes: Notes;
  onChange: (n: Notes) => void;
  open: boolean;
  onToggle: (open: boolean) => void;
  disabled: boolean;
  onEnter: () => void;
}

const FIELDS: { key: keyof Notes; label: string; placeholder: string }[] = [
  { key: 'description', label: "What's the design for?", placeholder: 'Pricing page for a budgeting app' },
  { key: 'audience', label: "Who's using it?", placeholder: 'First-time users on mobile' },
  { key: 'goal', label: "What's the intended action?", placeholder: 'Start a free trial' },
];

/** Optional short notes. The design itself is the required context. */
export function NotesField({ notes, onChange, open, onToggle, disabled, onEnter }: NotesProps) {
  const count = FIELDS.filter((f) => notes[f.key].trim()).length;
  return (
    <details className="disc disc-notes" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>
        <span className="disc-summary-main">
          <span>A little more context</span>
          <span className="disc-optional">Optional</span>
          {count > 0 && <span className="disc-count">{count} added</span>}
        </span>
        <ChevronDown className="chev" size={16} aria-hidden />
      </summary>
      <div className="disc-body notes-panel" id="notes-panel">
        {FIELDS.map((f) => (
          <label key={f.key} className="notes-field">
            <span className="input-label">{f.label}</span>
            <input
              className="input"
              placeholder={f.placeholder}
              maxLength={200}
              value={notes[f.key]}
              disabled={disabled}
              onChange={(e) => onChange({ ...notes, [f.key]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onEnter();
                }
              }}
            />
          </label>
        ))}
      </div>
    </details>
  );
}

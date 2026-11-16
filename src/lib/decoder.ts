// Decoding contract and the demo provider.
//
// Everything the UI shows comes from a `DecodeProvider`. Today the only provider is
// `mockProvider`, which matches the feedback to one of a dozen hand-written sample scenarios
// (see scenarios.ts) and returns that scenario's fixed result. It is NOT an AI model, it never
// writes new text, and every result carries `source.isDemo` so the UI can say so. Feedback the
// demo has no scenario for is rejected with a `no_match` error instead of getting generic filler.
//
// The live provider (worker-provider.ts) sends the request to our Cloudflare Worker, which calls
// Google Gemini; the API key never reaches the browser. `active.ts` chooses between the two.
// `context.layerSummary` can be filled from the current selection.

import { assertValidRequest, FIELD_LABEL, gatherContext } from './context.ts';
import type { DesignInput } from './design.ts';
import { matchScenario } from './scenarios.ts';
import type { Reading } from './scenarios.ts';

export { matchScenario, SAMPLE_SCENARIOS, SCENARIOS } from './scenarios.ts';
export type { SampleScenario, Scenario } from './scenarios.ts';

export interface DecodeRequest {
  comment: string;
  /** Required: the design the feedback is about (a Figma frame or a screenshot). */
  design: DesignInput;
  /** Optional notes. Empty strings mean "not provided". */
  context: {
    /** What the design is, e.g. "Pricing page for a budgeting app". */
    description: string;
    /** Who it is for. */
    audience: string;
    /** What it should get people to do. */
    goal: string;
    layerSummary?: string;
  };
}

/** What the user gave and what the provider actually did with it. The UI must never claim more than `used`. The design is always `provided`; the demo never `used` it. */
export interface ContextUse {
  provided: string[];
  used: string[];
  /** Provider-authored sentence for the UI. */
  note: string;
}

/** One plausible reading of the feedback: a possibility, never a fact. */
export type Interpretation = Reading;

/** Where a result came from, so the UI never presents demo output as AI output. */
export interface DecodeSource {
  id: string;
  label: string;
  isDemo: boolean;
}

export interface DecodeResult {
  source: DecodeSource;
  scenario: string;
  /** One or two sentences framing the feedback before the readings. */
  summary: string;
  /** Two or three plausible readings. */
  interpretations: Interpretation[];
  /** Questions to ask the person who gave the feedback. Empty when it is specific enough to act on. */
  questions: string[];
  /** Things we only know because the user told us, starting with the design they supplied. */
  observed: string[];
  /** Guesses the readings rest on. */
  assumptions: string[];
  /** True when the user added none of the optional notes (what it is, who it is for, what it should do). */
  missingContext: boolean;
  contextUse: ContextUse;
}

/** Why a decode failed. Providers throw these; the UI chooses the wording per kind. */
export type DecodeErrorKind = 'input' | 'no_match' | 'image' | 'network' | 'timeout' | 'rate_limit' | 'server' | 'unknown';

export class DecodeError extends Error {
  kind: DecodeErrorKind;
  constructor(message: string, kind: DecodeErrorKind = 'unknown') {
    super(message);
    this.name = 'DecodeError';
    this.kind = kind;
  }
}

/** Longest feedback a provider should accept. */
export const MAX_COMMENT_LENGTH = 1000;

export interface DecodeProvider extends DecodeSource {
  decode(req: DecodeRequest, opts?: { signal?: AbortSignal }): Promise<DecodeResult>;
}

const DEMO_SOURCE: DecodeSource = {
  id: 'demo',
  label: 'Demo: built-in sample scenarios, not an AI model',
  isDemo: true,
};

/**
 * The only way the demo uses context: some questions ask for something the user has already
 * told us, so they are skipped. The readings themselves do not change.
 */
const ANSWERED_BY: Record<string, 'audience' | 'goal'> = {
  'Who is the audience, and what should they feel when they first see this?': 'audience',
  'What is the one thing users should do on this screen?': 'goal',
};

function decodeDemo(req: DecodeRequest): DecodeResult {
  const feedback = assertValidRequest(req);
  const scenario = matchScenario(feedback);
  if (!scenario) {
    throw new DecodeError("The demo has no sample scenario for that feedback.", 'no_match');
  }

  const { observed, provided, missingContext, answered } = gatherContext(req);

  // Skip questions the user has already answered (never leave an ambiguous scenario without one).
  const kept = scenario.questions.filter((q) => {
    const field = ANSWERED_BY[q];
    return !(field && answered[field]);
  });
  const questions = kept.length ? kept : scenario.questions;
  const skipped = new Set<'audience' | 'goal'>();
  if (kept.length) {
    scenario.questions.forEach((q) => {
      const field = ANSWERED_BY[q];
      if (field && answered[field]) skipped.add(field);
    });
  }
  const used = [...skipped].map((f) => FIELD_LABEL[f]);

  // The design is always supplied, and the demo never looks at it. Say so every time.
  const note = used.length
    ? `Used only to skip ${used.length === 1 ? 'a question' : 'questions'} you have already answered (${used.join(', ').toLowerCase()}). The readings themselves do not change, and the demo does not analyse the design.`
    : "The demo doesn't analyse the design or use your notes to change its readings.";

  return {
    source: DEMO_SOURCE,
    scenario: scenario.id,
    summary: scenario.summary,
    interpretations: scenario.readings,
    questions,
    observed,
    assumptions: scenario.assumptions,
    missingContext,
    contextUse: { provided, used, note },
  };
}

/** Demo provider: instant, local, deterministic. Respects cancellation like a real one would. */
export const mockProvider: DecodeProvider = {
  ...DEMO_SOURCE,
  async decode(req, opts) {
    if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    return decodeDemo(req);
  },
};

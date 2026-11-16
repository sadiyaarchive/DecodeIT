// Logic shared by every provider (the demo and the Worker-backed one): checking a request before it
// goes anywhere, and turning what the user supplied into the "what we know" facts. Kept free of
// browser-only and build-only APIs so the check scripts can run it in Node.

import { DecodeError, MAX_COMMENT_LENGTH } from './decoder.ts';
import type { DecodeRequest } from './decoder.ts';
import { describeDesign } from './design.ts';

export const FIELD_LABEL = {
  audience: "Who it's for",
  goal: 'What it should do',
} as const;

/** Throws a user-facing `input` error when the request cannot be decoded by any provider. */
export function assertValidRequest(req: DecodeRequest): string {
  const feedback = req.comment.trim().replace(/[‘’]/g, "'");
  if (!/[a-z]{2,}/i.test(feedback)) {
    throw new DecodeError("That doesn't look like design feedback. Try pasting the full sentence.", 'input');
  }
  if (feedback.length > MAX_COMMENT_LENGTH) {
    throw new DecodeError(`That feedback is longer than ${MAX_COMMENT_LENGTH} characters. Paste just the part you want decoded.`, 'input');
  }
  if (!req.design || !(req.design.image instanceof Blob) || req.design.image.size === 0) {
    throw new DecodeError('Add the design this feedback is about.', 'input');
  }
  return feedback;
}

export interface ContextFacts {
  /** Things we only know because the user told us, starting with the design. */
  observed: string[];
  /** Names of everything the user supplied, starting with "Design". */
  provided: string[];
  /** True when the user added none of the optional notes. */
  missingContext: boolean;
  /** Which question-worthy notes were answered. */
  answered: { audience: boolean; goal: boolean };
}

export function gatherContext(req: DecodeRequest): ContextFacts {
  const description = req.context.description.trim();
  const audience = req.context.audience.trim();
  const goal = req.context.goal.trim();
  const observed: string[] = [`Design: ${describeDesign(req.design)}`];
  const provided: string[] = ['Design'];
  let notes = 0;
  if (description) {
    observed.push(`What it is: "${description}"`);
    provided.push('What it is');
    notes++;
  }
  if (audience) {
    observed.push(`Who it's for: "${audience}"`);
    provided.push(FIELD_LABEL.audience);
    notes++;
  }
  if (goal) {
    observed.push(`What it should do: "${goal}"`);
    provided.push(FIELD_LABEL.goal);
    notes++;
  }
  if (req.context.layerSummary) observed.push(req.context.layerSummary);
  return { observed, provided, missingContext: notes === 0, answered: { audience: !!audience, goal: !!goal } };
}

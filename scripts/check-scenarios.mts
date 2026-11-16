// Integrity of the sample scenario library: every scenario is complete, concise and distinct
// from the others, and the "ask only when ambiguous" rule holds. No dependencies:
//   node scripts/check-scenarios.mts
import { SCENARIOS } from '../src/lib/scenarios.ts';
import { mockProvider } from '../src/lib/decoder.ts';

const design = { kind: 'screenshot' as const, name: 'a.png', width: 100, height: 100, image: new Blob([new Uint8Array([1])], { type: 'image/png' }) };
const failures: string[] = [];
const check = (name: string, ok: boolean) => ok || failures.push(name);

check('twelve scenarios', SCENARIOS.length === 12);
check('ids are unique', new Set(SCENARIOS.map((s) => s.id)).size === SCENARIOS.length);
check('titles are unique', new Set(SCENARIOS.map((s) => s.title)).size === SCENARIOS.length);
check('sample feedback is unique', new Set(SCENARIOS.map((s) => s.feedback)).size === SCENARIOS.length);
check('eight ambiguous and four specific', SCENARIOS.filter((s) => s.questions.length).length === 8 && SCENARIOS.filter((s) => !s.questions.length).length === 4);

// Concise enough to scan.
const max = { title: 28, summary: 170, assumption: 130, label: 40, meaning: 130, issue: 70, step: 100, why: 120, question: 100 };
for (const s of SCENARIOS) {
  const at = (what: string) => `${s.id}: ${what}`;
  check(at('title length'), s.title.length <= max.title);
  check(at('summary length'), s.summary.length > 20 && s.summary.length <= max.summary);
  check(at('2 assumptions'), s.assumptions.length === 2 && s.assumptions.every((a) => a.length <= max.assumption));
  check(at('2 or 3 readings'), s.readings.length >= 2 && s.readings.length <= 3);
  check(at('1 or 2 questions, or none'), s.questions.length <= 2 && s.questions.every((q) => q.endsWith('?') && q.length <= max.question));
  for (const r of s.readings) {
    check(at(`reading "${r.label}" label`), r.label.length <= max.label);
    check(at(`reading "${r.label}" meaning`), r.meaning.length > 20 && r.meaning.length <= max.meaning);
    check(at(`reading "${r.label}" has 3 things to look for`), r.issues.length === 3 && r.issues.every((x) => x.length <= max.issue));
    check(at(`reading "${r.label}" has 3 steps`), r.tries.length === 3 && r.tries.every((x) => x.length <= max.step));
    check(at(`reading "${r.label}" why`), r.why.length <= max.why);
  }
  // Voice: possibilities, never claims about intent, never AI.
  const text = JSON.stringify(s).toLowerCase();
  check(at('does not mention AI'), !/\b(ai|artificial|generated|model)\b/.test(text.replace(/"patterns":.*?\],/s, '')));
  check(at('does not state intent as fact'), !/\bthey (want|mean|think)s? that\b|\bthe reviewer (wants|means)\b/.test(text));
}

// Distinct: nothing is copy-pasted between scenarios.
const seen = new Map<string, string>();
const dup = (kind: string, value: string, owner: string) => {
  const key = value.trim().toLowerCase();
  const prev = seen.get(key);
  if (prev && prev !== owner) failures.push(`"${value}" (${kind}) is repeated in ${prev} and ${owner}`);
  seen.set(key, owner);
};
for (const s of SCENARIOS) {
  dup('summary', s.summary, s.id);
  for (const r of s.readings) {
    dup('label', r.label, s.id);
    dup('meaning', r.meaning, s.id);
    r.tries.forEach((t) => dup('step', t, s.id));
    r.issues.forEach((t) => dup('look-for', t, s.id));
  }
  s.questions.forEach((q) => dup('question', q, s.id));
}
// Within a scenario the readings are different from each other.
for (const s of SCENARIOS) {
  const steps = s.readings.flatMap((r) => r.tries.map((t) => t.toLowerCase()));
  check(`${s.id}: no repeated steps`, new Set(steps).size === steps.length);
}

// The provider hands back exactly the scenario's content.
for (const s of SCENARIOS) {
  const r = await mockProvider.decode({ comment: s.feedback, design, context: { description: '', audience: '', goal: '' } });
  check(`${s.id}: provider returns its scenario`, r.scenario === s.id && r.interpretations === s.readings && r.summary === s.summary);
  check(`${s.id}: question only when ambiguous`, s.questions.length > 0 ? r.questions.length > 0 : r.questions.length === 0);
  check(`${s.id}: labelled as demo`, r.source.isDemo);
}

if (failures.length) {
  failures.forEach((f) => console.log(`FAIL  ${f}`));
  process.exit(1);
}
console.log(`scenario checks passed (${SCENARIOS.length} scenarios)`);

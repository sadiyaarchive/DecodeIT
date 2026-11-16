// Regression check for how typed feedback is routed to a sample scenario. No dependencies:
//   node scripts/check-matching.mts
import { matchScenario, SAMPLE_SCENARIOS } from '../src/lib/scenarios.ts';

// [feedback, expected scenario id, or null when the demo has no scenario for it]
const cases: [string, string | null][] = [
  // each sample routes to itself
  ['Can we make this feel more premium?', 'premium'],
  ["This doesn't feel right.", 'wrong'],
  ['This doesn’t feel right.', 'wrong'], // curly apostrophe
  ['Can we make it pop?', 'pop'],
  ['Simplify this.', 'simplify'],
  ['Can you make it more modern?', 'modern'],
  ['Can we make the CTA more prominent?', 'cta'],
  ['The spacing feels inconsistent.', 'spacing'],
  ['Can you make the typography more elegant?', 'typography'],
  ["I don't love the colours.", 'colours'],
  ["This isn't intuitive.", 'intuitive'],
  ['Make the logo bigger.', 'logo'],
  ["There's not enough contrast.", 'contrast'],
  // other phrasings of the same ideas
  ['Something feels off about the header', 'wrong'],
  ['I am not sure about this', 'wrong'],
  ['Needs more energy', 'pop'],
  ['It needs more personality', 'pop'],
  ['Can we make it more playful?', 'pop'],
  ['Looks a bit flat', 'pop'],
  ['Make it less boring', 'pop'],
  ['It looks too busy', 'simplify'],
  ['This feels cluttered', 'simplify'],
  ['Can we simplify the navigation?', 'simplify'],
  ['Needs more breathing room', 'simplify'],
  ['Can you clean this up?', 'simplify'],
  ['This looks dated', 'modern'],
  ['Make it feel fresher', 'modern'],
  ['It feels cheap', 'premium'],
  ['This looks cheap', 'premium'],
  ['The call to action is too small', 'cta'],
  ['Make the button more noticeable', 'cta'],
  ['The padding is all over the place', 'spacing'],
  ['Change the font', 'typography'],
  ['The colours feel off', 'colours'],
  ['Too many colours', 'colours'],
  ['This is not the right shade of grey', 'colours'],
  ['This is confusing', 'intuitive'],
  ['Can we make the nav more intuitive?', 'intuitive'],
  ['Our logo needs more presence', 'logo'],
  ['Not enough contrast', 'contrast'],
  ['The text is hard to read', 'contrast'],
  ['Needs to be more accessible', 'contrast'],
  ['This needs more clarity.', 'intuitive'],
  ['It needs more impact.', 'pop'],
  ['Not quite there yet.', 'wrong'],
  // specific beats vague on a tie
  ['Make the CTA pop', 'cta'],
  // words that merely contain a trigger must not match
  ['Make the popup less cluttered', 'simplify'],
  ['The pop-up blocks the content', null],
  ['The button is currently too small', null],
  ['I am not sure the hierarchy is right, is that right?', null],
  // honest "not in the demo": no generic fallback
  ['Can we try something different?', null],
  ['Feels too corporate', null],
  ['The hierarchy is off', null],
  ['Make it more friendly', null],
  ["I'm not feeling it", null],
  ['Make it feel lighter', null],
  ['Can you give it more oomph?', null],
  ['Something about the layout bugs me', null],
];

let failed = 0;
for (const [feedback, expected] of cases) {
  const got = matchScenario(feedback)?.id ?? null;
  if (got !== expected) {
    failed++;
    console.log(`FAIL  "${feedback}"  expected ${expected}  got ${got}`);
  }
}
for (const s of SAMPLE_SCENARIOS) {
  if (matchScenario(s.feedback)?.id !== s.id) {
    failed++;
    console.log(`FAIL  sample "${s.title}" does not route to itself`);
  }
}
console.log(failed ? `${failed} failed` : `all ${cases.length} cases passed`);
process.exit(failed ? 1 : 0);

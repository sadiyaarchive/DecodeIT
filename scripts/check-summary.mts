// Checks the copied summary. No dependencies:
//   node scripts/check-summary.mts
import { mockProvider } from '../src/lib/decoder.ts';
import { buildSummary } from '../src/lib/summary.ts';

const comment = 'Can we make this feel more premium?';
const design = { kind: 'figma-frame' as const, name: 'Home', width: 390, height: 844, image: new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' }) };

const withContext = await mockProvider.decode({
  comment,
  design,
  context: { description: 'Pricing page for a budgeting app', audience: '', goal: '' },
});
const without = await mockProvider.decode({
  comment,
  design,
  context: { description: '', audience: '', goal: '' },
});

const failures: string[] = [];
const check = (name: string, ok: boolean) => ok || failures.push(name);

const a = buildSummary(comment, withContext);
check('includes the reviewer comment', a.includes(`“${comment}”`));
check('keeps facts and guesses in separate sections', a.indexOf('What we know') < a.indexOf('What it might mean (guesses, not facts)'));
check('includes the user-provided context as a fact', a.includes('Pricing page for a budgeting app'));
check('lists every reading', withContext.interpretations.every((it, i) => a.includes(`${i + 1}. ${it.label}`)));
check('lists the questions to ask', withContext.questions.length > 0 && withContext.questions.every((q) => a.includes(`- ${q}`)));
check('keeps next steps per reading', withContext.interpretations.every((it) => a.includes(it.tries[0])));
check('includes assumptions', a.includes('Assumptions behind these readings'));
check('labels demo output', a.includes('Demo output'));
check('has a questions section', a.includes('Questions to ask'));
check('has no stray undefined', !a.includes('undefined'));

const b = buildSummary(comment, without);
check('says the demo does not analyse the design', b.includes("doesn't analyse the design"));


// --- context use must be reported truthfully ---
const ctx = (over: Partial<{ description: string; audience: string; goal: string }>) => ({
  description: '', audience: '', goal: '', ...over,
});
const AUDIENCE_Q = 'Who is the audience, and what should they feel when they first see this?';
const GOAL_Q = 'What is the one thing users should do on this screen?';
const allQuestions = (r: Awaited<ReturnType<typeof mockProvider.decode>>) => r.questions;

const noCtx = await mockProvider.decode({ comment, design, context: ctx({}) });
check('no notes: only the design is provided, and the demo says it does not analyse it', noCtx.contextUse.provided.join() === 'Design' && /doesn't analyse the design/.test(noCtx.contextUse.note));
check('the design is listed as a known fact', noCtx.observed[0] === 'Design: Figma frame "Home", 390 × 844');
check('the demo never claims to have used the design', !noCtx.contextUse.used.includes('Design'));
check('no context: audience question is asked', allQuestions(noCtx).includes(AUDIENCE_Q));

const aud = await mockProvider.decode({ comment, design, context: ctx({ audience: 'First-time users' }) });
check('audience given: shown as a fact', aud.observed.some((o) => o.includes('Who it\'s for: "First-time users"')));
check('audience given: provider says it used it', aud.contextUse.used.includes("Who it's for"));
check('audience given: the answered question is skipped', !allQuestions(aud).includes(AUDIENCE_Q));
check('audience given: a question is still asked', aud.questions.length >= 1);
check('audience given: note says readings do not change and the design is not analysed', aud.contextUse.note.includes('readings themselves do not change') && aud.contextUse.note.includes('does not analyse the design'));
check('audience given: other readings text unchanged', aud.interpretations.every((it, i) => it.meaning === noCtx.interpretations[i].meaning));

const goalOnSimplify = await mockProvider.decode({ comment: 'Simplify this.', design, context: ctx({ goal: 'Start a free trial' }) });
check('goal given on simplify: used and question skipped', goalOnSimplify.contextUse.used.includes('What it should do') && !allQuestions(goalOnSimplify).includes(GOAL_Q));

const unused = await mockProvider.decode({ comment: 'Can we make it pop?', design, context: ctx({ audience: 'First-time users' }) });
check('nothing to skip: used is empty', unused.contextUse.used.length === 0);
check('nothing to skip: note admits the notes are not used', unused.contextUse.note.includes("doesn't analyse the design or use your notes"));
const specific = await mockProvider.decode({ comment: 'Make the logo bigger.', design, context: ctx({}) });
check('specific feedback: no questions', specific.questions.length === 0);
check('specific feedback: summary says none are needed', buildSummary('Make the logo bigger.', specific).includes('None needed'));
check('summary repeats the note', buildSummary('Can we make it pop?', unused).includes("doesn't analyse the design"));

if (failures.length) {
  failures.forEach((f) => console.log(`FAIL  ${f}`));
  process.exit(1);
}
console.log('summary checks passed');

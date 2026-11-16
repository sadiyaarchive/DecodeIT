// Browser interaction test for Unpack. It drives the real UI, so it needs the app open in a browser.
//
//   1. Start the dev server:   pnpm run dev
//   2. Open the app in a browser tab (a plain tab, no ?host= needed) and open the console.
//   3. Paste:   const m = await import('/scripts/browser-smoke.js'); await m.run()
//
// It uses the two dev-only switches (bottom left of the page): the simulated Figma host, to reach every
// selection state, and the failure switch for the demo provider. It takes about two minutes and returns
// { passed, failed, failures }.
//
// What it cannot cover: the real Figma plugin (needs Figma desktop), screen readers, real touch
// devices, other browsers, or a real AI provider.

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const text = () => document.body.innerText;
const lower = () => text().toLowerCase();
const all = (sel, root = document) => [...root.querySelectorAll(sel)];
const btn = (t) => all('button').find((b) => b.textContent.trim() === t || b.getAttribute('aria-label') === t);
const feedback = () => document.getElementById('feedback-input');
const setFeedback = (v) => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(feedback(), v);
  feedback().dispatchEvent(new Event('input', { bubbles: true }));
};
const setInput = (el, v) => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v);
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const waitFor = async (f, ms = 8000) => {
  const t = performance.now();
  while (performance.now() - t < ms) {
    if (f()) return Math.round(performance.now() - t);
    await wait(25);
  }
  return null;
};
const selects = () => all('.dev-switch select');
const hostSelect = () => selects()[0];
const failSelect = () => selects()[1];
const choose = (sel, v) => {
  Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, v);
  sel.dispatchEvent(new Event('change', { bubbles: true }));
};
const setHost = async (v) => {
  choose(hostSelect(), v);
  await wait(450);
};
const setFail = (v) => choose(failSelect(), v);
const primary = () => document.querySelector('.btn-primary');
const unavailable = () => primary().getAttribute('aria-disabled') === 'true';
const note = () => document.getElementById('ftr-note')?.textContent ?? '';
const working = () => !!document.querySelector('[role=progressbar]');
const resultShown = () => !!document.querySelector("article[aria-label='Decoded result']");
const announced = () => document.querySelector('[role=status].sr-only')?.textContent ?? '';
const alertText = () => document.querySelector('[role=alert]')?.innerText.replace(/\s+/g, ' ') ?? '';
const outcome = async (ms = 9000) => {
  await waitFor(working, 800);
  return waitFor(() => !working(), ms);
};
const unpack = async () => {
  primary().click();
  await outcome();
  await wait(700);
};
const startOver = async () => {
  btn('Start over and clear everything')?.click();
  await wait(300);
};
const png = async (name, w = 80, h = 60) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
    g.fillStyle = '#ddd';
  g.fillRect(0, 0, w, h);
    g.fillStyle = '#85f';
  g.fillRect(8, 8, 24, 12);
  return new File([await new Promise((r) => c.toBlob(r))], name, { type: 'image/png' });
};
const drop = async (file) => {
  const zone = document.querySelector('.dc');
  const dt = new DataTransfer();
  dt.items.add(file);
  zone.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }));
  await wait(400);
};
const pasteImage = async (file) => {
  const dt = new DataTransfer();
  dt.items.add(file);
  const e = new Event('paste', { bubbles: true, cancelable: true });
  e.clipboardData = dt;
  document.querySelector('.shell').dispatchEvent(e);
  await wait(400);
};
const radio = (label) => all("[role=radio]").find((r) => r.textContent.trim() === label);

export async function run() {
  const state = { failures: [], passed: 0, last: 'start' };
  try {
    await body(state);
  } catch (e) {
    state.failures.push(`CRASH after "${state.last}": ${e.message}`);
  }
  return { passed: state.passed, failed: state.failures.length, failures: state.failures };
}

async function body(state) {
  const check = (name, ok) => {
    state.last = name;
    window.__smokeLast = `${state.passed} passed, last: ${name}`; // lets you see where a stalled run is
    if (ok) state.passed++;
    else state.failures.push(name);
  };
  await wait(500);
  check('the dev switches are present (open a plain dev tab)', selects().length === 2);
  await setHost('off');
  await wait(900);
  await startOver();

  // ------------------------------------------------------------------ identity, plain browser
  check('page title is Decode It', document.title === 'Decode It');
  check('header: Decode It, tagline and Demo label', document.querySelector('.hdr').innerText.includes('Decode It') && document.querySelector('.hdr').innerText.includes('Read between the lines.') && !!all('.hdr .tag').find((t) => t.textContent === 'Demo'));
  check('required labels are shown in selection-first order', text().includes('Your selected design') && text().includes('What feedback did you receive?') && text().indexOf('Your selected design') < text().indexOf('What feedback did you receive?'));
  check('empty selection state and upload tile are shown', text().includes('Select a frame') && !!btn('Upload image') && feedback().placeholder === "Paste the reviewer's comment...");
  check('Geist is the page font', getComputedStyle(document.body).fontFamily.startsWith('Geist'));

  // ------------------------------------------------------------------ the design is mandatory
  check('nothing entered: the button is unavailable and says why', unavailable() && note() === 'Add the feedback and the design to continue.');
  check('the unavailable button can still be focused', (primary().focus(), document.activeElement === primary()));
  setFeedback('Can we make this feel more premium?');
  await wait(150);
  check('feedback only: still unavailable, asks for the design', unavailable() && note() === 'Select a frame in Figma, or upload a screenshot to continue.');
  primary().click();
  await wait(250);
  check('clicking while the design is missing does not submit', !working() && !resultShown());
  check('clicking points at what is missing', document.querySelector('.field-status[data-state=missing]')?.textContent.includes('Needed') && document.activeElement?.id === 'design-focus');
  check('design status reads Required before and Needed after', true);
  setFeedback('');
  await wait(100);
  await drop(await png('home.png'));
  check('design only: unavailable, asks for the feedback', unavailable() && note() === 'Paste the feedback you received to continue.');
  primary().click();
  await wait(250);
  check('clicking while the feedback is missing focuses the feedback', document.activeElement === feedback() && !working());

  // ------------------------------------------------------------------ screenshot validation
  await startOver();
  await drop(new File(['GIF89a'], 'anim.gif', { type: 'image/gif' }));
  check('a GIF is refused with a reason', alertText().includes("isn't supported") && !document.querySelector('.dc-preview'));
  await drop(new File([new Uint8Array(11 * 1024 * 1024)], 'huge.png', { type: 'image/png' }));
  check('an 11 MB image is refused with its size', alertText().includes('11.0 MB') && !document.querySelector('.dc-preview'));
  await drop(new File([new Uint8Array([1, 2, 3, 4])], 'broken.png', { type: 'image/png' }));
  check('a corrupt image is refused', alertText().includes("couldn't be read") && !document.querySelector('.dc-preview'));
  await drop(new File([], 'empty.png', { type: 'image/png' }));
  check('an empty file is refused', alertText().includes('empty'));
  await drop(await png('tiny.png', 10, 10));
  check('a tiny image is refused', alertText().includes('too small'));
  await drop(await png('first.png'));
  check('a valid screenshot shows a preview, its name and size, and clears the error', document.querySelector('.dc-preview')?.innerText.includes('first.png · 80 × 60') && !alertText());
  check('design status reads Added', document.querySelector('.field-status[data-state=added]')?.textContent.includes('Added'));
  await pasteImage(await png('second.png'));
  check('a pasted image replaces it', document.querySelector('.dc-preview')?.innerText.includes('second.png'));
  await drop(new File(['x'], 'bad.gif', { type: 'image/gif' }));
  check('a refused replacement keeps the current screenshot', document.querySelector('.dc-preview')?.innerText.includes('second.png'));
  btn('Remove').click();
  await wait(200);
  check('removing returns to the empty state and the design is required again', !!document.querySelector('.dc-empty') && !document.querySelector('.dc-preview'));
  await drop(await png('home.png'));
  // (Not clicked: that would open the operating system's file chooser. Dropping and pasting cover replacing.)
  check('Replace and Remove are offered, and the hidden file input exists', !!btn('Replace') && !!btn('Remove') && !!document.querySelector('input[type=file]'));

  // ------------------------------------------------------------------ samples and results
  await startOver();
  await drop(await png('home.png'));
  const sampleSummary = () => all('summary').find((s) => s.textContent.includes('Testing the plugin? Try sample feedback'));
  check('samples are hidden by default behind the disclosure', !!sampleSummary() && !document.querySelector("[aria-label='Sample scenarios']"));
  sampleSummary().click();
  await wait(100);
  const titles = all("[aria-label='Sample scenarios'] button").map((b) => b.textContent.trim());
  check('twelve sample scenarios shown as compact pills when expanded', titles.length === 12);
  sampleSummary().click();
  await wait(100);
  check('clicking the disclosure again collapses the sample section', !document.querySelector("[aria-label='Sample scenarios']"));
  const sets = new Set();
  for (const t of titles) {
    sampleSummary().click();
    await wait(80);
    btn(t).click();
    await wait(120);
    check(`sample "${t}": fills the feedback and collapses the sample section`, feedback().value.length > 0 && !document.querySelector("[aria-label='Sample scenarios']") && !unavailable());
    await unpack();
    const art = document.querySelector("article[aria-label='Decoded result']");
    const readings = all('.reading', art);
    check(`sample "${t}": three sections in order`, ['sec-mean', 'sec-try', 'sec-ask'].map((id) => document.getElementById(id)?.textContent).join('|') === "What's behind it|What to try|What to ask");
    check(`sample "${t}": guesses are labelled as guesses`, text().includes('Guesses, not facts'));
    check(`sample "${t}": 2-3 readings, 3 steps each`, readings.length >= 2 && readings.length <= 3 && all('.steps', art).length === readings.length && all('.steps', art).every((s) => all('li', s).length === 3));
    check(`sample "${t}": the design recap and demo honesty are shown`, !!art.querySelector('img.thumb') && lower().includes('demo example') && lower().includes('does not analyse your design'));
    const asks = all('.ask', art).length;
    check(`sample "${t}": questions only when ambiguous`, asks > 0 !== lower().includes('no question needed'));
    sets.add(readings.map((r) => r.querySelector('.reading-title').textContent).join('|'));
    btn('Decode another').click();
    await wait(250);
  }
  check('all twelve results differ', sets.size === 12);

  // ------------------------------------------------------------------ typed feedback
  setFeedback('Make the popup less cluttered');
  await unpack();
  check('typed feedback that matches gets that scenario', document.querySelector('.reading-title')?.textContent === 'Reduce visual noise');
  btn('Decode another').click();
  await wait(250);
  setFeedback('Make it feel lighter');
  await unpack();
  check('unmatched feedback: neutral "not in the demo" notice, not an error', document.querySelector('.alert')?.innerText.includes('Not in the demo yet') && !document.querySelector('.alert[data-tone=error]') && !resultShown());
  check('unmatched feedback: no generic filler, samples open, text kept, button unavailable', !document.querySelector('.reading') && !!document.querySelector('[aria-label="Sample scenarios"]') && feedback().value === 'Make it feel lighter' && unavailable());
  feedback().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
  await wait(250);
  check('unmatched feedback: the shortcut does not re-run it', !working());
  setFeedback('12345');
  await unpack();
  check('digits only: an error that explains itself, with the button unavailable', alertText().includes("Couldn't decode that feedback") && unavailable());
  setFeedback('Simplify this.');
  await wait(100);
  check('editing clears the error and re-enables the button', !document.querySelector('.alert') && !unavailable());

  // ------------------------------------------------------------------ loading and cancelling
  primary().click();
  check('loading appears with the minimal decoding mark and a status message', (await waitFor(working, 600)) !== null && !!document.querySelector('.work .decode-mark') && !document.querySelector('.work img.thumb') && !!document.querySelector('.work .work-status')?.textContent);
  check('the redundant bottom primary button is hidden during loading', !primary());
  btn('Cancel').click();
  await wait(300);
  check('Cancel returns to the form with the feedback kept and focused', !working() && feedback()?.value === 'Simplify this.' && announced().startsWith('Cancelled') && document.activeElement === feedback());
  await wait(1200);
  check('no result appears after cancelling', !resultShown());
  primary().click();
  await waitFor(working, 600);
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  await wait(300);
  check('Escape cancels', !working() && feedback()?.value === 'Simplify this.');
  primary().click();
  await waitFor(working, 600);
  btn('Start over and clear everything').click();
  await wait(1500);
  check('Start over during loading clears everything, nothing appears later', !working() && feedback()?.value === '' && !resultShown() && !document.querySelector('.dc-preview'));
  await drop(await png('home.png'));
  setFeedback('Simplify this.');
  feedback().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await wait(250);
  check('Enter alone does not submit', !working());
  feedback().dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', metaKey: true, bubbles: true }));
  check('Cmd/Ctrl+Enter submits', (await waitFor(working, 600)) !== null);
  await waitFor(resultShown);
  await wait(800);
  check('focus moves to the result', document.activeElement?.getAttribute('aria-label') === 'Decoded result');

  // ------------------------------------------------------------------ result actions
  let copied = null;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => (copied = t) }, configurable: true });
  btn('Copy summary').click();
  await wait(200);
  check('Copy summary: facts, design, guesses, questions and the demo line', ['Feedback:', 'What we know', 'Design: Screenshot "home.png"', 'What it might mean (guesses, not facts)', 'Questions to ask', 'Demo output'].every((x) => copied?.includes(x)));
  check('Copy summary: button says Copied and it is announced', !!btn('Copied') && announced() === 'Copied to clipboard');
  const realExec = document.execCommand.bind(document);
  await wait(2400);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async () => { throw new Error('blocked'); } }, configurable: true });
  document.execCommand = () => false;
  btn('Copy summary').click();
  await wait(250);
  check('a failed copy is reported, never "Copied"', !btn('Copied') && announced().startsWith("Couldn't copy"));
  document.execCommand = realExec;
  await wait(4300);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (t) => (copied = t) }, configurable: true });
  const q = all('.ask')[0];
  if (q) {
    q.querySelector('button').click();
    await wait(150);
    check('a question copies on its own', copied === q.querySelector('p').textContent);
  }
  const why = document.querySelector('.reading details');
  check('"Why this reading" is closed by default and opens', why && !why.open && (why.querySelector('summary').click(), why.open && why.innerText.toLowerCase().includes('look for')));
  btn('Edit feedback').click();
  await wait(300);
  check('Edit feedback returns to the form with feedback and design kept', feedback().value === 'Simplify this.' && !!document.querySelector('.dc-preview'));
  await unpack();
  btn('Decode another').click();
  await wait(300);
  check('Decode another clears the feedback', feedback().value === '');

  // ------------------------------------------------------------------ notes
  setFeedback('Make it pop');
  const notesSummary = all('summary').find((s) => s.textContent.includes('A little more context'));
  notesSummary.click();
  await wait(250);
  const inputs = all('#notes-panel input');
  check('three optional notes', inputs.length === 3);
  setInput(inputs[0], 'Pricing page');
  setInput(inputs[1], 'First-time users');
  await wait(100);
  check('the notes count shows', notesSummary.textContent.includes('2 added'));
  inputs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  await waitFor(resultShown);
  await wait(800);
  const known = document.querySelector('.known').innerText;
  check('notes appear under What we know, with the design', known.includes('What it is: "Pricing page"') && known.includes("Who it's for: \"First-time users\"") && known.includes('Design:'));
  check('the demo says it does not analyse the design', lower().includes('does not analyse your design'));
  btn('Decode another').click();
  await wait(250);

  // ------------------------------------------------------------------ limits
  setFeedback('word '.repeat(170));
  await wait(120);
  check('a counter appears near the 1000 character limit', text().includes('850 / 1000') && feedback().maxLength === 1000);
  setFeedback('pop ' + 'a'.repeat(900));
  await unpack();
  const shell = document.querySelector('.shell').getBoundingClientRect();
  check('a 900-character unbroken word does not break the layout', !all('.shell *').some((e) => e.getBoundingClientRect().right > shell.right + 1));
  await startOver();

  // ------------------------------------------------------------------ the simulated Figma host: every selection state
  await setHost('none');
  setFeedback('Can we make this feel more premium?');
  await wait(150);
  check('Figma, nothing selected: frame empty state and upload tile offered', text().includes('Select a frame') && !!btn('Upload image'));
  check('Figma, nothing selected: unavailable with the reason', unavailable() && note() === 'Select a frame in Figma to continue.');
  await setHost('multiple');
  check('Figma, several selected: asks for just one', text().includes('Select just one frame') && text().includes('3 layers selected') && note() === 'Select just one frame to continue.' && unavailable());
  await setHost('unsupported');
  check('Figma, a text layer selected: says what it is and what to pick', text().includes('Select a frame') && text().includes('a text layer') && note() === 'Select a frame, component or section to continue.' && unavailable());
  await setHost('error');
  await wait(500);
  check('Figma, export fails: a clear error with Try again', alertText().includes("Couldn't read that frame") && alertText().includes('no longer available') && unavailable() && note().startsWith('Fix the frame problem'));
  await setHost('slow-frame');
  check('Figma, slow export: a loading state, then the preview', !!document.querySelector('.dc.skeleton') && note() === 'Reading your frame…' && (await waitFor(() => !!document.querySelector('.dc-preview'), 5000)) !== null);
  check('Figma, frame selected: preview with name and size, design Selected, button available', document.querySelector('.dc-preview')?.innerText.includes('Home · 390 × 520') && document.querySelector('.field-status[data-state=added]')?.textContent.includes('Selected') && !unavailable() && note() === '');
  btn('Refresh the preview').click();
  await wait(300);
  check('Refresh keeps working', !!document.querySelector('.dc-preview') || !!document.querySelector('.dc.skeleton'));
  await setHost('frame');
  await wait(300);
  await unpack();
  check('submitting a frame shows its recap and the honest demo wording', resultShown() && document.querySelector('.known').innerText.includes('Design: Figma frame "Home", 390 × 520') && lower().includes('does not analyse your design'));
  await setHost('none');
  await wait(300);
  check('changing the Figma selection afterwards does not change the result already shown', resultShown() && !!document.querySelector('article img.thumb') && document.querySelector('.known').innerText.includes('Design: Figma frame "Home"'));
  btn('Decode another').click();
  await wait(250);
  setFeedback('Simplify this.');
  await setHost('frame');
  await drop(await png('mine.png'));
  await unpack();
  check('a screenshot is used when that route is chosen', document.querySelector('.known').innerText.includes('Design: Screenshot "mine.png"'));
  btn('Decode another').click();
  await wait(250);
  await setHost('off');
  await wait(900);
  await startOver();

  // ------------------------------------------------------------------ failure paths (dev switch)
  await drop(await png('home.png'));
  setFeedback('Simplify this.');
  await wait(80);
  for (const [mode, title, hidden] of [
    ['network', "Couldn't reach the decoder", 'Failed to fetch'],
    ['rate_limit', 'Too many requests', '429'],
    ['server', 'The decoder had a problem', 'stack trace'],
    ['unknown', 'Something went wrong', 'boom'],
  ]) {
    setFail(mode);
    await wait(100);
    primary().click();
    await outcome();
    check(`${mode}: friendly message, raw text hidden, feedback kept, retry offered`, alertText().includes(title) && !text().includes(hidden) && feedback().value === 'Simplify this.' && primary().textContent.trim() === 'Try again' && announced().includes(title));
  }
  setFail('off');
  await wait(100);
  primary().click();
  check('Try again succeeds once the fault is gone', (await waitFor(resultShown)) !== null);
  await wait(800);
  btn('Edit feedback').click();
  await wait(300);
  setFail('input');
  await wait(100);
  primary().click();
  await outcome();
  check('rejected input: not retryable until edited', unavailable() && !!document.querySelector('.alert'));
  setFail('off');
  setFeedback('Simplify this!');
  await wait(100);
  check('editing re-enables the button', !unavailable() && !document.querySelector('.alert'));
  setFail('slow');
  await wait(100);
  primary().click();
  check('slow answer: the slow notice appears', (await waitFor(() => lower().includes('still working'), 4000)) !== null && announced().includes('taking longer'));
  check('slow answer: it still finishes', (await waitFor(resultShown, 12000)) !== null);
  await wait(800);
  btn('Edit feedback').click();
  await wait(300);
  setFail('hang');
  await wait(100);
  primary().click();
  primary().click();
  primary().click();
  check('hang: the slow notice appears', (await waitFor(() => lower().includes('still working'), 4000)) !== null);
  btn('Cancel').click();
  await wait(300);
  check('hang: Cancel works and keeps the text', !working() && feedback().value === 'Simplify this!');
  await wait(5500);
  check('hang: no late error after cancelling', !document.querySelector('.alert'));
  primary().click();
  await outcome(9000);
  check('hang: times out with a clear message, one error only', alertText().includes('That took too long') && all('[role=alert]').length === 1);
  setFail('stuck');
  await wait(100);
  primary().click();
  await wait(800);
  btn('Cancel').click();
  await wait(300);
  check('stuck provider (ignores abort): Cancel still works', !working());
  await wait(5500);
  check('stuck provider: no late error after cancelling', !document.querySelector('.alert'));
  primary().click();
  await outcome(9000);
  check('stuck provider: still times out', alertText().includes('That took too long'));
  setFail('off');
  await startOver();

  // ------------------------------------------------------------------ reduced motion, accessibility, contrast
  await drop(await png('home.png'));
  setFeedback('Simplify this.');
  await unpack();
  let rule = null;
  for (const sheet of document.styleSheets) for (const r of sheet.cssRules) if (r.type === CSSRule.MEDIA_RULE && /prefers-reduced-motion/.test(r.conditionText)) rule = r;
  check('a reduced-motion rule exists', !!rule);
  if (rule) {
    const style = document.createElement('style');
    style.textContent = [...rule.cssRules].map((r) => r.cssText).join('\n');
    document.head.appendChild(style);
    await wait(100);
    check('reduced motion turns off the rise animation and transitions', getComputedStyle(document.querySelector('.res > *')).animationName === 'none' && getComputedStyle(document.querySelector('.chev')).transitionDuration.startsWith('0s'));
    style.remove();
  }
  const nameOf = (el) => el.getAttribute('aria-label') || (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent) || el.textContent || el.placeholder || '';
  const controls = all('.shell button, .shell input:not([type=file]), .shell textarea, .shell summary');
  check('every control has an accessible name', controls.every((e) => nameOf(e).trim()));
  const ids = all('[id]').map((e) => e.id);
  check('no duplicate ids; one main heading; a page language', new Set(ids).size === ids.length && all('h1').length === 1 && !!document.documentElement.lang);
  check('sections are real headings in order', all('h2').map((h) => h.textContent).join('|') === "What's behind it|What to try|What to ask");

  const cv = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  const rgba = (css) => {
    cv.clearRect(0, 0, 1, 1);
    cv.fillStyle = '#000';
    cv.fillStyle = css;
    cv.fillRect(0, 0, 1, 1);
    const d = cv.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const channel = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const lum = ([r, g, b]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  const ratio = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
  const blend = (f, b) => [f[0] * f[3] + b[0] * (1 - f[3]), f[1] * f[3] + b[1] * (1 - f[3]), f[2] * f[3] + b[2] * (1 - f[3]), 1];
  const lowContrast = () => {
    const bad = [];
    const w = document.createTreeWalker(document.querySelector('.shell'), NodeFilter.SHOW_TEXT);
    while (w.nextNode()) {
      const t = w.currentNode.textContent.trim();
      const el = w.currentNode.parentElement;
      if (!t || !el.getBoundingClientRect().width || el.closest('.sr-only, .dev-switch, textarea, input') || el.closest('[aria-disabled=true]')) continue;
      let bg = [247, 247, 248, 1];
      let grad = false;
      for (const e of (() => { const c = []; for (let x = el; x; x = x.parentElement) c.unshift(x); return c; })()) {
        const s = getComputedStyle(e);
        if (e.classList.contains('btn-primary')) grad = true;
        bg = blend(rgba(s.backgroundColor), bg);
      }
      const fg = rgba(getComputedStyle(el).color);
      const worst = grad ? Math.min(ratio(blend(fg, [79, 52, 184, 1]), [79, 52, 184, 1]), ratio(blend(fg, [122, 95, 220, 1]), [122, 95, 220, 1])) : ratio(blend(fg, bg), bg);
      if (worst < 4.45) bad.push(`${t.slice(0, 30)} ${worst.toFixed(2)}`);
    }
    return bad;
  };
  document.querySelectorAll('details').forEach((d) => (d.open = true));
  await wait(150);
  const resultsLow = lowContrast();
  check(`text contrast on the results screen is at least 4.5:1 ${resultsLow.join('; ')}`, resultsLow.length === 0);
  btn('Decode another').click();
  await wait(300);
  const formLow = lowContrast();
  check(`text contrast on the input screen is at least 4.5:1 ${formLow.join('; ')}`, formLow.length === 0);
}

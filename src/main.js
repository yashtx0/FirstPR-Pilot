import './style.css';
const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'llama-3.1-8b-instant'];
const $ = (s) => document.querySelector(s);
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) k === 'class' ? (n.className = v) : n.setAttribute(k, v);
  for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid.nodeType ? kid : document.createTextNode(kid));
  return n;
}
async function api(body) {
  const r = await fetch('/api/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ error: 'The server returned an unreadable response.' }));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
function status(msg, err = false) { const s = $('#status'); s.textContent = msg; s.className = err ? 'err' : ''; }

MODELS.forEach((m) => $('#model').append(el('option', { value: m }, m)));
document.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => { $('#repo').value = c.textContent; $('#form').requestSubmit(); }));

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#result').replaceChildren();
  $('#issues').replaceChildren();
  $('#find').disabled = true;
  status('Reading the repository…');
  try {
    const { issues, source } = await api({ action: 'issues', repo: $('#repo').value });
    if (!issues.length) return status('This repo has no open issues. Try another one.', true);
    status(`Showing ${issues.length} issue${issues.length > 1 ? 's' : ''} (${source}). Pick one.`);
    const list = issues.map((i, idx) => el('label', { class: 'issue' },
      el('input', { type: 'radio', name: 'issue', value: i.number, ...(idx === 0 ? { checked: '' } : {}) }),
      el('span', {}, `#${i.number} ${i.title}`, el('br'), el('small', {}, i.labels.join(', ')))));
    const go = el('button', { class: 'go', type: 'button' }, 'Make a verified plan');
    go.addEventListener('click', () => generate(go));
    $('#issues').append(...list, go);
  } catch (err) { status(err.message, true); } finally { $('#find').disabled = false; }
});

async function generate(btn) {
  const repo = $('#repo').value, model = $('#model').value;
  const issueNumber = Number(document.querySelector('input[name=issue]:checked')?.value);
  const key = `fp:${repo}#${issueNumber}:${model}`;
  btn.disabled = true;
  status('Drafting a plan, then checking every file against the repo…');
  try {
    let data;
    try { data = await api({ action: 'plan', repo, issueNumber, model }); localStorage.setItem(key, JSON.stringify(data)); }
    catch (err) { const saved = localStorage.getItem(key); if (!saved) throw err; data = JSON.parse(saved); }
    status('');
    render(data);
  } catch (err) { status(err.message, true); } finally { btn.disabled = false; }
}

function render(d) {
  const { stats } = d;
  const uniq = new Map();
  d.steps.forEach((s) => s.refs.forEach((r) => uniq.set(r.path, r.status)));
  const total = uniq.size, verified = [...uniq.values()].filter((x) => x !== 'missing').length;
  const paths = (stats.caughtPaths || []).join(', ');
  const note = stats.caught
    ? `The first draft named ${stats.caught} file${stats.caught > 1 ? 's' : ''} that ${stats.caught > 1 ? 'do' : 'does'} not exist${paths ? ': ' + paths : ''}. ${stats.remaining ? `${stats.remaining} still could not be verified, so check ${stats.remaining > 1 ? 'them' : 'it'} by hand.` : 'The plan was rewritten and now checks out.'}`
    : 'The first draft used only files that exist.';
  let n = 0;
  const steps = d.steps.map((s) => el('div', { class: 'step' },
    el('h3', {}, s.title), el('p', {}, s.detail),
    el('ul', { class: 'ledger' }, s.refs.map((r) => {
      const mark = r.status === 'missing' ? '−' : '+';
      const label = { ok: 'found in repo', new: 'new file in existing folder', missing: 'not in repo' }[r.status];
      return el('li', { class: r.status, style: `animation-delay:${(n++) * 70}ms` }, el('b', {}, mark), el('span', {}, r.path), el('span', {}, label));
    }))));
  $('#result').replaceChildren(
    el('h2', {}, `#${d.issue.number} ${d.issue.title}`),
    el('p', {}, d.plan.summary || '', ` Difficulty: ${d.plan.difficulty || 'unknown'}.`),
    el('div', { class: 'summary' + (stats.remaining ? ' warn' : '') }, el('b', {}, `${verified} of ${total} unique files verified.`), ' ' + note),
    ...steps,
    (d.plan.run_locally || []).length ? el('div', {}, el('h3', {}, 'Run it locally'), el('pre', {}, d.plan.run_locally.join('\n'))) : null,
    d.plan.how_to_test ? el('div', {}, el('h3', {}, 'Test your change'), el('p', {}, d.plan.how_to_test)) : null,
    d.plan.pr_tips ? el('div', {}, el('h3', {}, 'Opening the pull request'), el('p', {}, d.plan.pr_tips)) : null,
    el('p', {}, el('small', {}, `Model: ${d.model}. `), el('a', { href: d.issue.url, target: '_blank', rel: 'noopener' }, 'View the issue on GitHub')));
}

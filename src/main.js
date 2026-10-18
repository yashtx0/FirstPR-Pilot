import './style.css';
const MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];
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
    status(`Showing ${issues.length} issues (${source}). Pick one.`);
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
    try {
      data = await api({ action: 'plan', repo, issueNumber, model });
      if (data.stats && data.stats.total === 0) {
        status('The plan named no files. Trying once more…');
        try { const again = await api({ action: 'plan', repo, issueNumber, model }); if (again.stats && again.stats.total > 0) data = again; } catch {}
      }
      localStorage.setItem(key, JSON.stringify(data));
    }
    catch (err) { const saved = localStorage.getItem(key); if (!saved) throw err; data = JSON.parse(saved); }
    status('');
    render(data);
  } catch (err) { status(err.message, true); } finally { btn.disabled = false; }
}

// A missing path that has exactly one real file with the same (specific) filename is shown corrected to that file, and labelled as corrected.
function analyze(d) {
  const { stats } = d;
  const canFix = (r) => r.status === 'missing' && Array.isArray(r.suggest) && r.suggest.length === 1 && r.path.split('/').pop().replace(/\.[^.]*$/, '').length >= 7;
  const view = d.steps.map((s) => {
    let detail = s.detail;
    const refs = s.refs.map((r) => {
      if (!canFix(r)) return r;
      detail = detail.split(r.path).join(r.suggest[0]);
      return { path: r.suggest[0], status: 'ok', was: r.path, suggest: [] };
    });
    return { title: s.title, detail, refs };
  });
  const all = view.flatMap((s) => s.refs);
  const total = all.length;
  const missingRefs = all.filter((r) => r.status === 'missing');
  const verified = total - missingRefs.length;
  const remaining = new Set(missingRefs.map((r) => r.path)).size;
  const fixed = new Set(all.filter((r) => r.was).map((r) => r.was)).size;
  const none = total === 0;
  const parts = [];
  if (stats.caught) parts.push(`The first draft named ${stats.caught} file${stats.caught > 1 ? 's' : ''} that ${stats.caught > 1 ? 'do' : 'does'} not exist.`);
  if (fixed) parts.push(`The verifier matched ${fixed} to the real file in the repo and corrected ${fixed > 1 ? 'them' : 'it'} below.`);
  if (remaining) parts.push(`${remaining} still could not be verified, so check ${remaining > 1 ? 'them' : 'it'} by hand.`);
  else if (stats.caught && !fixed) parts.push('The plan was rewritten and now checks out.');
  if (!parts.length) parts.push('The first draft used only files that exist.');
  const note = none ? 'The plan names no files, so there was nothing to check. Run it again, or check the steps by hand.' : parts.join(' ');
  return { view, total, verified, remaining, none, note };
}

function render(d) {
  const { view, total, verified, remaining, none, note } = analyze(d);
  const hintStyle = 'font-size:0.85rem;margin:0.4rem 0 0;color:#7a1f1f;word-break:break-all';
  let n = 0;
  const steps = view.map((s) => {
    const hints = s.refs.filter((r) => r.status === 'missing' && Array.isArray(r.suggest) && r.suggest.length);
    const fixes = s.refs.filter((r) => r.was);
    return el('div', { class: 'step' },
      el('h3', {}, s.title), el('p', {}, s.detail),
      el('ul', { class: 'ledger' }, s.refs.map((r) => {
        const mark = r.status === 'missing' ? '−' : '+';
        const label = r.was ? 'corrected to real file' : { ok: 'found in repo', new: 'new file in existing folder', missing: 'not in repo' }[r.status];
        return el('li', { class: r.status, style: `animation-delay:${(n++) * 70}ms` }, el('b', {}, mark), el('span', {}, r.path), el('span', {}, label));
      })),
      ...fixes.map((r) => el('p', { class: 'hint', style: hintStyle }, el('b', {}, 'Corrected from the draft: '), r.was)),
      ...hints.map((r) => el('p', { class: 'hint', style: hintStyle }, el('b', {}, 'Did you mean: '), r.suggest.join(' or '))));
  });
  const p = d.plan;
  $('#result').replaceChildren(
    el('h2', {}, `#${d.issue.number} ${d.issue.title}`),
    el('p', {}, p.summary || '', ` Difficulty: ${p.difficulty || 'unknown'}.`),
    el('div', { class: 'summary' + (remaining || none ? ' warn' : '') }, el('b', {}, none ? 'No file references to verify.' : `${verified} of ${total} file references verified.`), ' ' + note),
    ...steps,
    (p.run_locally || []).length ? el('div', {}, el('h3', {}, 'Run it locally'), el('pre', {}, p.run_locally.join('\n'))) : null,
    p.how_to_test ? el('div', {}, el('h3', {}, 'Test your change'), el('p', {}, p.how_to_test)) : null,
    p.pr_tips ? el('div', {}, el('h3', {}, 'Opening the pull request'), el('p', {}, p.pr_tips)) : null,
    el('p', {}, el('small', {}, `Model: ${d.model}. `), el('a', { href: d.issue.url, target: '_blank', rel: 'noopener' }, 'View the issue on GitHub')));
}

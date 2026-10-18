import { MODELS, parseRepo, fetchIssues, fetchContext, buildMessages, callGroq, extractJson, verifyPlan } from '../lib/core.js';

const cache = new Map();

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
    const { action, repo, issueNumber, model } = req.body || {};
    const { owner, name } = parseRepo(repo);
    const { issues, source } = await fetchIssues(owner, name);
    if (action === 'issues') return res.status(200).json({ issues: issues.map(({ body, ...i }) => i), source });
    if (action !== 'plan') return res.status(400).json({ error: 'Unknown action' });
    if (!process.env.GROQ_API_KEY) return res.status(500).json({ error: 'GROQ_API_KEY is not set on the server.' });
    const issue = issues.find((i) => i.number === Number(issueNumber)) || issues[0];
    if (!issue) return res.status(404).json({ error: 'This repo has no open issues to work on.' });
    const chosen = MODELS.includes(model) ? model : MODELS[0];
    const key = `${owner}/${name}#${issue.number}:${chosen}`;
    if (cache.has(key)) return res.status(200).json({ ...cache.get(key), cached: true });

    const ctx = await fetchContext(owner, name);
    let plan;
    try { plan = extractJson(await callGroq(chosen, buildMessages(ctx, issue))); }
    catch (e) { if (!/did not return a plan|JSON/.test(e.message)) throw e; plan = extractJson(await callGroq(chosen, buildMessages(ctx, issue))); } // one retry on unparseable output
    let v = verifyPlan(plan, ctx);
    const caught = v.missing;
    let retried = false;
    if (caught.length) {
      try {
        plan = extractJson(await callGroq(chosen, buildMessages(ctx, issue, caught)));
        v = verifyPlan(plan, ctx);
        retried = true;
      } catch { /* keep the first draft; unverified paths stay flagged */ }
    }
    const out = {
      repo: `${owner}/${name}`, model: chosen, source,
      issue: { number: issue.number, title: issue.title, url: issue.url },
      plan: { summary: plan.summary, difficulty: plan.difficulty, run_locally: plan.run_locally, how_to_test: plan.how_to_test, pr_tips: plan.pr_tips },
      steps: v.steps,
      stats: { total: v.total, verified: v.verified, caught: caught.length, remaining: v.missing.length, retried, caughtPaths: caught },
    };
    cache.set(key, out);
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Something went wrong' });
  }
}

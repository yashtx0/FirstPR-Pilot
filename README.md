# FirstPR Pilot

A verified first-contribution guide for open-source newcomers.

Built for Hacktoberfest Hack Day Bengaluru 2026 | Track 2: Best Open-Source AI Project | Problem statement O3: Trustworthy and Verifiable AI

**Live demo:** `<PASTE LIVE VERCEL URL>`

## Why

Newcomers freeze at "where do I start?", and AI guidance that invents file names makes it worse.

## For whom

First-time open-source contributors, such as Hacktoberfest participants.

## What it does

1. You paste a public GitHub repo (for example `vitejs/vite`) and pick a model.
2. The app reads the repo's file tree, README and open issues (`good first issue` first, then `help wanted`, then the latest open issues) through the GitHub API.
3. You pick an issue. An open-weight model drafts a step-by-step plan: what to change, which files to edit, which files to create, commands to run locally, how to test, and tips for the pull request.
4. A **verifier** checks every file the plan names against the real repo tree:
   - **Green:** the file exists in the repo.
   - **Blue:** a new file in a folder that exists.
   - **Red:** the file does not exist, so the model invented it.
5. If the first draft names any red files, the model is shown the exact bad paths and rewrites the plan once. The page reports how many invented files were caught and how many references are verified.

You do not have to trust the model: every file claim shows whether it is true.

## Built with

- Open-weight models served by [Groq](https://groq.com): `gpt-oss-120b`, `gpt-oss-20b`, Llama 3.3 70B, Llama 3.1 8B. Swapping the model is a dropdown.
- The public GitHub REST API
- Vite (front end) and Vercel serverless functions (back end)
- MIT licensed

Groq is a hosted service, not open source. The models it serves are open-weight, and any open-weight model can be swapped in.

## Run locally

Requires Node 18 or newer.

```
npm install
npm test
cp .env.example .env
npm start
```

Fill in `.env` first:

| Variable | Needed | How to get it |
| --- | --- | --- |
| `GROQ_API_KEY` | Yes | Free key at console.groq.com |
| `GITHUB_TOKEN` | Recommended | GitHub token with **no permissions** (Settings, Developer settings). Raises the GitHub limit from 60 to 5000 requests per hour |

`npm start` runs `vercel dev`, which serves both the page and the `/api/plan` endpoint. Never commit `.env`.

## Deploy

1. Push this repo to GitHub.
2. Import it at vercel.com.
3. Add `GROQ_API_KEY` and `GITHUB_TOKEN` in the project settings, then redeploy.

## Project structure

| File | Purpose |
| --- | --- |
| `api/plan.js` | Serverless endpoint: lists issues, builds and verifies the plan, retries once |
| `lib/core.js` | GitHub fetching, prompt, Groq call, JSON parsing, verifier |
| `index.html`, `src/main.js`, `src/style.css` | The web page |
| `tests/verify.offline.test.mjs` | Offline test of the verifier (`npm test`) |
| `vercel.json` | Function time limit |

## Limits

- **Only file references are machine-verified.** Commands and explanations are not checked and still need human judgement.
- If a file is still red after the rewrite, the page warns you to check it by hand.
- The model sees only the 200 shallowest file paths of the repo, so on large repos it may guess deeper paths. The verifier still checks against the full tree.
- Very large repos can have truncated file trees, which can cause false red flags. Prefer small and medium repos.
- Groq's free tier is rate limited. Results are cached on the server and in the browser.

## Team

`<Aman Trivedi>`, `<Aayush Patil>`, `<Panav Pande>`

## Licence

MIT. See `LICENSE`.

// Run: GROQ_API_KEY=... npm run check-models
// Shows which of our dropdown models Groq currently serves.
import { MODELS } from '../lib/core.js';
const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` } });
if (!r.ok) { console.error('Groq said', r.status, '- is GROQ_API_KEY set?'); process.exit(1); }
const live = new Set((await r.json()).data.map((m) => m.id));
for (const m of MODELS) console.log(live.has(m) ? 'OK     ' : 'MISSING', m);
console.log('\nOther active chat models you could add:\n' + [...live].filter((id) => !MODELS.includes(id) && !/whisper|tts|guard|prompt-guard|compound/i.test(id)).join('\n'));

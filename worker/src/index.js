// Minimal Express server to expose the Puppeteer runner to the backend.
// POST /run accepts { steps: [...] } and returns the execution result.
import express from 'express';
import bodyParser from 'body-parser';
import { runScenario } from './runner.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// Accept JSON payloads with a reasonably small limit
app.use(bodyParser.json({ limit: '2mb' }));

const PORT = process.env.PORT || 4000;
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY || 2);
const OUT_DIR = path.join(__dirname, '..', 'output');
// Expose screenshots directory as static files
app.use('/output', express.static(OUT_DIR));

// Simple semaphore to limit concurrent runs
let active = 0;
const waitQueue = [];
function acquireSlot() {
  return new Promise(resolve => {
    if (active < CONCURRENCY) {
      active++;
      resolve(0);
    } else {
      const queuedAt = Date.now();
      waitQueue.push(() => { active++; resolve(Date.now() - queuedAt); });
    }
  });
}
function releaseSlot() {
  active = Math.max(0, active - 1);
  const next = waitQueue.shift();
  if (next) next();
}

app.post('/run', async (req, res) => {
  // Execute a scenario and respond with structured results
  const steps = req.body?.steps || [];
  const options = req.body?.options || {};
  let waitedMs = 0;
  try {
    waitedMs = await acquireSlot();
    const result = await runScenario(steps, OUT_DIR, options);
    res.json({ ...result, queuedMs: waitedMs, concurrency: CONCURRENCY });
  } catch (e) {
    res.status(500).json({ success: false, errors: [String(e)] });
  } finally {
    releaseSlot();
  }
});

app.listen(PORT, () => console.log('Worker listening on http://127.0.0.1:' + PORT));

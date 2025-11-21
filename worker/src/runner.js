// Worker-side scenario runner
// This module executes a list of high-level "steps" using Puppeteer and
// returns a structured result including success, per-step status, and a screenshot.
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

/**
 * Execute steps in Puppeteer with basic reliability features.
 * @param {Array} steps
 * @param {string} outDir
 * @param {Object} [options]
 * @param {boolean} [options.perStepScreenshot=false]
 * @param {number} [options.retries=0]           Number of retries per step on failure
 * @param {number} [options.backoffMs=500]       Backoff base in ms between retries
 * @param {number} [options.stepTimeoutMs=10000] Default puppeteer operation timeout
 * @param {boolean} [options.video=false]        Placeholder for future video support
 * @param {{width:number,height:number}} [options.viewport] Default viewport; scenario can override with a 'viewport' step
 * @param {boolean} [options.screenshotFullPage=false] Whether screenshots should capture full page (not just the viewport)
 * @param {number} [options.deviceScaleFactor=2] Pixel density multiplier (2 for crisp "retina-like" PNG)
 */
export function normalizeOptions(options = {}) {
  return {
    perStepScreenshot: Boolean(options.perStepScreenshot),
    retries: Number.isFinite(options.retries) ? Number(options.retries) : 0,
    backoffMs: Number.isFinite(options.backoffMs) ? Number(options.backoffMs) : 500,
    stepTimeoutMs: Number.isFinite(options.stepTimeoutMs) ? Number(options.stepTimeoutMs) : 10000,
    video: Boolean(options.video),
    viewport: {
      width: (options.viewport && Number.isFinite(options.viewport.width)) ? Number(options.viewport.width) : 1920,
      height: (options.viewport && Number.isFinite(options.viewport.height)) ? Number(options.viewport.height) : 1080,
    },
    screenshotFullPage: Boolean(options.screenshotFullPage),
    dsf: Number.isFinite(options.deviceScaleFactor) ? Math.max(1, Number(options.deviceScaleFactor)) : 2,
  };
}

export async function runScenario(steps, outDir, options = {}) {
  const cfg = normalizeOptions(options);
  // Launch a headless Chromium instance in a container-friendly way
  const browser = await puppeteer.launch({
    headless: true,
    // Ensure initial viewport and DPI are applied from the start
    defaultViewport: { width: cfg.viewport.width, height: cfg.viewport.height, deviceScaleFactor: cfg.dsf },
    // Window size + high DPI support; dsf ensures crisper PNGs (more backing pixels)
    args: ['--no-sandbox', '--disable-setuid-sandbox', `--window-size=${cfg.viewport.width},${cfg.viewport.height}`, '--high-dpi-support=1', `--force-device-scale-factor=${cfg.dsf}`],
  });
  const page = await browser.newPage();
  // Apply default timeouts broadly
  try { page.setDefaultTimeout(cfg.stepTimeoutMs); } catch {}
  // Set a sensible desktop-like default viewport to avoid "mobile"-looking pages
  try {
    await page.setViewport({ width: cfg.viewport.width, height: cfg.viewport.height, deviceScaleFactor: cfg.dsf, isMobile: false });
  } catch {}
  // Prefer a modern desktop User-Agent to avoid mobile/AMP variants
  try {
    const ua = (options && typeof options.userAgent === 'string' && options.userAgent.trim())
      ? options.userAgent.trim()
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36';
    await page.setUserAgent(ua);
  } catch {}
  // Collect per-step status and global errors
  const actions = [];
  const errors = [];
  let screenshotPath = null;
  const startedAt = Date.now();
  let uaApplied = '';

  try {
    // Iterate over each user-defined step and execute sequentially
    for (const [i, step] of steps.entries()) {
      const a = step.action;
      if (!a) { errors.push('Step '+i+': missing action'); continue; }
      const tsStart = Date.now();
      let attempts = 0;
      let lastErr = null;
      const execOnce = async () => {
        if (a === 'goto') {
          await page.goto(step.url, { waitUntil: 'networkidle2', timeout: 60000 });
        } else if (a === 'fill') {
          await page.waitForSelector(step.selector);
          await page.focus(step.selector);
          await page.evaluate((sel) => { const el = document.querySelector(sel); if (el) el.value = ''; }, step.selector);
          await page.type(step.selector, step.value ?? '', { delay: 20 });
        } else if (a === 'click') {
          await page.waitForSelector(step.selector);
          await page.click(step.selector);
          await page.waitForNetworkIdle({ timeout: 30000 }).catch(()=>{});
        } else if (a === 'expectText') {
          await page.waitForSelector(step.selector);
          const text = await page.$eval(step.selector, el => el.innerText || el.textContent || '');
          if (!String(text).includes(String(step.text ?? ''))) throw new Error('Text not found: '+step.text);
        } else if (a === 'wait') {
          const ms = Number(step.ms || step.timeout || 0);
          if (ms > 0) { await new Promise(r => setTimeout(r, ms)); }
        } else if (a === 'waitFor' || a === 'waitForSelector') {
          const to = Number(step.timeout || cfg.stepTimeoutMs);
          await page.waitForSelector(step.selector, { timeout: to });
        } else if (a === 'hover') {
          await page.waitForSelector(step.selector);
          await page.hover(step.selector);
        } else if (a === 'select') {
          await page.waitForSelector(step.selector);
          const vals = Array.isArray(step.value) ? step.value : [String(step.value ?? '')];
          await page.select(step.selector, ...vals);
        } else if (a === 'scroll') {
          await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) throw new Error('Selector not found: '+sel);
            el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'center' });
          }, step.selector);
        } else if (a === 'press') {
          if (step.selector) {
            await page.waitForSelector(step.selector);
            await page.focus(step.selector);
          }
          const key = String(step.key || '').trim();
          if (!key) throw new Error('Missing key');
          await page.keyboard.press(key);
        } else if (a === 'expectUrl') {
          const cur = page.url();
          const contains = String(step.contains || step.urlContains || step.text || '').trim();
          if (!contains || !cur.includes(contains)) throw new Error('URL does not contain '+contains+' (current: '+cur+')');
        } else if (a === 'expectTitle') {
          const title = await page.title();
          const expected = String(step.text || step.contains || '').trim();
          if (!expected || !title.includes(expected)) throw new Error('Title does not contain '+expected+' (title: '+title+')');
        } else if (a === 'expectVisible') {
          await page.waitForSelector(step.selector, { visible: true });
          const isVisible = await page.$eval(step.selector, el => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          });
          if (!isVisible) throw new Error('Element not visible: '+step.selector);
        } else if (a === 'expectHidden') {
          const exists = await page.$(step.selector);
          if (exists) {
            const isHidden = await page.$eval(step.selector, el => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return rect.width === 0 || rect.height === 0 || style.visibility === 'hidden' || style.display === 'none';
            });
            if (!isHidden) throw new Error('Element should be hidden but is visible: '+step.selector);
          }
        } else if (a === 'expectAttribute') {
          await page.waitForSelector(step.selector);
          const attr = String(step.attribute || '').trim();
          if (!attr) throw new Error('Missing attribute name');
          const actual = await page.$eval(step.selector, (el, a) => el.getAttribute(a), attr);
          const expected = String(step.value ?? '').trim();
          // If expected is an empty string, interpret as "attribute must exist" (not necessarily empty)
          if (expected === '') {
            if (actual === null) throw new Error('Attribute '+attr+' not present on selector '+step.selector);
          } else {
            if (actual !== expected) throw new Error('Attribute '+attr+' expected "'+expected+'" but got "'+actual+'"');
          }
        } else if (a === 'expectCount') {
          const elements = await page.$$(step.selector);
          const actual = elements.length;
          const expected = Number(step.count ?? 0);
          if (actual !== expected) throw new Error('Expected '+expected+' elements but found '+actual+' for selector '+step.selector);
        } else if (a === 'screenshot') {
          if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
          const file = 'screenshot-'+Date.now()+'.png';
          const full = path.join(outDir, file);
          const fullPage = (typeof step.fullPage === 'boolean') ? step.fullPage : cfg.screenshotFullPage;
          await page.screenshot({ path: full, type: 'png', fullPage, omitBackground: false });
          screenshotPath = '/output/'+file;
        } else if (a === 'viewport') {
          const width = Number(step.width || 1280);
          const height = Number(step.height || 800);
          await page.setViewport({ width, height });
        } else if (a === 'userAgent') {
          const ua = String(step.ua || step.userAgent || '').trim();
          if (!ua) throw new Error('Missing user agent');
          await page.setUserAgent(ua);
          uaApplied = ua;
        } else {
          throw new Error('Unknown action: '+a);
        }
      };

      let ok = false;
      for (attempts = 0; attempts <= cfg.retries; attempts++) {
        try {
          await execOnce();
          ok = true;
          break;
        } catch (e) {
          lastErr = e;
          if (attempts < cfg.retries) {
            const delay = cfg.backoffMs * (attempts + 1);
            await new Promise(r => setTimeout(r, delay));
          }
        }
      }

      const tsEnd = Date.now();
      const record = { index: i, action: a, ok, attempts: attempts + 1, startedAt: tsStart, finishedAt: tsEnd, durationMs: tsEnd - tsStart };
      if (!ok) {
        const msg = 'Step '+i+' ('+a+'): '+String(lastErr);
        errors.push(msg);
        record.error = String(lastErr);
        actions.push(record);
        break;
      } else {
        // Optional per-step screenshot after success
        if (cfg.perStepScreenshot) {
          try {
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
            const file = 'step-'+i+'-'+Date.now()+'.png';
            const full = path.join(outDir, file);
            await page.screenshot({ path: full, type: 'png', fullPage: cfg.screenshotFullPage, omitBackground: false });
            record.screenshotPath = '/output/'+file;
          } catch {}
        }
        actions.push(record);
      }
    }
  } finally {
    try {
      // Always try to capture a final screenshot for debugging
      if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
      const file = 'screenshot-'+Date.now()+'.png';
      const full = path.join(outDir, file);
      await page.screenshot({ path: full, type: 'png', fullPage: cfg.screenshotFullPage, omitBackground: false }).catch(()=>{});
      screenshotPath = '/output/'+file;
    } catch {}
    // Ensure Chromium is closed
    await browser.close();
  }
  // Overall success is true if no errors occurred
  return {
    success: errors.length === 0,
    steps: actions,
    errors,
    screenshotPath,
    startedAt,
    finishedAt: Date.now(),
    durationMs: Date.now() - startedAt,
    meta: {
      viewport: { width: cfg.viewport.width, height: cfg.viewport.height },
      deviceScaleFactor: cfg.dsf,
      screenshotFullPage: cfg.screenshotFullPage,
      userAgent: uaApplied,
    }
  };
}

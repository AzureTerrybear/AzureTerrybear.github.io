// Local AI helpers for the VALID-AI Assessment Designer.
//
// Three optional helpers, each run only when the person clicks it:
//   1. Start from your assignment: suggests the five starting answers from pasted text.
//   2. Draft the blanks: fills the blanks in the assignment template.
//   3. Tailor to my course: rewrites the rubric descriptors for this course.
//
// The model runs on this computer, in the browser (WebLLM) or through Ollama, so
// nothing the person types is sent anywhere. AI text only goes where the person
// can already edit, stays marked until they edit it, never replaces their own
// edits, and can be undone. The helpers are hidden on devices that can't run a model.

import {
  detectWebGPU, browserModels, recommendBrowserModel, detectOllama,
  createBrowserEngine, createOllamaEngine, isAbort
} from "./llm.js";
import { intakeTask, blanksTask, tailorTask, reviewTask, variantTask, VARIANTS, clipText, wordCount, TEXT_LIMITS } from "./tasks.js";

// Same key as the previous version of the site, so the model choice carries over.
const PREFS_KEY = "valid-ai-designer-ai-prefs-v1";

const svg = (paths, size = 16, extra = "") => `<svg class="valid-svg${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths}</svg>`;
// The sparkle marks AI controls and AI text only.
const sparkle = (size = 16) => svg('<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z"/><path d="M19 3v4M21 5h-4"/><path d="M5 17v3M6.5 18.5h-3"/>', size, " valid-ai-icon");
const closeIcon = () => svg('<path d="M18 6 6 18M6 6l12 12"/>', 16);

const esc = (value) => String(value ?? "")
  .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

let app = null;
const $ = (selector) => app.root.querySelector(selector);
const $$ = (selector) => [...app.root.querySelectorAll(selector)];

/* ---------- Preferences and status ---------- */

function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}");
    return {
      model: typeof p.model === "string" ? p.model : "",
      useOllama: Boolean(p.useOllama),
      downloaded: Array.isArray(p.downloaded) ? p.downloaded.filter((id) => typeof id === "string") : [],
      enabled: p.enabled !== false
    };
  } catch {
    return { model: "", useOllama: false, downloaded: [], enabled: true };
  }
}

const ai = {
  checked: false,        // device check finished
  gpu: null,
  browser: [],           // in-browser model options
  ollama: [],            // models found on a local Ollama server
  recommended: "",
  ollamaState: "idle",   // idle | connecting | connected | failed
  ollamaMessage: "",
  engine: null,
  engineKey: "",
  loadingPct: null,      // model download or load progress, for the status chip
  busy: null,            // { feature, controller } while a helper runs
  prefs: loadPrefs()
};

function savePrefs() {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(ai.prefs)); } catch { /* storage unavailable */ }
}

const choiceValue = (model) => `${model.kind}:${model.id}`;
const allModels = () => [...ai.ollama, ...ai.browser];
const modelName = (model) => (model.kind === "ollama" ? model.id : model.label);
const available = () => ai.prefs.enabled && allModels().length > 0;
const isDownloaded = (model) => model.kind !== "browser" || ai.prefs.downloaded.includes(model.id);

function currentModel() {
  return allModels().find((m) => choiceValue(m) === ai.prefs.model)
    ?? ai.ollama[0]
    ?? ai.browser.find((m) => m.id === ai.recommended)
    ?? ai.browser[0]
    ?? null;
}

const announce = (text) => {
  const node = $("#valid-ai-announcer");
  if (node) node.textContent = text;
};

// Errors that mean the in-browser engine's internal state is broken and needs a reload.
function isStaleEngine(err) {
  return /deleted object|BindingError|GrammarMatcher|already been disposed|disposed/i.test(String(err?.message ?? err) + String(err?.name ?? ""));
}

function isFatal(err) {
  return /out of memory|OOM|device (was )?lost|DeviceLost|GPUDevice|allocate/i.test(String(err?.message ?? err));
}

// A plain sentence for the person. Known problems get advice; anything else is shown as is.
function friendlyError(err, model) {
  const message = String(err?.message ?? err);
  const name = modelName(model);
  if (model.kind === "ollama" && (err instanceof TypeError || /Failed to fetch|NetworkError|Load failed/i.test(message))) {
    return "Couldn't reach Ollama. Check that it's running and that OLLAMA_ORIGINS includes this site.";
  }
  if (isFatal(err)) return `${name} ran out of graphics memory. Pick a smaller model in Local AI settings and try again.`;
  if (/ran out of room/i.test(message)) return `${name} ran out of room before it finished. Try again, or shorten your assignment text.`;
  if (/context window|context length|too long/i.test(message)) {
    return `Your text is too long for ${name}. Shorten it, or connect Ollama, which can read longer text.`;
  }
  if (model.kind === "browser" && /Failed to fetch|NetworkError|Load failed|ERR_|importing a module script failed|dynamically imported module/i.test(message)) {
    return `Couldn't download the AI library or ${name}. Check your internet connection (and that cdn.jsdelivr.net and huggingface.co aren't blocked on this network), then try again.`;
  }
  if (/WebGPU|navigator\.gpu|adapter/i.test(message)) return "This browser couldn't start WebGPU. Try Chrome or Edge, or connect Ollama in Local AI settings.";
  if (/did not return JSON|Unexpected token|JSON/i.test(message)) return `${name}'s answer wasn't in the expected format. Try again, or pick a larger model.`;
  if (/^Ollama/.test(message) || /ollama pull/.test(message)) return message;
  return `${name} stopped with an error: ${message}`;
}

/* ---------- Status chip ---------- */

function buildChip() {
  const row = $(".valid-title-row") ?? $("#valid-header");
  if (!row) return;
  row.insertAdjacentHTML("beforeend", `
    <button class="valid-ai-chip" id="valid-ai-chip" type="button" aria-haspopup="dialog" data-state="checking">
      <span class="valid-ai-chip-dot" aria-hidden="true"></span><span>Local AI</span><span class="valid-ai-chip-detail"></span>
    </button>`);
  $("#valid-ai-chip").addEventListener("click", openSettings);
}

function renderChip() {
  const chip = $("#valid-ai-chip");
  if (!chip) return;
  const model = currentModel();
  let state = "idle";
  let detail = model ? modelName(model) : "";
  if (!ai.checked) { state = "checking"; detail = ""; }
  else if (!available()) { state = "off"; detail = "off"; }
  else if (ai.loadingPct !== null) { state = "loading"; detail = `loading ${ai.loadingPct}%`; }
  else if (ai.busy) { state = "busy"; detail = "working"; }
  else if (ai.engine && model && ai.engineKey === choiceValue(model)) state = "loaded";
  chip.dataset.state = state;
  const node = chip.querySelector(".valid-ai-chip-detail");
  if (node.textContent !== detail) node.textContent = detail;
  node.hidden = !detail;
}

/* ---------- Settings dialog ---------- */

function buildDialog() {
  const dialog = document.createElement("dialog");
  dialog.className = "valid-ai-dialog";
  dialog.id = "valid-ai-dialog";
  dialog.setAttribute("aria-labelledby", "valid-ai-dialog-title");
  dialog.innerHTML = `
    <div class="valid-ai-dialog-head">
      <h2 id="valid-ai-dialog-title">${sparkle(18)}Local AI</h2>
      <button class="btn" type="button" data-close-ai>${closeIcon()}Close</button>
    </div>
    <div class="valid-ai-dialog-body">
      <p>Three optional helpers use an AI model that runs on this computer. What you type and paste stays here: nothing is sent to an AI company.</p>
      <ul class="valid-ai-uses">
        <li><strong>Start from your assignment</strong> suggests answers to the five starting questions from an assignment you paste.</li>
        <li><strong>Draft the blanks</strong> fills in the assignment template.</li>
        <li><strong>Tailor to my course</strong> rewrites the rubric descriptors for your course.</li>
      </ul>
      <p>Each one runs only when you click it. AI text stays marked until you edit it, never replaces your own edits, and can be undone.</p>
      <section class="valid-ai-section" aria-labelledby="valid-ai-model-title">
        <h3 id="valid-ai-model-title">Model</h3>
        <div id="valid-ai-model-field">
          <label class="form-label text-small" for="valid-ai-model">Run the helpers with
            <select class="form-select" id="valid-ai-model"></select>
          </label>
        </div>
        <p class="text-small" id="valid-ai-model-note"></p>
      </section>
      <section class="valid-ai-section" aria-labelledby="valid-ai-text-title">
        <h3 id="valid-ai-text-title"><label for="valid-ai-text">Your assignment text</label></h3>
        <textarea class="form-control" id="valid-ai-text" rows="4" aria-describedby="valid-ai-text-note"></textarea>
        <p class="text-small" id="valid-ai-text-note">Optional. The helpers use it as background about your course. It stays in this browser, and Start over keeps it.</p>
      </section>
      <section class="valid-ai-section" aria-labelledby="valid-ai-ollama-title">
        <h3 id="valid-ai-ollama-title">Ollama</h3>
        <p class="text-small">If you use <a href="https://ollama.com">Ollama</a> on this computer, connect to it to use a larger model.</p>
        <p><button class="btn" type="button" id="valid-ai-ollama">Connect to Ollama</button></p>
        <p class="text-small" id="valid-ai-ollama-status" role="status"></p>
        <details class="text-small">
          <summary>Set up Ollama for this site</summary>
          <ol>
            <li>Install Ollama and download a model, for example <code>ollama pull qwen3:8b</code>.</li>
            <li>Let this site reach it: set <code>OLLAMA_ORIGINS</code> to <code>${esc(window.location.origin)}</code>, then restart Ollama.</li>
            <li>Select <strong>Connect to Ollama</strong>. If your browser asks to allow access to devices on your network, allow it.</li>
          </ol>
        </details>
      </section>
      <label class="valid-ai-toggle"><input type="checkbox" id="valid-ai-enabled"> Show the AI helpers on this device</label>
    </div>`;
  app.root.append(dialog);

  dialog.querySelector("[data-close-ai]").addEventListener("click", () => dialog.close());
  // Escape closes this dialog only, not the drawer underneath.
  dialog.addEventListener("keydown", (event) => { if (event.key === "Escape") event.stopPropagation(); });
  dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
  dialog.querySelector("#valid-ai-model").addEventListener("change", (event) => {
    ai.prefs.model = event.target.value;
    savePrefs();
    renderSettings();
    renderChip();
  });
  dialog.querySelector("#valid-ai-ollama").addEventListener("click", () => {
    if (ai.ollamaState === "connected") {
      ai.ollama = [];
      ai.ollamaState = "idle";
      ai.ollamaMessage = "Disconnected from Ollama.";
      ai.prefs.useOllama = false;
      if (ai.prefs.model.startsWith("ollama:")) ai.prefs.model = "";
      savePrefs();
      if (ai.engine?.kind === "ollama") disposeEngine();
      applyAvailability();
    } else {
      connectOllama();
    }
  });
  dialog.querySelector("#valid-ai-text").addEventListener("input", (event) => {
    app.state.assignmentText = event.target.value;
    const intake = $("#valid-assignment-text");
    if (intake) intake.value = event.target.value;
    app.scheduleSave();
  });
  dialog.querySelector("#valid-ai-enabled").addEventListener("change", (event) => {
    ai.prefs.enabled = event.target.checked;
    savePrefs();
    if (!ai.prefs.enabled && !ai.busy) disposeEngine();
    applyAvailability();
  });
}

function openSettings() {
  const dialog = $("#valid-ai-dialog");
  dialog.querySelector("#valid-ai-text").value = pastedText();
  renderSettings();
  if (!dialog.open) dialog.showModal();
}

function modelOptionText(model) {
  if (model.kind === "ollama") return model.size ? `${model.id} · ${model.size}` : model.id;
  const parts = [`${model.label}${model.id === ai.recommended ? " (recommended)" : ""}`, model.note];
  parts.push(isDownloaded(model) ? "downloaded" : `about ${model.downloadGB} GB download`);
  return parts.join(" · ");
}

function renderSettings() {
  const dialog = $("#valid-ai-dialog");
  if (!dialog) return;
  const picker = dialog.querySelector("#valid-ai-model");
  const group = (label, models) => (models.length
    ? `<optgroup label="${esc(label)}">${models.map((m) => `<option value="${esc(choiceValue(m))}">${esc(modelOptionText(m))}</option>`).join("")}</optgroup>`
    : "");
  picker.innerHTML = group("Ollama on this computer", ai.ollama) + group("In this browser", ai.browser);
  const model = currentModel();
  if (model) picker.value = choiceValue(model);
  picker.disabled = Boolean(ai.busy);
  dialog.querySelector("#valid-ai-model-field").hidden = !model;

  let note;
  if (!ai.checked) note = "Checking what this device can run…";
  else if (!model) note = "This browser can't run AI models, because it doesn't support WebGPU. Chrome or Edge on a recent computer can, or you can connect Ollama below. Everything else in the tool works without AI.";
  else if (model.kind === "ollama") note = "Runs in Ollama on this computer.";
  else if (isDownloaded(model)) note = `Runs in this browser. ${model.label} is already downloaded, so it loads from the browser's storage. It needs about ${(model.vramMB / 1024).toFixed(1)} GB of graphics memory.`;
  else note = `Runs in this browser. The first run downloads ${model.label} (about ${model.downloadGB} GB) once; after that it loads from the browser's storage. It needs about ${(model.vramMB / 1024).toFixed(1)} GB of graphics memory.`;
  dialog.querySelector("#valid-ai-model-note").textContent = note;

  const ollamaButton = dialog.querySelector("#valid-ai-ollama");
  ollamaButton.textContent = ai.ollamaState === "connecting" ? "Connecting…"
    : ai.ollamaState === "connected" ? "Disconnect Ollama"
      : ai.ollamaState === "failed" ? "Try connecting again" : "Connect to Ollama";
  ollamaButton.disabled = ai.ollamaState === "connecting" || Boolean(ai.busy);
  const status = dialog.querySelector("#valid-ai-ollama-status");
  const statusText = ai.ollamaMessage || (ai.ollamaState === "connected" ? `Connected. ${ai.ollama.length} model${ai.ollama.length === 1 ? "" : "s"} available.` : "");
  if (status.textContent !== statusText) status.textContent = statusText;
  dialog.querySelector("#valid-ai-enabled").checked = ai.prefs.enabled;
}

// Only after the person asks (or connected before): Chrome may ask them to allow
// access to devices on the local network.
async function connectOllama({ automatic = false } = {}) {
  ai.ollamaState = "connecting";
  ai.ollamaMessage = automatic ? "" : "Connecting to Ollama…";
  renderSettings();
  const { reachable, models } = await detectOllama();
  ai.ollama = models;
  if (reachable && models.length) {
    ai.ollamaState = "connected";
    ai.prefs.useOllama = true;
    if (!automatic) ai.prefs.model = choiceValue(models[0]);
    ai.ollamaMessage = automatic ? "" : `Connected. The helpers will use ${models[0].id}.`;
    savePrefs();
  } else if (automatic) {
    ai.ollamaState = "idle";
    ai.ollamaMessage = "";
  } else {
    ai.ollamaState = "failed";
    ai.ollamaMessage = reachable
      ? "Ollama is running but has no chat models yet. Run “ollama pull qwen3:8b”, then connect again."
      : `Couldn't reach Ollama at localhost:11434. Check that it's running and that OLLAMA_ORIGINS includes ${window.location.origin}.`;
  }
  applyAvailability();
}

function applyAvailability() {
  document.documentElement.classList.toggle("has-local-ai", available());
  syncBusy();
  renderSettings();
  renderChip();
}

/* ---------- Running a helper ---------- */

// Each helper has a status area for progress, questions, and results. `home` is the
// helper's button, where keyboard focus goes back when the area closes.
function makeRunArea(id, home) {
  const area = document.createElement("div");
  area.className = "valid-ai-run";
  area.id = id;
  area.dataset.home = home;
  area.hidden = true;
  area.innerHTML = `
    <div class="valid-ai-run-row"><span class="valid-ai-run-text"></span><span class="valid-ai-run-actions"></span></div>
    <div class="valid-ai-bar" aria-hidden="true"><span></span></div>`;
  return area;
}

function setRunArea(area, { text = "", fraction = null, kind = "progress", actions = [] }) {
  area.hidden = false;
  area.classList.toggle("is-error", kind === "error");
  area.classList.toggle("is-done", kind !== "progress");
  const label = area.querySelector(".valid-ai-run-text");
  if (label.textContent !== text) label.textContent = text;
  const bar = area.querySelector(".valid-ai-bar > span");
  if (fraction !== null) bar.style.width = `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
  const holder = area.querySelector(".valid-ai-run-actions");
  const signature = actions.map((a) => a.label).join("|");
  if (holder.dataset.actions !== signature) {
    const hadFocus = holder.contains(document.activeElement);
    holder.dataset.actions = signature;
    holder.replaceChildren(...actions.map((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn${action.ghost ? " btn-ghost" : ""}`;
      button.textContent = action.label;
      button.addEventListener("click", action.onClick);
      return button;
    }));
    if (hadFocus) holder.querySelector("button")?.focus();
  }
}

function focusHome(area) {
  const home = document.getElementById(area.dataset.home);
  if (home && !home.disabled) home.focus();
}

function hideRunArea(area) {
  const hadFocus = area.contains(document.activeElement);
  area.hidden = true;
  const holder = area.querySelector(".valid-ai-run-actions");
  holder.replaceChildren();
  holder.dataset.actions = "";
  if (hadFocus) focusHome(area);
}

const dismiss = (area) => ({ label: "Dismiss", ghost: true, onClick: () => hideRunArea(area) });

function syncBusy() {
  $$(".valid-ai-btn").forEach((button) => { button.disabled = Boolean(ai.busy); });
  $("#valid-ai-dialog") && renderSettings();
  renderChip();
}

async function disposeEngine() {
  const engine = ai.engine;
  ai.engine = null;
  ai.engineKey = "";
  if (engine) await engine.dispose().catch(() => {});
  renderChip();
}

async function getEngine(model, signal, onProgress) {
  const key = choiceValue(model);
  if (ai.engine && ai.engineKey === key) return ai.engine;
  await disposeEngine();
  if (model.kind === "ollama") {
    ai.engine = createOllamaEngine(model);
  } else {
    navigator.storage?.persist?.().catch(() => {});
    announce(`Loading ${model.label}.`);
    try {
      ai.engine = await createBrowserEngine(model, {
        signal,
        onLoadProgress: (fraction, text) => {
          const pct = Math.round(fraction * 100);
          ai.loadingPct = pct;
          renderChip();
          if (/fetch/i.test(text)) onProgress(fraction, `Downloading ${model.label} (first time only): ${pct}%`);
          else if (/load/i.test(text)) onProgress(fraction, `Loading ${model.label} into graphics memory: ${pct}%`);
          else onProgress(fraction, `Preparing ${model.label}…`);
        }
      });
    } finally {
      ai.loadingPct = null;
    }
    if (!ai.prefs.downloaded.includes(model.id)) {
      ai.prefs.downloaded.push(model.id);
      savePrefs();
    }
  }
  ai.engineKey = key;
  renderChip();
  return ai.engine;
}

// The first run of an in-browser model downloads it, so ask first. Only one question
// is open at a time: starting another helper answers "no" to the earlier one.
let pendingDownload = null; // { answer, area }

function cancelDownloadQuestion() {
  if (!pendingDownload) return;
  const { answer, area } = pendingDownload;
  answer(false);
  hideRunArea(area);
}

function askToDownload(area, model) {
  cancelDownloadQuestion();
  return new Promise((resolve) => {
    const answer = (yes) => {
      if (pendingDownload?.answer === answer) pendingDownload = null;
      resolve(yes);
    };
    pendingDownload = { answer, area };
    setRunArea(area, {
      kind: "confirm",
      text: `The first run downloads ${model.label} (about ${model.downloadGB} GB) to this browser. That happens once and can take several minutes; after that it loads from the browser's storage.`,
      actions: [
        { label: "Download and run", onClick: () => answer(true) },
        { label: "Cancel", ghost: true, onClick: () => { answer(false); hideRunArea(area); } }
      ]
    });
    area.querySelector(".valid-ai-run-actions .btn")?.focus();
  });
}

// prepare(kind) returns { task, label } or { message } when there's nothing to do.
// apply(result, job) changes the page and returns { text } to show, or { hide, announce }.
async function runHelper(feature, area, { prepare, apply }) {
  if (ai.busy) return;
  const model = currentModel();
  if (!model) { openSettings(); return; }
  const job = prepare(model.kind);
  if (job.message) {
    setRunArea(area, { kind: "done", text: job.message, actions: [dismiss(area)] });
    announce(job.message);
    return;
  }
  if (!isDownloaded(model) && !(ai.engine && ai.engineKey === choiceValue(model))) {
    const go = await askToDownload(area, model);
    if (!go) return;
    if (ai.busy) {
      setRunArea(area, { kind: "done", text: "Another AI helper is running. Try again when it finishes.", actions: [dismiss(area)] });
      return;
    }
  }

  const controller = new AbortController();
  const { signal } = controller;
  // The helper's button is disabled while it runs, so keyboard focus moves to Stop.
  const homeHadFocus = document.activeElement === document.getElementById(area.dataset.home);
  ai.busy = { feature, controller };
  syncBusy();
  const stop = { label: "Stop", ghost: true, onClick: () => controller.abort() };
  const progress = (fraction, text) => setRunArea(area, { text, fraction, actions: [stop] });
  const label = `${job.label} with ${modelName(model)}…`;

  try {
    const loaded = ai.engine && ai.engineKey === choiceValue(model);
    progress(0, loaded ? label : model.kind === "browser" ? "Starting the AI…" : `Connecting to ${model.id}…`);
    if (homeHadFocus) area.querySelector(".valid-ai-run-actions .btn")?.focus();
    const engine = await getEngine(model, signal, progress);
    if (signal.aborted) throw new DOMException("Stopped", "AbortError");
    announce(`${job.label}.`);
    progress(0.02, label);
    const generate = (eng) => eng.generate(job.task.messages, job.task.schema, {
      maxTokens: job.task.maxTokens,
      signal,
      onProgress: (chars) => progress(Math.min(0.97, 0.02 + chars / job.task.expected), label)
    });
    let raw;
    try {
      raw = await generate(engine);
    } catch (err) {
      // WebLLM can lose its JSON grammar state between requests ("Cannot pass deleted object as a
      // pointer of type GrammarMatcher"). Reloading the model from the browser's storage fixes it.
      if (model.kind !== "browser" || signal.aborted || !isStaleEngine(err)) throw err;
      progress(0.02, `Restarting ${model.label}…`);
      await disposeEngine();
      raw = await generate(await getEngine(model, signal, progress));
    }
    if (signal.aborted) throw new DOMException("Stopped", "AbortError");
    console.info(`[VALID-AI] ${feature} answer from ${modelName(model)}:`, raw);
    const report = apply(job.task.validate(raw), job);
    if (report.hide) hideRunArea(area);
    else setRunArea(area, { kind: "done", text: report.text, actions: [dismiss(area)] });
    announce(report.announce || report.text || "Done.");
  } catch (err) {
    if (isAbort(err) || signal.aborted) {
      setRunArea(area, { kind: "done", text: "Stopped. Nothing was changed.", actions: [dismiss(area)] });
      announce("Stopped.");
    } else {
      const message = friendlyError(err, model);
      setRunArea(area, {
        kind: "error",
        text: message,
        actions: [{ label: "Local AI settings", ghost: true, onClick: openSettings }, dismiss(area)]
      });
      announce(message);
      if (isFatal(err) || !ai.engine) await disposeEngine();
    }
  } finally {
    ai.busy = null;
    ai.loadingPct = null;
    syncBusy();
    // If the focused Stop button went away, put focus somewhere sensible.
    if (!document.activeElement || document.activeElement === document.body) {
      if (area.hidden) focusHome(area);
      else area.querySelector(".valid-ai-run-actions .btn")?.focus();
    }
  }
}

/* ---------- Plan context for the prompts ---------- */

function planContext() {
  const s = app.state;
  const top = app.rankedPatterns()[0]?.pattern;
  return {
    subject: app.contextLabels[s.context],
    delivery: app.labels.delivery[s.delivery],
    purpose: app.labels.purposeType[s.purposeType],
    capability: app.labels.outcome[s.outcome],
    skills: app.wording("skills"),
    evidence: app.labels.evidenceType[s.evidenceType],
    product: app.wording("product"),
    accountability: app.labels.accountability[s.accountability],
    approach: top ? `${top.name}: ${top.description}` : "",
    aiRole: app.labels.aiRole[s.aiRole],
    aiasLevel: app.labels.aiasLevel[app.resolvedAIAS()],
    aiRules: app.wording("allowed"),
    undermine: app.wording("undermine"),
    verification: app.labels.verification[s.verification]
  };
}

const pastedText = () => String(app.state.assignmentText || "").trim();

/* ---------- 1. Start from your assignment ---------- */

const SKILL_HINTS = {
  knowledge: "recall and explain concepts accurately",
  analysis: "evaluate claims, sources, data, or arguments",
  application: "apply a method to a new or unfamiliar problem",
  performance: "a hands-on, clinical, lab, studio, or live performance",
  creation: "make an original product, design, or work",
  communication: "explain ideas for an audience, or reflect on learning",
  judgment: "work in a team or make a professional decision"
};
const PURPOSE_HINTS = {
  formative: "practice with feedback that counts little or nothing toward the grade",
  summative: "graded to show what students learned",
  both: "practice stages first, then a graded stage"
};
const DELIVERY_HINTS = {
  classroom: "a course that meets in person",
  async: "a fully online course without scheduled meetings"
};
const INDEPENDENT_HINTS = {
  yes: "the text says AI is not allowed, or the work is done in supervised, closed-book, or exam conditions",
  no: "the text says students may or must use AI tools"
};

function intakeQuestions() {
  const options = (map, hints = {}, skip = []) => Object.entries(map)
    .filter(([value]) => !skip.includes(value))
    .map(([value, label]) => ({ value, label, hint: hints[value] || "" }));
  return [
    { key: "context", name: "subject", ask: "the subject area of the course", options: options(app.contextLabels), infer: true },
    { key: "outcome", name: "skill", ask: "the main thing students must show", options: options(app.short.outcome, SKILL_HINTS), infer: true },
    { key: "purposeType", name: "purpose", ask: "whether the work is practice or graded", options: options(app.short.purposeType, PURPOSE_HINTS) },
    { key: "delivery", name: "delivery", ask: "how the course is delivered", options: options(app.short.delivery, DELIVERY_HINTS) },
    { key: "independent", name: "independent", ask: "whether students must show they can do this without AI", options: options(app.short.independent, INDEPENDENT_HINTS, ["unsure"]) }
  ];
}

const startSelect = (key) => $(`#valid-${key}-start`);
let applyingSuggestion = false; // true while the intake sets an answer, so its own change isn't taken as the person's

function removeSuggestion(key) {
  const note = $(`#valid-ai-suggest-${key}`);
  if (!note) return;
  note.remove();
  const select = startSelect(key);
  if (select?.getAttribute("aria-describedby") === note.id) select.removeAttribute("aria-describedby");
}

function clearSuggestions() {
  intakeQuestions().forEach((q) => removeSuggestion(q.key));
}

function addSuggestion(key, text, unsure) {
  const select = startSelect(key);
  const group = select?.closest(".valid-field-group");
  if (!group) return;
  removeSuggestion(key);
  const note = document.createElement("p");
  note.className = `valid-ai-suggest${unsure ? " is-unsure" : ""}`;
  note.id = `valid-ai-suggest-${key}`;
  note.innerHTML = `${sparkle(14)}<span>${esc(text)}</span>`;
  group.append(note);
  select.setAttribute("aria-describedby", note.id);
}

function setupIntake() {
  const start = $("#valid-start");
  if (!start) return;
  const box = document.createElement("div");
  box.className = "valid-intake valid-ai-only";
  box.id = "valid-intake";
  box.innerHTML = `
    <label class="form-label" for="valid-assignment-text">Start from your current assignment<span class="valid-optional">Optional</span></label>
    <p class="valid-intake-help text-small" id="valid-intake-help">Paste the assignment you give students now. Local AI suggests answers to the five questions below, quoting your text. The template and rubric helpers use it later too.</p>
    <textarea class="form-control" id="valid-assignment-text" rows="4" aria-describedby="valid-intake-help valid-intake-privacy"></textarea>
    <div class="valid-intake-actions">
      <button class="btn valid-ai-btn" id="valid-intake-run" type="button">${sparkle(16)}Suggest answers from this</button>
      <span class="text-small" id="valid-intake-privacy">Runs on this computer. Nothing you paste leaves it.</span>
    </div>`;
  const area = makeRunArea("valid-intake-status", "valid-intake-run");
  box.append(area);
  const anchor = start.querySelector(".valid-how") ?? start.querySelector("h2");
  anchor.after(box);

  const textarea = box.querySelector("#valid-assignment-text");
  textarea.value = pastedText();
  textarea.addEventListener("input", () => {
    app.state.assignmentText = textarea.value;
    app.scheduleSave();
  });

  intakeQuestions().forEach((q) => {
    // A choice made by hand replaces the suggestion.
    startSelect(q.key)?.addEventListener("change", () => { if (!applyingSuggestion) removeSuggestion(q.key); });
  });

  box.querySelector("#valid-intake-run").addEventListener("click", () => {
    let startValues = {};
    runHelper("intake", area, {
      prepare(kind) {
        const text = textarea.value.trim();
        if (wordCount(text) < 12) return { message: "Paste a few sentences of your assignment first, then try again." };
        const { text: sent, clipped } = clipText(text, TEXT_LIMITS.intake[kind]);
        const questions = intakeQuestions();
        startValues = Object.fromEntries(questions.map((q) => [q.key, startSelect(q.key)?.value]));
        return { task: intakeTask(sent, questions), label: "Reading your assignment", clipped, questions };
      },
      apply(result, job) {
        clearSuggestions();
        let suggested = 0;
        job.questions.forEach((q) => {
          const select = startSelect(q.key);
          if (!select || select.value !== startValues[q.key]) return; // changed by hand during the run
          const item = result[q.key];
          if (item.status === "found" || item.status === "inferred") {
            if (select.value !== item.value) {
              select.value = item.value;
              applyingSuggestion = true;
              try { select.dispatchEvent(new Event("change", { bubbles: true })); } finally { applyingSuggestion = false; }
            }
            addSuggestion(q.key, item.status === "found" ? `Suggested from your text: “${item.quote}”` : "Suggested from what your assignment is about. Check it.", false);
            suggested += 1;
          } else {
            addSuggestion(q.key, item.status === "unverified" ? "Not clear from your text. Pick one if you know." : "Your text doesn’t say. Pick one if you know.", true);
          }
        });
        const tail = job.clipped ? " Only the first part of your text was read." : "";
        const text = suggested
          ? `Suggested ${suggested} of ${job.questions.length} answers. The note under each question says what it's based on, so check them before you build your plan.${tail}`
          : `Your text didn’t clearly answer the five questions, so nothing was changed. Pick the answers yourself.${tail}`;
        return { text };
      }
    });
  });
}

/* ---------- 2. Draft the blanks ---------- */

const BLANKS = {
  "[Assignment title]": "title",
  "[one or two sentences]": "why",
  "[learning outcome this assesses]": "outcome",
  "[one-sentence description]": "task",
  "[what to do, how long, due when]": "stage",
  "[one sentence on why AI is limited or required here]": "aiWhy"
};
const DUE_DATE = "[due date]";
let blanksBefore = null; // the template just before the last draft, for a clean Undo

function blankTargets() {
  const found = { title: null, why: null, task: null, aiWhy: null, outcome: null, stages: [] };
  $$("#valid-tilt .valid-placeholder:not(.is-filled)").forEach((span) => {
    const kind = BLANKS[span.textContent.trim()];
    if (!kind) return;
    if (kind === "stage") {
      const name = span.closest("li")?.querySelector("strong")?.textContent.replace(/[.:]\s*$/, "").trim();
      if (name) found.stages.push({ span, name });
    } else if (!found[kind]) {
      found[kind] = span;
    }
  });
  return found;
}

function fillBlank(span, text, { dueDate = false } = {}) {
  if (!text || !span.isConnected || span.classList.contains("is-filled")) return false;
  span.dataset.ph = span.textContent.trim();
  // The "e.g." suggestion next to a blank is put back by Undo.
  const hint = span.nextElementSibling?.classList.contains("valid-hint") ? span.nextElementSibling : null;
  if (hint) {
    span.dataset.aiHint = hint.outerHTML;
    const gap = hint.previousSibling;
    if (gap?.nodeType === Node.TEXT_NODE && !gap.textContent.trim()) gap.remove();
    hint.remove();
  }
  span.textContent = text;
  span.dataset.aiText = text;
  span.classList.add("is-filled", "is-ai");
  if (dueDate) span.insertAdjacentHTML("afterend", ` <span class="valid-placeholder" data-ai-added="">${DUE_DATE}</span>`);
  return true;
}

function aiBlankSpans() {
  return $$("#valid-tilt .valid-placeholder.is-ai");
}

function undoBlanks() {
  const tilt = $("#valid-tilt");
  aiBlankSpans().forEach((span) => {
    const added = span.nextElementSibling;
    if (added?.hasAttribute("data-ai-added") && added.textContent.trim() === DUE_DATE) {
      const gap = added.previousSibling;
      if (gap?.nodeType === Node.TEXT_NODE && !gap.textContent.trim()) gap.remove();
      added.remove();
    }
    span.textContent = span.dataset.ph || "[…]";
    span.classList.remove("is-filled", "is-ai");
    const hint = span.dataset.aiHint;
    delete span.dataset.ph;
    delete span.dataset.aiText;
    delete span.dataset.aiHint;
    if (hint) span.insertAdjacentHTML("afterend", ` ${hint}`);
  });
  const reset = $("#valid-reset-tilt");
  if (blanksBefore && !blanksBefore.edited && tilt.innerHTML === blanksBefore.html && reset && !reset.disabled) {
    reset.click(); // nothing else changed: the template follows the plan again
  } else {
    tilt.dispatchEvent(new Event("input", { bubbles: true }));
  }
  blanksBefore = null;
  announce("Removed the AI drafts from the template.");
  $("#valid-ai-blanks")?.focus();
}

let blanksNoteExtra = "";

function syncBlanksNote() {
  const note = $("#valid-tilt-ai-note");
  if (!note) return;
  const count = aiBlankSpans().length;
  if (!count) {
    note.hidden = true;
    blanksNoteExtra = "";
    return;
  }
  note.querySelector(".valid-ai-note-text").textContent = blanksNoteExtra
    ? `${blanksNoteExtra} AI text is marked until you edit it, and Undo removes the AI text you haven’t edited.`
    : `${count} AI draft${count === 1 ? "" : "s"} in this template, marked until you edit ${count === 1 ? "it" : "them"}. Undo removes the ones you haven’t edited.`;
  note.hidden = false;
}

function setupBlanks() {
  const tilt = $("#valid-tilt");
  const reset = $("#valid-reset-tilt");
  if (!tilt || !reset) return;
  // The template's AI helpers get their own row under the toolbar.
  const row = document.createElement("div");
  row.className = "valid-ai-row valid-ai-only";
  row.id = "valid-tilt-ai-row";
  row.innerHTML = `
    <span class="valid-ai-row-label">${sparkle(16)}Local AI</span>
    <button class="btn valid-ai-btn" id="valid-ai-blanks" type="button">Draft the blanks</button>
    <button class="btn valid-ai-btn" id="valid-ai-review" type="button">Read it like a student</button>
    <button class="btn valid-ai-btn" id="valid-ai-variant-open" type="button" aria-expanded="false" aria-controls="valid-variant-form">Make a version…</button>
    <div class="valid-variant-form" id="valid-variant-form" hidden>
      <label class="form-label text-small" for="valid-variant-kind">Version
        <select class="form-select" id="valid-variant-kind">
          <option value="plain">Plain language</option>
          <option value="online">Online, asynchronous</option>
          <option value="accommodation">With an accommodation</option>
        </select>
      </label>
      <label class="form-label text-small" for="valid-variant-detail" id="valid-variant-detail-label" hidden>Accommodation
        <input class="form-control" id="valid-variant-detail" type="text" maxlength="200" placeholder="For example: a written explanation instead of a spoken defense">
      </label>
      <button class="btn valid-ai-btn" id="valid-ai-variant" type="button">Make it</button>
    </div>`;
  const toolbar = reset.closest(".viz-row")?.parentElement?.closest(".viz-row") ?? reset.closest(".viz-row");
  toolbar.after(row);
  const button = row.querySelector("#valid-ai-blanks");

  const note = document.createElement("div");
  note.className = "valid-ai-note";
  note.id = "valid-tilt-ai-note";
  note.hidden = true;
  note.innerHTML = `${sparkle(16)}<span class="valid-ai-note-text"></span><button class="btn" type="button">Undo AI drafts</button>`;
  note.querySelector("button").addEventListener("click", undoBlanks);
  const area = makeRunArea("valid-tilt-ai-status", "valid-ai-blanks");
  tilt.before(area, note);

  // Editing an AI draft makes it yours: the mark goes away.
  tilt.addEventListener("input", () => {
    aiBlankSpans().forEach((span) => {
      if (span.textContent === span.dataset.aiText) return;
      span.classList.remove("is-ai");
      delete span.dataset.aiText;
      delete span.dataset.aiHint;
      delete span.dataset.ph;
    });
    $$("#valid-tilt [data-ai-added]").forEach((span) => {
      if (span.textContent.trim() !== DUE_DATE) span.removeAttribute("data-ai-added");
    });
  });
  let queued = false;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; syncBlanksNote(); });
  }).observe(tilt, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class"] });

  button.addEventListener("click", () => {
    runHelper("blanks", area, {
      prepare(kind) {
        const t = blankTargets();
        const pasted = pastedText();
        const want = {
          title: Boolean(t.title), why: Boolean(t.why), task: Boolean(t.task), aiWhy: Boolean(t.aiWhy),
          outcome: Boolean(t.outcome) && Boolean(pasted),
          stages: t.stages.map((s) => s.name)
        };
        if (!want.title && !want.why && !want.task && !want.aiWhy && !want.outcome && !want.stages.length) {
          return { message: "There are no blanks left that the AI can draft." };
        }
        const { text } = clipText(pasted, TEXT_LIMITS.blanks[kind]);
        return { task: blanksTask(planContext(), want, text), label: "Drafting the blanks", want, usedText: Boolean(text) };
      },
      apply(out, job) {
        const t = blankTargets(); // the template may have changed during the run
        blanksBefore = { html: tilt.innerHTML, edited: Boolean(app.state.tiltEdited) };
        let filled = 0;
        ["title", "why", "task", "aiWhy", "outcome"].forEach((kind) => {
          if (t[kind] && fillBlank(t[kind], out[kind])) filled += 1;
        });
        const used = new Set();
        t.stages.forEach(({ span, name }) => {
          const index = job.want.stages.findIndex((stage, i) => stage === name && !used.has(i));
          if (index === -1) return;
          used.add(index);
          if (fillBlank(span, out.stages[index], { dueDate: true })) filled += 1;
        });
        if (!filled) {
          blanksBefore = null;
          return { text: "The AI didn’t return anything usable, so nothing was changed. Try again, or pick a larger model." };
        }
        tilt.dispatchEvent(new Event("input", { bubbles: true })); // the design saves the template on input
        const left = [];
        if (used.size) left.push("due dates");
        if ($$("#valid-tilt .valid-placeholder:not(.is-filled)").some((span) => BLANKS[span.textContent.trim()] === "outcome")) left.push("the course outcome");
        blanksNoteExtra = `Drafted ${filled} blank${filled === 1 ? "" : "s"} from your plan${job.usedText ? " and your assignment text" : ""}.${left.length ? ` Still yours to add: ${left.join(" and ")}.` : ""}`;
        syncBlanksNote();
        return { hide: true, announce: `${blanksNoteExtra} AI text is marked until you edit it.` };
      }
    });
  });
  syncBlanksNote();
}

/* ---------- 4. Read it like a student ---------- */

const KIND_LABELS = { unclear: "Unclear", missing: "Missing", conflict: "Contradiction", "hard to read": "Hard to read" };

function sheetText() {
  return app.tiltAsText($("#valid-tilt"));
}

// Point at the part of the template a problem is about.
function showInTemplate(quote) {
  const target = normalizeText(quote);
  const block = [...$$("#valid-tilt p, #valid-tilt li, #valid-tilt h3")].find((node) => normalizeText(node.innerText).includes(target))
    ?? [...$$("#valid-tilt p, #valid-tilt li, #valid-tilt h3")].find((node) => target.split(" ").slice(0, 4).every((w) => normalizeText(node.innerText).includes(w)));
  if (!block) return;
  block.scrollIntoView({ block: "center" });
  block.classList.remove("valid-flash");
  void block.offsetWidth;
  block.classList.add("valid-flash");
}

const normalizeText = (value) => String(value ?? "").toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").trim();

function renderReview(issues) {
  const panel = $("#valid-tilt-review");
  const blanks = [...new Set($$("#valid-tilt .valid-placeholder:not(.is-filled)").map((span) => span.textContent.trim()))];
  const items = issues.map((item, i) => `
    <li>
      <span class="valid-review-kind">${esc(KIND_LABELS[item.kind] || item.kind)}</span>
      <strong>${esc(item.question)}</strong>
      ${item.quote ? `<span class="valid-review-quote">“${esc(item.quote)}” <button class="btn btn-ghost" type="button" data-show-quote="${i}">Show</button></span>` : ""}
      <span class="valid-review-fix"><em>Fix:</em> ${esc(item.fix)}</span>
    </li>`).join("");
  panel.innerHTML = `
    <div class="valid-ai-note">${sparkle(16)}<span class="valid-ai-note-text">${issues.length
      ? `Local AI read your template as a student would and found ${issues.length} thing${issues.length === 1 ? "" : "s"} to look at. It can be wrong, so treat these as questions, not rules.`
      : "Local AI read your template as a student would and didn’t find anything a student would get stuck on. It can miss things, so read it once yourself too."}</span>
      <button class="btn" type="button" data-close-review>Close</button></div>
    ${blanks.length ? `<p class="valid-review-blanks text-small"><strong>Still blank:</strong> ${blanks.map(esc).join(" · ")}</p>` : ""}
    ${items ? `<ol class="valid-review-list">${items}</ol>` : ""}`;
  panel.hidden = false;
  panel.querySelector("[data-close-review]").addEventListener("click", () => { panel.hidden = true; $("#valid-ai-review")?.focus(); });
  panel.querySelectorAll("[data-show-quote]").forEach((b) => b.addEventListener("click", () => showInTemplate(issues[Number(b.dataset.showQuote)].quote)));
}

function setupReview() {
  const tilt = $("#valid-tilt");
  const button = $("#valid-ai-review");
  if (!tilt || !button) return;
  const panel = document.createElement("section");
  panel.className = "valid-ai-review";
  panel.id = "valid-tilt-review";
  panel.setAttribute("aria-label", "What a student might ask");
  panel.hidden = true;
  const area = makeRunArea("valid-tilt-review-status", "valid-ai-review");
  tilt.before(area, panel);
  button.addEventListener("click", () => {
    runHelper("review", area, {
      prepare(kind) {
        const { text } = clipText(sheetText(), kind === "browser" ? 6000 : 16000);
        if (text.length < 80) return { message: "The template is nearly empty, so there's nothing to read yet." };
        return { task: reviewTask(planContext(), text), label: "Reading your template as a student" };
      },
      apply(issues) {
        renderReview(issues);
        return { hide: true, announce: issues.length ? `Found ${issues.length} things a student might ask about.` : "Didn't find anything a student would get stuck on." };
      }
    });
  });
}

/* ---------- 5. Make a version ---------- */

// The template's paragraphs and list items, each with its bold label (like "Why:") set aside.
function sheetBlocks(root) {
  return [...root.querySelectorAll("p, li")].filter((node) => !node.querySelector("p, li") && node.innerText.trim()).map((node) => {
    const first = node.firstElementChild;
    const label = first && first.tagName === "STRONG" && node.innerText.trim().startsWith(first.innerText.trim()) ? first : null;
    const text = node.innerText.trim().slice(label ? label.innerText.trim().length : 0).trim();
    return { node, label, text };
  });
}

function blankify(text) {
  return esc(text).replace(/\[[^\]]+\]/g, (blank) => `<span class="valid-placeholder">${blank}</span>`);
}

let variantBefore = null;

function setupVariants() {
  const tilt = $("#valid-tilt");
  const open = $("#valid-ai-variant-open");
  const form = $("#valid-variant-form");
  if (!tilt || !open || !form) return;
  const kind = $("#valid-variant-kind");
  const detail = $("#valid-variant-detail");
  open.addEventListener("click", () => {
    form.hidden = !form.hidden;
    open.setAttribute("aria-expanded", String(!form.hidden));
    if (!form.hidden) kind.focus();
  });
  kind.addEventListener("change", () => { $("#valid-variant-detail-label").hidden = kind.value !== "accommodation"; });

  const panel = document.createElement("section");
  panel.className = "valid-ai-variant";
  panel.id = "valid-tilt-variant";
  panel.hidden = true;
  panel.innerHTML = `
    <div class="valid-ai-note">${sparkle(16)}<span class="valid-ai-note-text"></span></div>
    <div class="viz-row valid-variant-actions">
      <button class="btn" type="button" data-variant-copy><span class="valid-copy-label">Copy as text</span></button>
      <button class="btn" type="button" data-variant-use>Use as my template</button>
      <button class="btn btn-ghost" type="button" data-variant-close>Close</button>
    </div>
    <article class="valid-tilt valid-tilt-variant" aria-label="Version of the assignment"></article>`;
  const area = makeRunArea("valid-tilt-variant-status", "valid-ai-variant");
  tilt.before(area, panel);
  const article = panel.querySelector("article");
  panel.querySelector("[data-variant-close]").addEventListener("click", () => { panel.hidden = true; open.focus(); });
  panel.querySelector("[data-variant-copy]").addEventListener("click", async (event) => {
    const label = event.currentTarget.querySelector(".valid-copy-label");
    try { await navigator.clipboard.writeText(app.tiltAsText(article)); label.textContent = "Copied"; }
    catch { label.textContent = "Select the text and copy it"; }
    setTimeout(() => { label.textContent = "Copy as text"; }, 2200);
  });
  panel.querySelector("[data-variant-use]").addEventListener("click", () => {
    if (!window.confirm("Replace your template with this version? You can undo it right after.")) return;
    variantBefore = { html: tilt.innerHTML, edited: app.state.tiltEdited };
    tilt.innerHTML = article.innerHTML;
    tilt.dispatchEvent(new Event("input", { bubbles: true }));
    panel.hidden = true;
    setRunArea(area, {
      kind: "done",
      text: "Your template is now this version.",
      actions: [{ label: "Undo", onClick: () => {
        if (!variantBefore) return;
        tilt.innerHTML = variantBefore.html;
        if (variantBefore.edited) tilt.dispatchEvent(new Event("input", { bubbles: true }));
        else $("#valid-reset-tilt")?.click();
        variantBefore = null;
        hideRunArea(area);
        announce("Your template is back to how it was.");
      } }, dismiss(area)]
    });
    announce("Your template is now this version.");
  });

  $("#valid-ai-variant").addEventListener("click", () => {
    const variant = kind.value;
    runHelper("variant", area, {
      prepare() {
        if (variant === "accommodation" && detail.value.trim().length < 4) return { message: "Describe the accommodation first, for example “a written explanation instead of a spoken defense.”" };
        const blocks = sheetBlocks(tilt);
        if (!blocks.length) return { message: "The template is empty, so there's nothing to adapt yet." };
        return { task: variantTask(planContext(), blocks.map((b) => b.text), variant, detail.value), label: `Writing the ${VARIANTS[variant].label.toLowerCase()}`, variant };
      },
      apply(lines, job) {
        const copy = tilt.cloneNode(true);
        copy.removeAttribute("id");
        sheetBlocks(copy).forEach((block, i) => {
          if (lines[i] === undefined || lines[i] === block.text) return;
          const label = block.label ? block.label.outerHTML + " " : "";
          block.node.innerHTML = label + blankify(lines[i]);
        });
        copy.querySelectorAll(".is-ai").forEach((node) => { node.classList.remove("is-ai"); delete node.dataset.aiText; delete node.dataset.aiHint; delete node.dataset.ph; });
        article.innerHTML = copy.innerHTML;
        panel.querySelector(".valid-ai-note-text").textContent = `${VARIANTS[job.variant].label}, drafted by Local AI from your template. Your template hasn't changed. Check this version before you use it.`;
        panel.hidden = false;
        form.hidden = true;
        open.setAttribute("aria-expanded", "false");
        panel.querySelector("[data-variant-use]").focus();
        return { hide: true, announce: `${VARIANTS[job.variant].label} is ready below the buttons.` };
      }
    });
  });
}

/* ---------- 3. Tailor to my course ---------- */

function aiRubric() {
  const s = app.state;
  if (!s.aiRubric || typeof s.aiRubric !== "object" || Array.isArray(s.aiRubric)) s.aiRubric = {};
  return s.aiRubric;
}

// "template": still the draft wording; "ai": AI text nobody has edited; "manual": the person's own edit.
function cellKind(key, index) {
  const edit = app.state.rubricEdits?.[key]?.descriptions?.[index];
  if (edit === undefined || edit === null) return "template";
  return aiRubric()[key]?.[index] === edit ? "ai" : "manual";
}

function planSignature() {
  const s = app.state;
  return JSON.stringify([s.context, s.outcome, s.evidenceType, s.accountability, s.aiRole, app.resolvedAIAS(), s.aiAssessed,
    s.delivery, s.purposeType, app.wording("skills"), app.wording("product"), app.wording("allowed")]);
}

// AI text that has since been edited or reset is no longer tracked.
function pruneAiRubric() {
  const store = aiRubric();
  Object.keys(store).forEach((key) => {
    const texts = Array.isArray(store[key]) ? store[key] : [];
    const kept = texts.map((text, i) => (text && app.state.rubricEdits?.[key]?.descriptions?.[i] === text ? text : null));
    if (kept.some(Boolean)) store[key] = kept;
    else delete store[key];
  });
}

// AI cells in the criteria on screen (edits to criteria the plan no longer has are kept but not counted).
function aiCellCount() {
  return app.rubricCriteria().reduce((sum, c) => sum + [0, 1, 2, 3].filter((i) => cellKind(c.key, i) === "ai").length, 0);
}

function markRubric() {
  pruneAiRubric();
  $$("#valid-rubric-output .valid-edit-cell[data-rubric-key]").forEach((cell) => {
    const part = cell.dataset.rubricPart;
    if (!/^[0-3]$/.test(part)) return;
    cell.classList.toggle("is-ai", cellKind(cell.dataset.rubricKey, Number(part)) === "ai");
  });
  syncRubricNote();
}

let rubricNoteExtra = "";

function syncRubricNote() {
  const note = $("#valid-rubric-ai-note");
  if (!note) return;
  const count = aiCellCount();
  if (!count) {
    note.hidden = true;
    rubricNoteExtra = "";
    return;
  }
  const stale = app.state.aiRubricSig && app.state.aiRubricSig !== planSignature();
  let text = rubricNoteExtra
    ? `${rubricNoteExtra} AI text is marked until you edit it, and Undo removes the AI text you haven’t edited.`
    : `${count} AI-written descriptor${count === 1 ? "" : "s"} in this rubric, marked until you edit ${count === 1 ? "it" : "them"}. Undo removes the ones you haven’t edited.`;
  if (stale) text += " Your plan has changed since then, so tailor again to bring them up to date.";
  note.querySelector(".valid-ai-note-text").textContent = text;
  note.hidden = false;
}

function undoTailor() {
  const store = aiRubric();
  Object.entries(store).forEach(([key, texts]) => {
    texts.forEach((text, i) => {
      const edit = app.state.rubricEdits?.[key];
      if (!text || edit?.descriptions?.[i] !== text) return;
      delete edit.descriptions[i];
      if (!edit.descriptions.some(Boolean)) delete edit.descriptions;
      if (!Object.keys(edit).length) delete app.state.rubricEdits[key];
    });
  });
  app.state.aiRubric = {};
  rubricNoteExtra = "";
  app.refreshRubric();
  app.scheduleSave();
  announce("Removed the AI descriptors from the rubric.");
  $("#valid-ai-tailor")?.focus();
}

function addTailorButton() {
  if ($("#valid-ai-tailor")) return;
  const reset = $("#valid-reset-rubric");
  if (!reset) return;
  const button = document.createElement("button");
  button.className = "btn valid-ai-btn valid-ai-only";
  button.id = "valid-ai-tailor";
  button.type = "button";
  button.innerHTML = `${sparkle(16)}Tailor to my course`;
  button.disabled = Boolean(ai.busy);
  button.addEventListener("click", runTailor);
  reset.before(button);
}

function onRubricRendered() {
  addTailorButton();
  markRubric();
}

function runTailor() {
  const area = $("#valid-rubric-ai-status");
  let draftByKey = {};
  runHelper("tailor", area, {
    prepare(kind) {
      const criteria = app.rubricCriteria();
      draftByKey = Object.fromEntries(app.rubricCriteriaDraft().map((c) => [c.name, c]));
      const send = criteria.filter((c) => [0, 1, 2, 3].some((i) => cellKind(c.key, i) !== "manual"));
      if (!send.length) {
        return { message: "Every descriptor has your own edits, so there's nothing for the AI to rewrite. Use Reset to draft first if you want AI versions." };
      }
      const { text } = clipText(pastedText(), TEXT_LIMITS.tailor[kind]);
      const task = tailorTask(planContext(), send.map((c) => ({ name: c.name, weight: c.weight, descriptions: c.descriptions })), text);
      return { task, label: "Tailoring the rubric", send };
    },
    apply(rows, job) {
      const store = aiRubric();
      let written = 0;
      let kept = 0;
      job.send.forEach((criterion, index) => {
        const base = draftByKey[criterion.key];
        if (!base) return;
        rows[index].forEach((text, i) => {
          const now = cellKind(criterion.key, i); // checked again: edits may have happened during the run
          if (now === "manual") { kept += 1; return; }
          if (!text || text === base.descriptions[i]) return;
          const edit = app.state.rubricEdits[criterion.key] || (app.state.rubricEdits[criterion.key] = {});
          edit.descriptions = Array.isArray(edit.descriptions) ? edit.descriptions : [];
          edit.descriptions[i] = text;
          (store[criterion.key] ||= [null, null, null, null])[i] = text;
          written += 1;
        });
      });
      const untouched = app.rubricCriteria().reduce((sum, c) => sum + [0, 1, 2, 3].filter((i) => cellKind(c.key, i) === "manual").length, 0);
      kept = Math.max(kept, untouched);
      app.state.aiRubricSig = planSignature();
      rubricNoteExtra = written
        ? `Rewrote ${written} descriptor${written === 1 ? "" : "s"} for your course. Criteria and weights didn’t change${kept ? `, and the ${kept} cell${kept === 1 ? "" : "s"} you’d edited ${kept === 1 ? "was" : "were"} left alone` : ""}.`
        : "";
      app.refreshRubric();
      app.scheduleSave();
      if (!written) return { text: "The AI didn’t suggest any changes, so the rubric is unchanged." };
      return { hide: true, announce: rubricNoteExtra };
    }
  });
}

function setupTailor() {
  const output = $("#valid-rubric-output");
  if (!output) return;
  const note = document.createElement("div");
  note.className = "valid-ai-note";
  note.id = "valid-rubric-ai-note";
  note.hidden = true;
  note.innerHTML = `${sparkle(16)}<span class="valid-ai-note-text"></span><button class="btn" type="button">Undo AI descriptors</button>`;
  note.querySelector("button").addEventListener("click", undoTailor);
  output.before(makeRunArea("valid-rubric-ai-status", "valid-ai-tailor"), note);

  // Typing in an AI cell makes it yours; the saved state catches up when the cell loses focus.
  output.addEventListener("input", (event) => {
    event.target.closest?.(".valid-edit-cell")?.classList.remove("is-ai");
  });
  output.addEventListener("focusout", () => setTimeout(markRubric, 0));
  app.root.addEventListener("valid:rubric-rendered", onRubricRendered);
  onRubricRendered();
}

/* ---------- Start over ---------- */

// Start over keeps the five answers and the pasted text, and clears the plan built from them.
function onReset() {
  ai.busy?.controller?.abort();
  cancelDownloadQuestion();
  const textarea = $("#valid-assignment-text");
  if (textarea) textarea.value = pastedText();
  ["#valid-tilt-ai-status", "#valid-tilt-review-status", "#valid-tilt-variant-status", "#valid-rubric-ai-status"].forEach((id) => { const area = $(id); if (area) hideRunArea(area); });
  ["#valid-tilt-review", "#valid-tilt-variant"].forEach((id) => { const panel = $(id); if (panel) panel.hidden = true; });
  variantBefore = null;
  blanksBefore = null;
  blanksNoteExtra = "";
  rubricNoteExtra = "";
  syncBlanksNote();
  syncRubricNote();
}

/* ---------- Start ---------- */

async function init() {
  app = window.validApp;
  const announcer = document.createElement("div");
  announcer.className = "sr-only";
  announcer.id = "valid-ai-announcer";
  announcer.setAttribute("role", "status");
  announcer.setAttribute("aria-live", "polite");
  app.root.append(announcer);

  buildChip();
  buildDialog();
  setupIntake();
  setupBlanks();
  setupReview();
  setupVariants();
  setupTailor();
  app.root.addEventListener("valid:reset", onReset);
  applyAvailability();

  ai.gpu = await detectWebGPU();
  if (ai.gpu) {
    ai.browser = browserModels(ai.gpu);
    ai.recommended = recommendBrowserModel(ai.browser, ai.gpu)?.id ?? "";
  }
  ai.checked = true;
  applyAvailability();
  // Reconnect automatically only if the person connected to Ollama before.
  if (ai.prefs.useOllama) connectOllama({ automatic: true });
}

if (window.validApp) init();
else document.addEventListener("valid-app-ready", init, { once: true });

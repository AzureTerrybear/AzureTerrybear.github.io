import {
  steps, contextLabels, labels, choiceGuidance, starterApproaches,
  patterns, examples, aiasDescriptions
} from "./data.js";
import {
  detectWebGPU, listBrowserModels, recommendBrowserModel, detectOllama,
  createBrowserEngine, createOllamaEngine
} from "./llm.js";
import { rubricTask, instructionsTask, alignmentTask } from "./tasks.js";

const STORAGE_KEY = "valid-ai-designer-state-v2";
const $ = (sel) => document.querySelector(sel);

/* ---------- State ---------- */

const defaultState = {
  step: 0, started: false, resultsShown: false, starter: "recommend",
  recommendPending: false, recommendedStarter: "", touchedFields: [],
  context: "art", delivery: "classroom", purposeType: "both", purposeStatement: "", learningStatement: "", inferenceStatement: "",
  outcome: "analysis", skills: "", evidenceType: "case", product: "", accountability: "individual",
  risk: "moderate", aiCapability: "draft", undermine: "", mitigation: "",
  structure: "medium", stages: "", aiRole: "critique", aiasLevel: "auto", allowed: "", disclosure: "decisions",
  grading: "analytic", verification: "defense", support: "", exampleContext: "art",
  ai: null // { signature, rubric, instructions, alignment, model }
};

// Every field a starter approach can fill.
const STARTER_FIELDS = Object.keys(starterApproaches.independent.values);

let state = loadState();
let saveTimer;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const saved = JSON.parse(raw);
    const s = { ...structuredClone(defaultState), ...saved };
    s.step = Math.max(0, Math.min(steps.length - 1, Number(s.step) || 0));
    if (!Array.isArray(s.touchedFields)) s.touchedFields = [];
    if (!starterApproaches[s.starter]) s.starter = defaultState.starter;
    if (!contextLabels[s.context]) s.context = defaultState.context;
    if (!contextLabels[s.exampleContext]) s.exampleContext = s.context;
    if (!labels.aiasLevel[s.aiasLevel]) s.aiasLevel = defaultState.aiasLevel;
    return s;
  } catch {
    return structuredClone(defaultState);
  }
}

function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  }, 250);
}

function touch(field) {
  if (!state.touchedFields.includes(field)) state.touchedFields.push(field);
}

// Apply a starter's values without overwriting anything the instructor has edited.
function applyValues(values, keep = []) {
  const protectedFields = new Set([...state.touchedFields, ...keep]);
  for (const field of STARTER_FIELDS) {
    if (protectedFields.has(field)) continue;
    state[field] = field in values ? values[field] : defaultState[field];
  }
}

/* ---------- Helpers ---------- */

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function optionList(options, selected) {
  return Object.entries(options).map(([value, label]) =>
    `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(label)}</option>`
  ).join("");
}

function filled(value, fallback) {
  const clean = String(value ?? "").trim();
  return clean || fallback;
}

function guidanceMarkup(field, value) {
  const item = choiceGuidance[field]?.[value];
  if (!item) return "";
  return `<div class="hint" data-guidance-for="${esc(field)}">
    <strong>Why this option:</strong> ${esc(item.why)}
    <details>
      <summary>Decision guidance</summary>
      <p><strong>Choose this when:</strong> ${esc(item.choose)}</p>
      <p><strong>Keep in mind:</strong> ${esc(item.caution)}</p>
    </details>
  </div>`;
}

function textarea(field, label, placeholder) {
  return `<div class="field">
    <label for="f-${field}">${esc(label)}</label>
    <textarea id="f-${field}" data-field="${field}" placeholder="${esc(placeholder)}">${esc(state[field])}</textarea>
    <div class="example-action">
      <button class="btn ghost" type="button" data-use-example="${field}">Use a recommended example</button>
      <span>You can edit it after inserting.</span>
    </div>
  </div>`;
}

function select(field, label, options) {
  return `<div class="field">
    <label for="f-${field}">${esc(label)}</label>
    <select id="f-${field}" data-field="${field}">${optionList(options, state[field])}</select>
    ${guidanceMarkup(field, state[field])}
  </div>`;
}

/* ---------- Template examples (deterministic) ---------- */

function recommendedExample(field) {
  const skillExamples = {
    knowledge: "Explain the central concept accurately, connect it to a relevant example, distinguish it from a common misconception, and identify when it applies.",
    analysis: "Analyze evidence from multiple sources, evaluate its credibility and relevance, compare competing interpretations, identify assumptions or gaps, and draw a well-supported conclusion.",
    application: "Apply relevant concepts to a new problem, select an appropriate method, complete the task accurately, and justify the most consequential decisions.",
    creation: "Design an original response to a defined need, apply disciplinary criteria, test or revise the work, and justify major design decisions.",
    communication: "Explain complex ideas accurately for a named audience, organize the explanation effectively, and reflect on how evidence and feedback shaped the final message.",
    judgment: "Weigh evidence, stakeholder needs, risks, and ethical or professional standards to make and defend a responsible decision."
  };
  const productExamples = {
    written: "Each student will submit an evidence-based analysis that advances a clear conclusion, uses credible sources, addresses a competing interpretation, and explains the limits of the evidence.",
    case: "Each student will submit a case analysis that evaluates the available evidence, compares at least two possible courses of action, recommends one option, and explains risks, limitations, and tradeoffs.",
    solution: "Each student will submit a working solution with tests or intermediate reasoning, an explanation of the selected method, and a short analysis of limitations or alternative approaches.",
    performance: "Each student will complete the procedure or performance under defined conditions and provide a brief explanation of the most important decisions made.",
    design: "Each student will submit a completed design, selected process evidence, and a rationale connecting major choices to user needs, constraints, and disciplinary criteria.",
    dialogue: "Each student will present or defend a claim, respond to one evidence-based challenge, and submit a concise reflection identifying how the response changed or strengthened the reasoning.",
    portfolio: "Each student will submit selected artifacts showing planning, feedback, revision, and a final rationale explaining growth and consequential decisions."
  };
  const undermineExamples = {
    whole: "AI could generate most of the final submission, making it difficult to determine whether the student can perform the intended capability.",
    draft: "A plausible AI-generated draft could conceal whether the student can develop the central approach and make the key disciplinary decisions.",
    sources: "AI could supply convincing but inaccurate claims or fabricated citations that the student accepts without evaluating the underlying evidence.",
    solve: "AI could produce a correct-looking solution or code without revealing whether the student understands the method, assumptions, or errors.",
    media: "AI-generated media could obscure the student’s authorship, creative decisions, and control of disciplinary techniques.",
    edit: "Extensive AI rewriting could mask whether the student can communicate the ideas accurately and effectively.",
    uncertain: "Current AI capabilities may complete or substantially reshape the task in ways that make the student’s own learning difficult to identify."
  };
  const aiRules = {
    none: "AI may be used during designated practice activities but not during the independent assessed component. Students must disclose any AI-assisted preparation materials.",
    support: "AI may be used for brainstorming, organization, or feedback. It may not generate the final response, supply unverified claims, or fabricate sources. Students must verify consequential information and disclose how AI influenced the work.",
    collaborator: "Students may use an approved AI tool for alternatives, drafting, or analysis support. They remain responsible for verification, confidentiality, professional standards, and every final decision.",
    critique: "Students must use an approved AI response as an object of critique. AI may generate alternatives but may not write the final critique. Students must verify all claims in original sources and submit the required interaction record."
  };

  switch (field) {
    case "purposeStatement": return "Students must make evidence-based decisions they will encounter in professional practice.";
    case "learningStatement": return `The assessment measures students’ ${labels.outcome[state.outcome]}, including the ability to use disciplinary knowledge and explain consequential decisions.`;
    case "inferenceStatement":
      return state.aiRole === "none"
        ? "The completed task must support the claim that each student can demonstrate the essential capability independently under defined conditions."
        : `The completed task must support the claim that the student can demonstrate ${labels.outcome[state.outcome]} while selecting, directing, and evaluating legitimate tools responsibly.`;
    case "skills": return skillExamples[state.outcome];
    case "product": return productExamples[state.evidenceType];
    case "undermine": return undermineExamples[state.aiCapability];
    case "mitigation":
      if (state.aiRole === "none") return "Add an independent or observed component, explain why unaided evidence is needed, and provide an accessible equivalent for students who cannot attend the original setting.";
      if (state.aiRole === "critique") return "Require claim-level verification, annotations tied to disciplinary criteria, a corrected response, and a brief individual defense of one consequential revision.";
      return "Add a human-authored starting point, selected process checkpoints, source verification, an AI decision log, and a brief individual explanation of key choices.";
    case "stages": {
      const ending = state.delivery === "async" ? "recorded or written individual defense" : "brief individual defense";
      return `purpose and criteria → initial attempt or proposal → evidence check → draft or performance → feedback → revision → ${ending}`;
    }
    case "allowed": return aiRules[state.aiRole];
    case "support": {
      const scale = state.structure === "large" ? "grader calibration, benchmark responses, and targeted spot checks" : "an annotated example, checkpoints, and a calibrated rubric";
      const access = state.aiRole === "none" ? "clear independent-work conditions and accessibility accommodations" : "an approved tool or equivalent alternative, privacy guidance, and a short AI-literacy practice activity";
      return `Provide ${access}; ${scale}; clear disclosure instructions; and written or recorded alternatives for verification.`;
    }
    default: return "";
  }
}

/* ---------- Starter screen ---------- */

function renderStarter() {
  $("#starter-list").innerHTML = Object.entries(starterApproaches).map(([value, item]) => `
    <label class="starter-option">
      <input type="radio" name="starter" value="${esc(value)}"${value === state.starter ? " checked" : ""}>
      <span><strong>${esc(item.title)}</strong><small>${esc(item.summary)}</small></span>
    </label>`).join("");

  document.querySelectorAll('input[name="starter"]').forEach((input) => {
    input.addEventListener("change", (e) => {
      state.starter = e.target.value;
      renderStarterGuidance();
      scheduleSave();
    });
  });
  renderStarterGuidance();
}

function renderStarterGuidance() {
  const item = starterApproaches[state.starter];
  const kept = state.touchedFields.length
    ? `<p class="note">Fields you have already edited (${state.touchedFields.length}) will be kept.</p>` : "";
  $("#starter-guidance").innerHTML = `
    <h3>${esc(item.title)}</h3>
    <dl>
      <dt>Choose this when</dt><dd>${esc(item.choose)}</dd>
      <dt>Why it helps</dt><dd>${esc(item.why)}</dd>
      <dt>Keep in mind</dt><dd>${esc(item.caution)}</dd>
    </dl>${kept}`;
  $("#quick-start").textContent = state.starter === "recommend"
    ? "Answer two questions for a recommendation" : "Use this starting approach";
}

function showView(view) {
  $("#start").hidden = view !== "start";
  $("#workflow").hidden = view === "start";
  if (view === "start") $("#results").hidden = true;
}

/* ---------- Wizard ---------- */

function stepFields(step) {
  switch (step) {
    case 0: return `
      ${select("context", "Interest area", contextLabels)}
      ${select("delivery", "Delivery mode", labels.delivery)}
      ${select("purposeType", "Assessment purpose", labels.purposeType)}
      ${textarea("purposeStatement", "Why is this worth assessing?", "Example: Students must make evidence-based decisions they will encounter in professional practice.")}
      ${textarea("learningStatement", "What learning does it measure?", "Name the knowledge, reasoning, practice, or judgment this assessment should reveal.")}
      ${textarea("inferenceStatement", "What specific inference must this task support?", "Example: The completed task must support the claim that the student can evaluate evidence and defend a professional decision.")}`;
    case 1: return `
      ${select("outcome", "Primary student capability", labels.outcome)}
      ${textarea("skills", "What exactly should students be able to do?", "Use observable verbs. Example: Evaluate competing explanations, verify claims, and justify a recommendation with disciplinary evidence.")}`;
    case 2: return `
      ${select("evidenceType", "Primary form of evidence", labels.evidenceType)}
      ${select("accountability", "Who produces the evidence?", labels.accountability)}
      ${textarea("product", "What will students produce or perform?", "Describe the artifact, performance, decision, explanation, or process evidence that would demonstrate the skill.")}`;
    case 3: return `
      ${select("risk", "Risk that AI could substitute for the intended learning", labels.risk)}
      ${select("aiCapability", "Most likely AI capability", labels.aiCapability)}
      ${textarea("undermine", "How could AI use weaken the intended evidence?", "Example: A polished final report could conceal whether the student can evaluate evidence independently.")}
      ${textarea("mitigation", "What change would preserve the intended learning?", "Example: Add a human-first attempt, process checkpoints, source verification, or a brief individual defense.")}`;
    case 4: return `
      ${select("structure", "Course size and structure", labels.structure)}
      ${textarea("stages", "What stages and instructions will structure the work?", "Example: proposal → evidence check → draft → feedback → revision → individual rationale.")}`;
    case 5: return `
      ${select("aiRole", "Role of AI in assessed work", labels.aiRole)}
      ${select("aiasLevel", "AI Assessment Scale (AIAS 2.1)", labels.aiasLevel)}
      ${textarea("allowed", "What AI uses are permitted or required?", "State concrete examples of allowed, required, and prohibited uses.")}
      ${select("disclosure", "What AI-use evidence must students submit?", labels.disclosure)}`;
    default: return `
      ${select("grading", "Primary grading method", labels.grading)}
      ${select("verification", "Individual verification method", labels.verification)}
      ${textarea("support", "What implementation support is needed?", "Consider tool access, privacy, accessibility, AI literacy, examples, checkpoints, grader calibration, and alternatives.")}`;
  }
}

function renderStep() {
  const step = steps[state.step];
  const fraction = (state.step + 1) / steps.length;

  $("#progress-label").textContent = `Step ${state.step + 1} of ${steps.length} · ${step.name}`;
  $("#progress-percent").textContent = `${Math.round(fraction * 100)}% complete`;
  $("#progress-bar").style.width = `${fraction * 100}%`;
  $("#progress").setAttribute("aria-valuenow", String(state.step + 1));
  $("#step-list").innerHTML = steps.map((item, i) =>
    `<li><button type="button" class="step-link${i === state.step ? " current" : ""}" data-goto="${i}"${i === state.step ? ' aria-current="step"' : ""}>${i + 1} ${item.name}</button></li>`
  ).join("");

  const recommendNote = state.starter === "recommend" && state.recommendedStarter && state.step >= 2
    ? `<p class="note"><strong>Recommended starting approach:</strong> ${esc(starterApproaches[state.recommendedStarter].title)}. The remaining choices are prefilled and fully editable.</p>` : "";

  $("#panel").innerHTML = `
    <div class="panel-header">
      <span class="badge">${step.letter} · ${step.tag}</span>
      <h2>${step.name}</h2>
      <p class="question">${step.question}</p>
      <p class="muted small">${step.deliverable}</p>
      ${recommendNote}
    </div>
    <div class="fields">${stepFields(state.step)}</div>`;

  $("#back").disabled = state.step === 0;
  $("#next").textContent = state.step === steps.length - 1 ? "Build my assessment plan" : `Next: ${steps[state.step + 1].name}`;
}

function goToStep(index) {
  if (state.step === 1 && index > 1 && state.recommendPending) applyRecommendedApproach();
  state.step = index;
  renderStep();
  $("#panel").scrollIntoView({ block: "nearest" });
  scheduleSave();
}

function applyRecommendedApproach() {
  const match = {
    knowledge: "independent", analysis: "critique", application: "professional",
    creation: "support", communication: "support", judgment: "professional"
  }[state.outcome] || "critique";
  applyValues(starterApproaches[match].values, ["outcome"]);
  state.recommendPending = false;
  state.recommendedStarter = match;
}

// Panel events are delegated once, so re-rendering never loses listeners or focus.
function bindPanel() {
  const panel = $("#panel");
  const onChange = (e) => {
    const field = e.target.dataset?.field;
    if (!field) return;
    const previousContext = state.context;
    state[field] = e.target.value;
    touch(field);
    if (field === "context" && state.exampleContext === previousContext) state.exampleContext = state.context;
    if (e.target.tagName === "SELECT") {
      const hint = e.target.closest(".field")?.querySelector("[data-guidance-for]");
      if (hint) hint.outerHTML = guidanceMarkup(field, state[field]);
    }
    markResultsStale();
    scheduleSave();
  };
  panel.addEventListener("input", (e) => { if (e.target.tagName === "TEXTAREA") onChange(e); });
  panel.addEventListener("change", (e) => { if (e.target.tagName === "SELECT") onChange(e); });
  panel.addEventListener("click", (e) => {
    const button = e.target.closest("[data-use-example]");
    if (!button) return;
    const field = button.dataset.useExample;
    const text = recommendedExample(field);
    const target = panel.querySelector(`[data-field="${field}"]`);
    if (!target || !text) return;
    if (target.value.trim() && !confirm("Replace what you have written with the recommended example?")) return;
    state[field] = text;
    target.value = text;
    touch(field);
    button.textContent = "Example inserted";
    markResultsStale();
    scheduleSave();
  });
}

/* ---------- Plan logic (deterministic) ---------- */

function resolvedAIAS() {
  if (state.aiasLevel !== "auto") return state.aiasLevel;
  if (state.aiRole === "none") return "one";
  if (state.aiRole === "critique") return "three"; // evaluating & modifying AI output is AIAS 3 territory
  if (state.aiRole === "collaborator") return state.outcome === "creation" ? "five" : "four";
  return "three";
}

function aiasAlignmentNote(level) {
  if (level === "one" && state.aiRole !== "none") return "Check alignment: AIAS 1 excludes AI from the assessed task, but the selected AI role permits or requires it.";
  if (level !== "one" && state.aiRole === "none") return "Check alignment: the selected AIAS level expects an AI role, but the assessment currently excludes AI.";
  if (level === "two" && ["critique", "collaborator"].includes(state.aiRole)) return "Check alignment: AIAS 2 limits AI to planning, but the selected AI role uses AI beyond planning.";
  if (["four", "five"].includes(level) && state.aiRole === "support") return "Check alignment: this level expects substantial AI involvement, but the selected role permits only limited support.";
  return state.aiasLevel === "auto" ? "Recommended from the selected AI role and learning outcome." : "Selected by the designer; confirm that the task instructions and rubric enforce this choice.";
}

function scorePattern(p) {
  let score = 0;
  if (p.outcomes.includes(state.outcome)) score += 4;
  if (p.evidenceTypes.includes(state.evidenceType)) score += 3;
  if (p.aiRoles.includes(state.aiRole)) score += 3;
  if (p.integrity && ["high", "uncertain"].includes(state.risk)) score += 2;
  if (state.accountability === "both" && p.name.includes("Team product")) score += 3;
  if (state.delivery === "async" && ["Process portfolio with checkpoints", "Human-first comparison and reflection", "Multimodal explanation"].includes(p.name)) score += 1;
  if (state.structure === "large" && ["Attempt–feedback–retry task", "Bounded application task", "Verified AI-output critique"].includes(p.name)) score += 1;
  if (state.aiRole === "none" && p.name === "Bounded application task") score += 2;
  return score;
}

function safeguards() {
  const items = [`Align every rubric criterion with ${labels.outcome[state.outcome]}; remove criteria that reward surface polish without evidence of the intended learning.`];
  items.push({
    knowledge: "Sample enough knowledge to support the intended inference and include explanation or application so recall is not the only evidence.",
    analysis: "Use evidence of comparable complexity and score the quality of criteria, verification, reasoning, and conclusions.",
    application: "Use a sufficiently novel problem and collect enough reasoning or explanation to show transfer rather than reproduction.",
    creation: "Assess the rationale, constraints, process, and revisions as well as the polish of the final product.",
    communication: "Define the audience and purpose clearly, and do not let production quality outweigh disciplinary meaning.",
    judgment: "Use realistic ambiguity and tradeoffs, and pair shared decisions with concise evidence of individual accountability."
  }[state.outcome]);
  if (["high", "uncertain"].includes(state.risk)) items.push("Add at least one independent source of evidence: a human-first attempt, process checkpoint, observed performance, or brief individual defense.");
  items.push({
    none: "Explain why independent performance is necessary and create practical conditions for it; do not treat AI-detector output as proof.",
    support: "Give concrete examples of permitted and prohibited uses, require a specific disclosure, and verify consequential claims and sources.",
    collaborator: "Provide an accessible institutional tool or equivalent alternative, retain relevant interactions, and grade the student’s decisions rather than the AI product.",
    critique: "Use a fixed instructor-provided AI output when possible so students critique equivalent material and graders can anticipate defensible corrections."
  }[state.aiRole]);
  if (state.delivery === "async") items.push("Use staged deadlines and persistent process evidence; offer recorded or written verification rather than requiring a live defense.");
  if (state.structure === "large") items.push("Use an analytic rubric, exemplars, targeted spot checks, and grader calibration; double-score a sample to check agreement.");
  else if (state.structure === "team" || state.accountability !== "individual") items.push("Pair every shared product with an individual memo, defense, or contribution record.");
  else items.push("Pilot the task with a small sample, annotate benchmark responses, and calibrate scoring before high-stakes use.");
  return items;
}

// Five distinct criteria (the original overlapped three reasoning criteria at 80%).
function rubricCriteria() {
  const capability = labels.outcome[state.outcome];
  const evidence = labels.evidenceType[state.evidenceType];
  const level = resolvedAIAS();
  const independent = level === "one" || state.aiRole === "none";

  return [
    { name: "Primary disciplinary capability", weight: 35, descriptions: [
      `Demonstrates ${capability} with accuracy, depth, and insight; transfers it to complexity or ambiguity.`,
      `Demonstrates ${capability} accurately in the assigned context using appropriate disciplinary knowledge.`,
      `Demonstrates parts of ${capability}, but accuracy, depth, or transfer is inconsistent.`,
      `Provides insufficient evidence of ${capability} or relies on unsupported conclusions and procedures.`] },
    { name: "Use of evidence", weight: 25, descriptions: [
      "Selects highly relevant, credible evidence, evaluates its quality and limitations, and weighs alternatives.",
      "Uses relevant, credible evidence and addresses important limitations.",
      "Uses some evidence, but quality, verification, or consideration of alternatives is uneven.",
      "Uses weak, inaccurate, unverified, or insufficient evidence."] },
    { name: "Decision rationale and process", weight: 15, descriptions: [
      "Explains consequential decisions and revisions precisely, showing how feedback and evidence changed the work.",
      "Explains key decisions and revisions and links them to evidence or feedback.",
      "Explains some decisions, but the rationale or record of revision is thin.",
      "Does not explain decisions or show how the work developed."] },
    { name: `Quality of ${evidence}`, weight: 15, descriptions: [
      `The ${evidence} is complete, purposeful, and unusually effective for its audience.`,
      `The ${evidence} is complete, clear, and fit for purpose.`,
      `The ${evidence} is incomplete or difficult to interpret in places.`,
      `The ${evidence} is missing, unusable, or off-task.`] },
    independent
      ? { name: "Independent demonstration", weight: 10, descriptions: [
          "Demonstrates the capability fully independently and explains decisions flexibly, confirming ownership.",
          "Demonstrates the capability independently and accurately explains the key reasoning.",
          "Independent performance or explanation only partly confirms ownership and understanding.",
          "Cannot independently reproduce, explain, or defend the consequential parts of the work."] }
      : { name: "Responsible AI use and accountability", weight: 10, descriptions: [
          `Works consistently within ${labels.aiasLevel[level]}, verifies consequential output, documents use transparently, and owns the result.`,
          `Works within ${labels.aiasLevel[level]}, verifies important output, and provides the required disclosure.`,
          "Disclosure, verification, or accountability is incomplete or inconsistent with the AI-use rules.",
          "AI use conflicts with the rules, relies on unverified output, or omits required disclosure."] }
  ];
}

/* ---------- Results ---------- */

// Signature of every input that the AI layer reads; personalised output is discarded if it changes.
function planSignature() {
  const keys = ["context", "delivery", "purposeType", "purposeStatement", "learningStatement", "inferenceStatement", "outcome", "skills",
    "evidenceType", "product", "accountability", "risk", "aiCapability", "undermine", "mitigation", "structure", "stages",
    "aiRole", "aiasLevel", "allowed", "disclosure", "grading", "verification", "support"];
  return JSON.stringify(keys.map((k) => state[k]));
}

function markResultsStale() {
  if (!state.resultsShown) return;
  $("#stale-banner").hidden = false;
}

function renderResults() {
  const level = resolvedAIAS();
  if (state.ai && state.ai.signature !== planSignature()) state.ai = null;

  const planItems = [
    ["Verify", `${contextLabels[state.context]} · ${labels.delivery[state.delivery]} · ${labels.purposeType[state.purposeType]}. ${filled(state.purposeStatement, "Purpose not yet specified.")} ${filled(state.learningStatement, "")} Intended inference: ${filled(state.inferenceStatement, "not yet specified")}`],
    ["Articulate", `${labels.outcome[state.outcome]}. ${filled(state.skills, "Exact observable skill not yet specified.")}`],
    ["Locate", `${labels.evidenceType[state.evidenceType]} produced as ${labels.accountability[state.accountability]}. ${filled(state.product, "Student evidence not yet described.")}`],
    ["Inspect", `${labels.risk[state.risk]}. ${filled(state.undermine, "How AI could weaken the evidence has not yet been described.")} ${filled(state.mitigation, "")}`],
    ["Design", `${labels.structure[state.structure]}. ${filled(state.stages, "Assignment stages not yet specified.")}`],
    ["Assign", `${labels.aiRole[state.aiRole]} · ${labels.aiasLevel[level]}; submit ${labels.disclosure[state.disclosure]}. ${filled(state.allowed, "Detailed AI-use rules not yet specified.")}`],
    ["Implement", `${labels.grading[state.grading]} with ${labels.verification[state.verification]}. ${filled(state.support, "Implementation support not yet specified.")}`]
  ];
  $("#plan-summary").innerHTML = planItems.map(([n, t]) => `<li><strong>${esc(n)}</strong><span>${esc(t)}</span></li>`).join("");

  $("#aias-summary").innerHTML = `
    <span class="badge">How AI participates</span>
    <h3>${esc(labels.aiasLevel[level])}</h3>
    <p>${esc(aiasDescriptions[level])}</p>
    <p class="small"><strong>${esc(aiasAlignmentNote(level))}</strong></p>`;

  const ranked = patterns.map((p) => ({ p, s: scorePattern(p) })).sort((a, b) => b.s - a.s).slice(0, 3);
  $("#approaches").innerHTML = ranked.map(({ p }, i) => `
    <article class="recommendation">
      <div>${i === 0 ? '<span class="badge">Strongest fit</span>' : `<span class="muted small">Alternative ${i + 1}</span>`}<h3>${esc(p.name)}</h3></div>
      <dl>
        <dt>Approach</dt><dd>${esc(p.description)}</dd>
        <dt>Evidence</dt><dd>${esc(p.evidence)}</dd>
        <dt>Watch for</dt><dd>${esc(p.caution)}</dd>
      </dl>
    </article>`).join("");

  $("#safeguards").innerHTML = safeguards().map((s) => `<li>${esc(s)}</li>`).join("");

  renderRubric();
  renderAIOutputs();

  const exampleSelect = $("#example-area");
  exampleSelect.innerHTML = optionList(contextLabels, state.exampleContext || state.context);
  renderExample();

  $("#stale-banner").hidden = true;
  $("#results").hidden = false;
}

function renderRubric() {
  const criteria = rubricCriteria();
  const level = resolvedAIAS();
  const personalised = state.ai?.rubric && state.ai.rubric.length === criteria.length;
  const descr = (i) => (personalised ? state.ai.rubric[i] : criteria[i].descriptions);
  const levels = ["Exemplary · 4", "Proficient · 3", "Developing · 2", "Beginning · 1"];
  const methodNames = { analytic: "analytic rubric", holistic: "holistic rubric", checklist: "criterion checklist", contract: "specifications guide" };

  $("#rubric-intro").textContent = `This ${methodNames[state.grading]} is aligned to ${labels.outcome[state.outcome]}, ${labels.evidenceType[state.evidenceType]}, and ${labels.aiasLevel[level]}.`;
  $("#rubric-badge").hidden = !personalised;
  $("#rubric-revert").hidden = !personalised;

  let head, rows;
  if (state.grading === "analytic") {
    head = `<tr><th scope="col">Criterion</th>${levels.map((l) => `<th scope="col">${esc(l)}</th>`).join("")}</tr>`;
    rows = criteria.map((c, i) => `<tr><th scope="row">${esc(c.name)}<br><span class="muted small">${c.weight}%</span></th>${descr(i).map((d) => `<td>${esc(d)}</td>`).join("")}</tr>`).join("");
  } else if (state.grading === "holistic") {
    head = '<tr><th scope="col">Overall level</th><th scope="col">Integrated performance description</th></tr>';
    rows = levels.map((l, li) => `<tr><th scope="row">${esc(l)}</th><td>${criteria.map((c, i) => `<strong>${esc(c.name)}:</strong> ${esc(descr(i)[li])}`).join("<br><br>")}</td></tr>`).join("");
  } else if (state.grading === "checklist") {
    head = '<tr><th scope="col">Criterion</th><th scope="col">Meets expectations when</th><th scope="col">Revise when</th></tr>';
    rows = criteria.map((c, i) => `<tr><th scope="row">${esc(c.name)} <span class="muted small">(${c.weight}%)</span></th><td>${esc(descr(i)[1])}</td><td>${esc(descr(i)[2])}</td></tr>`).join("");
  } else {
    head = '<tr><th scope="col">Required specification</th><th scope="col">Satisfactory evidence</th></tr>';
    rows = criteria.map((c, i) => `<tr><th scope="row">${esc(c.name)} <span class="muted small">(${c.weight}%)</span></th><td>${esc(descr(i)[1])}</td></tr>`).join("");
  }
  $("#rubric-output").innerHTML = `<div class="table-wrap"><table class="rubric"><thead>${head}</thead><tbody>${rows}</tbody></table></div>`;
}

function renderExample() {
  const selected = $("#example-area").value || state.exampleContext;
  state.exampleContext = selected;
  const ex = examples[selected];
  $("#example").innerHTML = `
    <h3>${esc(ex.title)}</h3>
    <dl>
      <dt>Published implementation</dt><dd>${esc(ex.implementation)}</dd>
      <dt>Assignment adaptation</dt><dd>${esc(ex.assignment)}</dd>
      <dt>What the study found</dt><dd>${esc(ex.finding)}</dd>
      <dt>Evidence status</dt><dd>${esc(ex.evidence)}</dd>
      <dt>Source</dt><dd><a href="${esc(ex.url)}" target="_blank" rel="noopener noreferrer">Read the published source</a></dd>
    </dl>`;
  scheduleSave();
}

/* ---------- Local AI ---------- */

const ai = { engine: null, engineKey: "", gpu: null, browserModels: [], ollamaModels: [], busy: false };

function aiContext() {
  const level = resolvedAIAS();
  return {
    discipline: contextLabels[state.context],
    delivery: labels.delivery[state.delivery],
    purposeType: labels.purposeType[state.purposeType],
    whyAssess: state.purposeStatement, learningMeasured: state.learningStatement, intendedInference: state.inferenceStatement,
    primaryCapability: labels.outcome[state.outcome], observableSkills: state.skills,
    evidenceType: labels.evidenceType[state.evidenceType], whoProduces: labels.accountability[state.accountability], studentProduct: state.product,
    aiRisk: labels.risk[state.risk], likelyAICapability: labels.aiCapability[state.aiCapability], howAICouldUndermine: state.undermine, mitigation: state.mitigation,
    courseStructure: labels.structure[state.structure], stages: state.stages,
    aiRole: labels.aiRole[state.aiRole], aiasLevel: labels.aiasLevel[level], aiasMeaning: aiasDescriptions[level],
    aiUseRules: state.allowed, aiDisclosureRequired: labels.disclosure[state.disclosure],
    gradingMethod: labels.grading[state.grading], verification: labels.verification[state.verification], support: state.support
  };
}

async function initAIPanel() {
  const status = $("#ai-status");
  const picker = $("#ai-model");
  status.textContent = "Checking what can run on this device…";

  const [gpu, ollamaModels] = await Promise.all([detectWebGPU(), detectOllama()]);
  ai.gpu = gpu;
  ai.ollamaModels = ollamaModels;
  if (gpu) {
    try { ai.browserModels = await listBrowserModels(gpu); } catch { ai.browserModels = []; }
  }

  const options = [];
  if (ollamaModels.length) {
    options.push(`<optgroup label="Ollama on this computer">${ollamaModels.map((m) => `<option value="ollama:${esc(m)}">${esc(m)}</option>`).join("")}</optgroup>`);
  }
  const recommended = gpu ? recommendBrowserModel(ai.browserModels, gpu) : null;
  if (ai.browserModels.length) {
    options.push(`<optgroup label="In your browser (one-time download)">${ai.browserModels.map((m) =>
      `<option value="browser:${esc(m.id)}"${!ollamaModels.length && m.id === recommended?.id ? " selected" : ""}>${esc(m.id.replace(/-q4f(16|32)_1-MLC$/, ""))}${m.vramMB ? ` · ~${(m.vramMB / 1024).toFixed(1)} GB` : ""}${m.id === recommended?.id ? " (recommended)" : ""}</option>`
    ).join("")}</optgroup>`);
  }

  if (!options.length) {
    picker.hidden = true;
    $("#ai-run").disabled = true;
    status.innerHTML = "Local AI isn’t available on this device: the browser has no WebGPU support and no Ollama server was found. The template-based plan above still works. Try Chrome or Edge on a recent computer, or see the README to connect Ollama.";
    return;
  }
  picker.innerHTML = options.join("");
  picker.hidden = false;
  $("#ai-run").disabled = false;
  status.textContent = ollamaModels.length
    ? "Ollama found. Nothing leaves this computer."
    : "Runs entirely in your browser. The model downloads once, then is cached. Nothing leaves this computer.";
}

async function getEngine(key) {
  if (ai.engine && ai.engineKey === key) return ai.engine;
  if (ai.engine) await ai.engine.dispose();
  ai.engine = null;
  const [kind, ...rest] = key.split(":");
  const id = rest.join(":");
  if (kind === "ollama") {
    ai.engine = createOllamaEngine(id);
  } else {
    setProgress(0, "Loading model…");
    ai.engine = await createBrowserEngine(id, (p, text) => setProgress(p, text));
  }
  ai.engineKey = key;
  return ai.engine;
}

function setProgress(fraction, text) {
  $("#ai-progress").hidden = false;
  $("#ai-progress-bar").style.width = `${Math.round(fraction * 100)}%`;
  $("#ai-progress-text").textContent = text;
}

async function runPersonalisation() {
  if (ai.busy) return;
  ai.busy = true;
  const runButton = $("#ai-run");
  runButton.disabled = true;
  $("#ai-error").hidden = true;

  const ctx = aiContext();
  const criteria = rubricCriteria();
  const jobs = [
    ["rubric", "Personalizing rubric descriptors", rubricTask(ctx, criteria)],
    ["instructions", "Writing student AI-use instructions", instructionsTask(ctx)],
    ["alignment", "Checking design alignment", alignmentTask(ctx)]
  ];
  const result = { signature: planSignature(), model: "" };
  const failures = [];

  try {
    const engine = await getEngine($("#ai-model").value);
    result.model = engine.label;
    for (const [i, [key, label, task]] of jobs.entries()) {
      setProgress(i / jobs.length, `${label} (${i + 1} of ${jobs.length})…`);
      try {
        const raw = await engine.generate(task.messages, task.schema, (n) =>
          setProgress((i + Math.min(n / 1800, 0.95)) / jobs.length, `${label} (${i + 1} of ${jobs.length})… ${n} characters`));
        result[key] = task.validate(raw);
      } catch (err) {
        failures.push(`${label}: ${err.message}`);
      }
    }
    setProgress(1, failures.length ? "Finished with some problems." : `Done · ${result.model}`);
  } catch (err) {
    failures.push(`Could not start the model: ${err.message}`);
    $("#ai-progress").hidden = true;
  }

  if (result.rubric || result.instructions || result.alignment) {
    state.ai = result;
    renderRubric();
    renderAIOutputs();
    scheduleSave();
  }
  if (failures.length) {
    $("#ai-error").hidden = false;
    $("#ai-error").innerHTML = `<strong>Some sections could not be generated.</strong> The template versions are still shown.<ul>${failures.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>`;
  }
  ai.busy = false;
  runButton.disabled = false;
  runButton.textContent = "Personalize again";
}

function renderAIOutputs() {
  const box = $("#ai-outputs");
  const r = state.ai;
  if (!r || (!r.instructions && !r.alignment)) { box.innerHTML = ""; return; }

  let html = `<p class="muted small">Generated locally by ${esc(r.model)}. Review and edit before sharing with students.</p>`;
  if (r.instructions) {
    const i = r.instructions;
    const list = (items) => items.length ? `<ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "<p class='muted'>None.</p>";
    html += `<section class="card ai-card">
      <div class="row between"><h3>Student AI-use instructions</h3><button class="btn ghost" type="button" id="copy-instructions">Copy</button></div>
      <p>${esc(i.overview)}</p>
      <h4>You may use AI to</h4>${list(i.permitted)}
      <h4>You may not use AI to</h4>${list(i.prohibited)}
      <h4>What to submit about your AI use</h4><p>${esc(i.documentation)}</p>
      <h4>Why these rules</h4><p>${esc(i.why)}</p>
    </section>`;
  }
  if (r.alignment) {
    html += `<section class="card ai-card"><h3>Alignment check</h3>${
      r.alignment.length
        ? `<ul class="issues">${r.alignment.map((x) => `<li class="sev-${esc(x.severity)}"><span class="sev">${esc(x.severity)}</span> <strong>${esc(x.issue)}</strong>${x.fields.length ? ` <span class="muted small">(${esc(x.fields.join(", "))})</span>` : ""}<br>${esc(x.suggestion)}</li>`).join("")}</ul>`
        : "<p>No inconsistencies found between your answers.</p>"
    }<p class="muted small">A small model can miss problems or flag non-issues. Treat this as a second reader, not a verdict.</p></section>`;
  }
  box.innerHTML = html;

  $("#copy-instructions")?.addEventListener("click", (e) => {
    const i = r.instructions;
    const text = [i.overview, "", "You may use AI to:", ...i.permitted.map((x) => `- ${x}`), "",
      "You may not use AI to:", ...i.prohibited.map((x) => `- ${x}`), "",
      "What to submit about your AI use:", i.documentation, "", "Why these rules:", i.why].join("\n");
    navigator.clipboard?.writeText(text).then(() => { e.target.textContent = "Copied"; });
  });
}

/* ---------- Wiring ---------- */

function init() {
  bindPanel();

  $("#quick-start").addEventListener("click", () => {
    applyValues(starterApproaches[state.starter].values);
    state.recommendPending = state.starter === "recommend";
    state.recommendedStarter = "";
    state.step = 0;
    state.started = true;
    showView("workflow");
    renderStep();
    scheduleSave();
  });

  $("#guided-start").addEventListener("click", () => {
    state.recommendPending = false;
    state.recommendedStarter = "";
    state.step = 0;
    state.started = true;
    showView("workflow");
    renderStep();
    scheduleSave();
  });

  $("#change-start").addEventListener("click", () => {
    state.started = false;
    showView("start");
    renderStarter();
    scheduleSave();
  });

  $("#reset").addEventListener("click", () => {
    if (!confirm("Clear every answer and start over?")) return;
    state = structuredClone(defaultState);
    $("#results").hidden = true;
    showView("start");
    renderStarter();
    scheduleSave();
  });

  $("#step-list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-goto]");
    if (b) goToStep(Number(b.dataset.goto));
  });
  $("#back").addEventListener("click", () => { if (state.step > 0) goToStep(state.step - 1); });
  $("#next").addEventListener("click", () => {
    if (state.step < steps.length - 1) return goToStep(state.step + 1);
    state.resultsShown = true;
    renderResults();
    $("#results-heading").scrollIntoView({ behavior: "smooth", block: "start" });
    scheduleSave();
  });
  $("#rebuild").addEventListener("click", () => renderResults());

  $("#example-area").addEventListener("change", renderExample);
  $("#rubric-revert").addEventListener("click", () => {
    if (state.ai) state.ai.rubric = null;
    renderRubric();
    scheduleSave();
  });
  $("#ai-run").addEventListener("click", runPersonalisation);
  $("#print").addEventListener("click", () => window.print());

  if (state.started) {
    showView("workflow");
    renderStep();
    if (state.resultsShown) renderResults();
  } else {
    showView("start");
    renderStarter();
  }
  initAIPanel();
}

init();

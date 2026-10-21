// Prompts, JSON schemas, and checks for the three local AI helpers.
// Each task returns { messages, schema, maxTokens, expected, validate(output) }.
// The model only drafts wording. The plan logic, the rubric's criteria and weights,
// the AIAS level, and the research stay deterministic.

const SYSTEM = [
  "You are an instructional design assistant helping a university instructor build an assessment.",
  "Use ONLY the information the instructor provided. Do not invent facts, statistics, citations, tools, due dates, or institutional policies.",
  "Write in clear, concrete, plain English.",
  "Respond with a single JSON object that matches the requested structure, and nothing else. /no_think"
].join(" ");

// How much pasted assignment text each task sends, in characters. In-browser
// models have a 4,096-token window shared by the prompt and the answer.
export const TEXT_LIMITS = {
  intake: { browser: 6000, ollama: 16000 },
  blanks: { browser: 2000, ollama: 8000 },
  tailor: { browser: 1500, ollama: 6000 }
};

export const NOT_STATED = "Not stated";

/* ---------- Text helpers ---------- */

export function oneLine(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function clip(value, limit) {
  const text = oneLine(value);
  return text.length > limit ? `${text.slice(0, limit - 1).trimEnd()}…` : text;
}

// Pasted text keeps its line breaks, which carry structure, and is cut at the limit.
export function clipText(value, limit) {
  const text = String(value ?? "").replace(/\r\n?/g, "\n").replace(/<<<|>>>/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text.length > limit ? { text: text.slice(0, limit), clipped: true } : { text, clipped: false };
}

export function wordCount(value) {
  return oneLine(value).split(" ").filter(Boolean).length;
}

// Loose comparison for quotes: case, curly quotes, dashes, and spacing don't matter.
export function normalize(value) {
  return String(value ?? "").toLowerCase()
    .replace(/[‘’‚′`]/g, "'").replace(/[“”„″]/g, '"')
    .replace(/[‐-―−]/g, "-").replace(/…/g, "...")
    .replace(/\s+/g, " ").trim();
}

const EDGE_PUNCTUATION = /^[\s"'.,;:!?()[\]-]+|[\s"'.,;:!?()[\]-]+$/g;

// True when every part of the quote (split at "...") appears in the source text.
export function quoteFound(quote, source) {
  const haystack = normalize(source);
  const parts = normalize(quote).split("...").map((part) => part.replace(EDGE_PUNCTUATION, "")).filter(Boolean);
  if (!parts.length || parts.join(" ").length < 3) return false;
  return parts.every((part) => haystack.includes(part));
}

// One drafted sentence: no wrapping quotes, no "Title:" style labels, a sensible length.
function sentence(value, limit) {
  const text = oneLine(value)
    .replace(/^["'“”‘’]+|["'“”‘’]+$/g, "")
    .replace(/^(title|why|task|stage \d+|ai ?why|why these rules|outcome)\s*:\s*/i, "")
    .trim();
  return clip(text, limit);
}

const assignmentBlock = (text) => (text
  ? `\nThe instructor's current assignment text:\n<<<\n${text}\n>>>\n`
  : "");

function planLines(ctx, keys) {
  const labels = {
    subject: "Subject area",
    delivery: "Course delivery",
    purpose: "Purpose",
    capability: "Students mainly show",
    skills: "What students should be able to do",
    evidence: "Kind of evidence",
    product: "What students produce",
    accountability: "Who produces it",
    approach: "Assessment approach",
    aiRole: "Role of AI",
    aiasLevel: "AI Assessment Scale level",
    aiRules: "AI rules",
    undermine: "How AI could weaken the evidence",
    verification: "How each student's own work is checked"
  };
  return keys
    .filter((key) => oneLine(ctx[key]))
    .map((key) => `- ${labels[key]}: ${clip(ctx[key], 450)}`)
    .join("\n");
}

/* ---------- 1. Start from your assignment ---------- */

// questions: [{ key, name, ask, options: [{ value, label, hint }] }]
export function intakeTask(text, questions) {
  const properties = {};
  questions.forEach((q) => {
    properties[q.name] = {
      type: "object",
      properties: {
        quote: { type: "string" },
        answer: { type: "string", enum: [...q.options.map((o) => o.label), NOT_STATED] }
      },
      required: ["quote", "answer"]
    };
  });
  const schema = { type: "object", properties, required: questions.map((q) => q.name) };

  const listing = questions.map((q) => [
    `${q.name}: ${q.ask}`,
    ...q.options.map((o) => `  "${o.label}"${o.hint ? ` — ${o.hint}` : ""}`),
    `  "${NOT_STATED}"`
  ].join("\n")).join("\n\n");

  const user = `Here is an assignment an instructor gives students now:
<<<
${text}
>>>

Answer ${questions.length} questions about this assignment, using only what the text says.
For each question, first give "quote": a short phrase of 3 to 15 words copied exactly from the text that shows the answer. Then give "answer": one of the options listed for that question, written exactly as it appears inside the quotation marks.
If the text does not make the answer clear, give "" as the quote and "${NOT_STATED}" as the answer. Don't guess.

${listing}`;

  return {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    schema,
    maxTokens: 500,
    expected: 520,
    validate(out) {
      const result = {};
      questions.forEach((q) => {
        const item = out?.[q.name] ?? {};
        const answer = oneLine(item.answer).toLowerCase();
        const option = q.options.find((o) => o.label.toLowerCase() === answer);
        const quote = oneLine(item.quote).replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
        if (!option) result[q.key] = { status: "unstated" };
        else if (!quoteFound(quote, text)) result[q.key] = { status: "unverified", value: option.value };
        else result[q.key] = { status: "found", value: option.value, quote: clip(quote, 140) };
      });
      return result;
    }
  };
}

/* ---------- 2. Draft the blanks ---------- */

// want: { title, why, task, aiWhy, outcome: booleans; stages: [stage names] }
export function blanksTask(ctx, want, pasted) {
  const properties = {};
  const asks = [];
  if (want.title) {
    properties.title = { type: "string" };
    asks.push('"title": a short, specific title for the assignment, at most 10 words.');
  }
  if (want.why) {
    properties.why = { type: "string" };
    asks.push('"why": one or two sentences on why this assignment matters for the student\'s learning or future work.');
  }
  if (want.task) {
    properties.task = { type: "string" };
    asks.push('"task": one sentence that describes the whole task.');
  }
  if (want.stages.length) {
    properties.stages = { type: "array", items: { type: "string" }, minItems: want.stages.length, maxItems: want.stages.length };
    asks.push(`"stages": one entry for each stage below, in the same order. Each entry is one or two sentences on what students do in that stage, with a rough time estimate if you can give one. Do not give due dates.\n${want.stages.map((name, i) => `  ${i + 1}. ${name}`).join("\n")}`);
  }
  if (want.aiWhy) {
    properties.aiWhy = { type: "string" };
    asks.push('"aiWhy": one sentence that tells students why AI use is limited or required this way in this assignment, based on the AI rules.');
  }
  if (want.outcome) {
    properties.outcome = { type: "string" };
    asks.push('"outcome": if the instructor\'s text states a course learning outcome or objective, copy it exactly; otherwise "".');
  }
  const schema = { type: "object", properties, required: Object.keys(properties) };

  const plan = planLines(ctx, ["subject", "delivery", "purpose", "capability", "skills", "product", "approach", "aiRole", "aiasLevel", "aiRules", "undermine"]);
  const user = `The instructor's assessment plan:
${plan}
${assignmentBlock(pasted)}
Write the missing parts of this assignment sheet. It is written to STUDENTS, so address them as "you". Base everything on the plan${pasted ? " and the instructor's text" : ""}. Do not invent sources, tools, dates, deadlines, or policies.
${asks.map((ask) => `- ${ask}`).join("\n")}`;

  return {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    schema,
    maxTokens: Math.min(1400, 300 + 70 * want.stages.length + 60 * asks.length),
    expected: 260 + 170 * want.stages.length + 160 * (asks.length - (want.stages.length ? 1 : 0)),
    validate(out) {
      const result = {
        title: want.title ? sentence(out?.title, 120).replace(/\.$/, "") : "",
        why: want.why ? sentence(out?.why, 400) : "",
        task: want.task ? sentence(out?.task, 400) : "",
        aiWhy: want.aiWhy ? sentence(out?.aiWhy, 300) : "",
        outcome: "",
        stages: want.stages.map((_, i) => sentence(Array.isArray(out?.stages) ? out.stages[i] : "", 400))
      };
      if (want.outcome) {
        const outcome = sentence(out?.outcome, 400);
        if (outcome && quoteFound(outcome, pasted)) result.outcome = outcome;
      }
      const any = [result.title, result.why, result.task, result.aiWhy, result.outcome, ...result.stages].some(Boolean);
      if (!any) throw new Error("The model's answer was empty. Try again, or pick a larger model.");
      return result;
    }
  };
}

/* ---------- 3. Tailor to my course ---------- */

// criteria: [{ name, weight, descriptions: [exemplary, proficient, developing, beginning] }]
export function tailorTask(ctx, criteria, pasted) {
  const schema = {
    type: "object",
    properties: {
      criteria: {
        type: "array",
        minItems: criteria.length,
        maxItems: criteria.length,
        items: {
          type: "object",
          properties: {
            exemplary: { type: "string" },
            proficient: { type: "string" },
            developing: { type: "string" },
            beginning: { type: "string" }
          },
          required: ["exemplary", "proficient", "developing", "beginning"]
        }
      }
    },
    required: ["criteria"]
  };

  const plan = planLines(ctx, ["subject", "delivery", "capability", "skills", "evidence", "product", "approach", "aiRole", "aiasLevel", "aiRules", "verification"]);
  const list = criteria.map((c, i) => [
    `${i + 1}. ${c.name} (${c.weight}%)`,
    `   Exemplary: ${clip(c.descriptions[0], 300)}`,
    `   Proficient: ${clip(c.descriptions[1], 300)}`,
    `   Developing: ${clip(c.descriptions[2], 300)}`,
    `   Beginning: ${clip(c.descriptions[3], 300)}`
  ].join("\n")).join("\n");

  const user = `The instructor's assessment plan:
${plan}
${assignmentBlock(pasted)}
Here are ${criteria.length} rubric criteria with their current descriptors:
${list}

Rewrite the four descriptors of each criterion, in the same order, so they describe this specific assignment: name what students actually produce and the skills involved. Keep each criterion about its own aspect of the work, so the criteria don't overlap. Keep the four levels parallel, so the difference between levels is clear. Each descriptor is one sentence of under 35 words that describes observable features of student work. Do not mention points, percentages, or level names.`;

  return {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    schema,
    maxTokens: Math.min(1800, 150 + 240 * criteria.length),
    expected: 700 * criteria.length,
    validate(out) {
      const rows = out?.criteria;
      if (!Array.isArray(rows) || rows.length !== criteria.length) throw new Error("The rubric came back with the wrong number of criteria. Try again.");
      return rows.map((row) => {
        const levels = [row?.exemplary, row?.proficient, row?.developing, row?.beginning].map((s) => sentence(s, 400));
        if (levels.some((s) => !s)) throw new Error("The rubric came back with a missing descriptor. Try again.");
        return levels;
      });
    }
  };
}

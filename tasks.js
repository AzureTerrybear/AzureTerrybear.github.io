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

const STOPWORDS = new Set(["that", "this", "with", "from", "they", "their", "them", "then", "than", "will", "your",
  "into", "each", "have", "about", "which", "what", "when", "were", "been", "also", "such", "some", "more", "students", "student"]);

// Small models often trim or reword a quote slightly. Accept it when it appears in the text,
// or when most of its content words do.
export function quoteSupported(quote, source) {
  if (quoteFound(quote, source)) return true;
  const haystack = normalize(source);
  const words = normalize(quote).replace(/[^a-z0-9' -]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  if (words.length < 2) return false;
  const present = words.filter((w) => haystack.includes(w.replace(/(es|s|ed|ing)$/, ""))).length;
  return present / words.length >= 0.75;
}

// questions: [{ key, name, ask, options: [{ value, label, hint }], infer }]
// "infer" questions (subject, skill) can be judged from what the assignment is about, so they
// always get an answer; the others need the text to say so, or the answer is "Not stated".
export function intakeTask(text, questions) {
  const properties = {};
  questions.forEach((q) => {
    const labels = q.options.map((o) => o.label);
    properties[q.name] = {
      type: "object",
      properties: {
        answer: { type: "string", enum: q.infer ? labels : [...labels, NOT_STATED] },
        quote: { type: "string" }
      },
      required: ["answer", "quote"]
    };
  });
  const schema = { type: "object", properties, required: questions.map((q) => q.name) };

  const listing = questions.map((q) => [
    `${q.name}: ${q.ask}${q.infer ? " (always pick the closest option, judging from what the assignment is about)" : ` (use "${NOT_STATED}" if the text doesn't say)`}`,
    ...q.options.map((o) => `  "${o.label}"${o.hint ? ` — ${o.hint}` : ""}`),
    ...(q.infer ? [] : [`  "${NOT_STATED}"`])
  ].join("\n")).join("\n\n");

  const user = `Here is an assignment an instructor gives students now:
<<<
${text}
>>>

Answer ${questions.length} questions about this assignment.
For each question, give "answer": one of the options listed for that question, written exactly as it appears inside the quotation marks. Then give "quote": the words from the assignment text that best support your answer, copied exactly (a few words is enough). If the answer is "${NOT_STATED}", the quote is "".

${listing}`;

  return {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    schema,
    maxTokens: 500,
    expected: 480,
    validate(out) {
      const result = {};
      questions.forEach((q) => {
        const item = out?.[q.name] ?? {};
        const answer = oneLine(item.answer).toLowerCase();
        const option = q.options.find((o) => o.label.toLowerCase() === answer);
        const quote = oneLine(item.quote).replace(/^["'“”‘’]+|["'“”‘’]+$/g, "");
        if (!option) result[q.key] = { status: "unstated" };
        else if (quote && quoteSupported(quote, text)) result[q.key] = { status: "found", value: option.value, quote: clip(quote, 140) };
        else if (q.infer) result[q.key] = { status: "inferred", value: option.value };
        else result[q.key] = { status: "unverified", value: option.value };
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

/* ---------- 4. Read it like a student ---------- */

// sheet: the assignment sheet as plain text.
export function reviewTask(ctx, sheet) {
  const schema = {
    type: "object",
    properties: {
      issues: {
        type: "array",
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["unclear", "missing", "conflict", "hard to read"] },
            quote: { type: "string" },
            question: { type: "string" },
            fix: { type: "string" }
          },
          required: ["kind", "quote", "question", "fix"]
        }
      }
    },
    required: ["issues"]
  };
  const plan = planLines(ctx, ["subject", "delivery", "purpose", "aiRole", "aiasLevel"]);
  const user = `Course context:
${plan}

Here is an assignment sheet a student will read:
<<<
${sheet}
>>>

Read it as a student seeing it for the first time. List up to 6 real problems a student would get stuck on or have to ask about:
- "unclear": an instruction a student could read two ways
- "missing": something a student needs but isn't there, such as length, format, or where and how to submit
- "conflict": two parts that contradict each other, especially in the AI rules
- "hard to read": wording that's long, dense, or full of jargon
Ignore anything in [square brackets]: those are blanks the instructor will fill in, including due dates.
For each problem give "quote": the exact words from the sheet it's about (or "" if something is missing), "question": the question a student would ask, in one sentence, and "fix": one sentence telling the instructor what to change.
Only report real problems. If the sheet is clear, return {"issues": []}.`;

  return {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    schema,
    maxTokens: 900,
    expected: 900,
    validate(out) {
      if (!Array.isArray(out?.issues)) throw new Error("The model's answer was incomplete. Try again.");
      return out.issues
        .map((item) => ({
          kind: ["unclear", "missing", "conflict", "hard to read"].includes(item?.kind) ? item.kind : "unclear",
          quote: sentence(item?.quote, 200),
          question: sentence(item?.question, 300),
          fix: sentence(item?.fix, 300)
        }))
        // A quote has to come from the sheet; otherwise the problem is probably invented.
        .filter((item) => item.question && (!item.quote || quoteSupported(item.quote, sheet)))
        .slice(0, 6);
    }
  };
}

/* ---------- 5. Make a version ---------- */

export const VARIANTS = {
  plain: {
    label: "Plain-language version",
    ask: "Rewrite each line in plain language for students: short sentences, common words, about an eighth-grade reading level. Keep every requirement, number, and name."
  },
  online: {
    label: "Online version",
    ask: "Adapt each line for a fully online, asynchronous course: replace anything done in class or in person (in-class work, live conversations, observed tasks) with an online equivalent such as a recorded video, a timed online submission, or a discussion post. Lines that don't involve being in class stay exactly as they are."
  },
  accommodation: {
    label: "Version with an accommodation",
    ask: "Adapt each line for this accommodation: \"{detail}\". Change only what the accommodation affects; every other line stays exactly as it is."
  }
};

const BRACKETS = /\[[^\]]+\]/g;

// lines: the sheet's text, one entry per paragraph or list item (labels like "Why:" removed).
export function variantTask(ctx, lines, variant, detail = "") {
  const spec = VARIANTS[variant];
  const schema = {
    type: "object",
    properties: { lines: { type: "array", items: { type: "string" }, minItems: lines.length, maxItems: lines.length } },
    required: ["lines"]
  };
  const plan = planLines(ctx, ["subject", "delivery", "aiRole", "aiasLevel"]);
  const ask = spec.ask.replace("{detail}", oneLine(detail).replace(/"/g, "'").slice(0, 200));
  const user = `Course context:
${plan}

Here are the ${lines.length} lines of an assignment sheet written to students:
${lines.map((line, i) => `${i + 1}. ${line}`).join("\n")}

${ask}
Return exactly ${lines.length} lines, in the same order, without the numbers. Keep anything in [square brackets] exactly as written. Don't add requirements, sources, tools, or dates.`;
  const chars = lines.join(" ").length;

  return {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    schema,
    maxTokens: Math.min(2200, Math.round(chars / 2.6) + 40 * lines.length + 100),
    expected: chars + 20 * lines.length,
    validate(out) {
      const rows = out?.lines;
      if (!Array.isArray(rows) || rows.length !== lines.length) throw new Error("The version came back with the wrong number of lines. Try again.");
      let changed = 0;
      const result = rows.map((row, i) => {
        const text = oneLine(row).replace(/^\d+\.\s+/, "");
        const keep = lines[i].match(BRACKETS) || [];
        // Keep the original line if the rewrite is empty or lost one of its blanks.
        if (!text || keep.some((blank) => !text.includes(blank))) return lines[i];
        if (text !== lines[i]) changed += 1;
        return clip(text, 900);
      });
      if (!changed) throw new Error("The model didn't change anything. Try again, or pick a larger model.");
      return result;
    }
  };
}

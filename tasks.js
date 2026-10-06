// The three personalization tasks. Each returns { messages, schema, validate }.
// The model only rewrites wording from the instructor's own inputs; structure,
// AIAS level, weights, patterns, and research examples stay deterministic.

const SYSTEM = [
  "You are an instructional design assistant helping a university instructor design an assessment.",
  "Use ONLY the information the instructor provided. Do not invent research findings, statistics, citations, tools, or institutional policies.",
  "Write in clear, concrete, plain English. Be specific to this assignment rather than generic.",
  "Respond with a single JSON object that matches the requested structure, and nothing else. /no_think"
].join(" ");

function brief(ctx) {
  return JSON.stringify(ctx, null, 2);
}

/* ---------- 1. Personalized rubric descriptors ---------- */

export function rubricTask(ctx, criteria) {
  const schema = {
    type: "object",
    properties: {
      criteria: {
        type: "array", minItems: criteria.length, maxItems: criteria.length,
        items: {
          type: "object",
          properties: {
            exemplary: { type: "string" }, proficient: { type: "string" },
            developing: { type: "string" }, beginning: { type: "string" }
          },
          required: ["exemplary", "proficient", "developing", "beginning"]
        }
      }
    },
    required: ["criteria"]
  };

  const list = criteria.map((c, i) =>
    `${i + 1}. ${c.name} (${c.weight}%)\n   Template proficient descriptor: ${c.descriptions[1]}`
  ).join("\n");

  const user = `Assessment details:\n${brief(ctx)}\n\nRewrite the performance descriptors for these ${criteria.length} rubric criteria, in this exact order. Keep each criterion's meaning, but make the wording specific to this assignment's skills, student product, and AI-use rules.\n\n${list}\n\nFor each criterion give four descriptors: exemplary, proficient, developing, beginning. Each descriptor: one or two sentences, under 45 words, describing observable features of student work. Keep the four levels parallel so the difference between levels is clear.`;

  return {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    schema,
    validate(out) {
      const arr = out?.criteria;
      if (!Array.isArray(arr) || arr.length !== criteria.length) throw new Error("Rubric had the wrong number of criteria.");
      return arr.map((c) => {
        const d = [c.exemplary, c.proficient, c.developing, c.beginning];
        if (d.some((s) => typeof s !== "string" || !s.trim())) throw new Error("Rubric descriptor missing.");
        return d.map((s) => s.trim());
      });
    }
  };
}

/* ---------- 2. Student-facing AI-use instructions ---------- */

export function instructionsTask(ctx) {
  const schema = {
    type: "object",
    properties: {
      overview: { type: "string" },
      permitted: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 6 },
      prohibited: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 6 },
      documentation: { type: "string" },
      why: { type: "string" }
    },
    required: ["overview", "permitted", "prohibited", "documentation", "why"]
  };

  const user = `Assessment details:\n${brief(ctx)}\n\nWrite the AI-use instructions that will appear in the assignment for STUDENTS. Address students as "you".\n- overview: 2–3 sentences naming the AIAS level and what it means for this assignment.\n- permitted: concrete examples of allowed AI uses for this task (empty list if AI is not allowed).\n- prohibited: concrete examples of uses that are not allowed.\n- documentation: exactly what students must submit about their AI use.\n- why: 1–2 sentences explaining how these rules protect the learning the assignment is designed to show.\nStay consistent with the instructor's stated rules; do not add permissions they did not give.`;

  return {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    schema,
    validate(out) {
      if (!out || typeof out.overview !== "string") throw new Error("Instructions incomplete.");
      return {
        overview: out.overview.trim(),
        permitted: (out.permitted ?? []).filter((s) => typeof s === "string" && s.trim()),
        prohibited: (out.prohibited ?? []).filter((s) => typeof s === "string" && s.trim()),
        documentation: String(out.documentation ?? "").trim(),
        why: String(out.why ?? "").trim()
      };
    }
  };
}

/* ---------- 3. Alignment check ---------- */

export function alignmentTask(ctx) {
  const schema = {
    type: "object",
    properties: {
      issues: {
        type: "array", maxItems: 5,
        items: {
          type: "object",
          properties: {
            severity: { type: "string", enum: ["high", "medium", "low"] },
            fields: { type: "array", items: { type: "string" }, maxItems: 3 },
            issue: { type: "string" },
            suggestion: { type: "string" }
          },
          required: ["severity", "fields", "issue", "suggestion"]
        }
      }
    },
    required: ["issues"]
  };

  const user = `Assessment details:\n${brief(ctx)}\n\nCheck this design for internal inconsistencies — places where the fields contradict each other or where the evidence would not support the intended inference. Examples: the purpose mentions teamwork but accountability is individual; the AI rules allow drafting but the risk notes say drafting undermines the skill; the student product does not show the stated skills.\nReport at most 5 real issues, most serious first. "fields" should name the field labels involved. If the design is consistent, return an empty issues list. Do not report missing information as an issue unless it breaks the design.`;

  return {
    messages: [{ role: "system", content: SYSTEM }, { role: "user", content: user }],
    schema,
    validate(out) {
      if (!Array.isArray(out?.issues)) throw new Error("Alignment check incomplete.");
      return out.issues
        .filter((i) => i && typeof i.issue === "string")
        .map((i) => ({
          severity: ["high", "medium", "low"].includes(i.severity) ? i.severity : "medium",
          fields: Array.isArray(i.fields) ? i.fields.map(String) : [],
          issue: i.issue.trim(),
          suggestion: String(i.suggestion ?? "").trim()
        }));
    }
  };
}

// Static content for the VALID-AI Assessment Designer.
// Nothing here is generated at runtime; the LLM layer never edits these.

export const steps = [
  { letter: "V", name: "Verify", tag: "Big Picture", question: "Why assess this? What learning does it measure?", deliverable: "Define a clear statement of the assessment’s purpose and importance." },
  { letter: "A", name: "Articulate", tag: "Goal", question: "What exact skill should students show?", deliverable: "Define the specific learning and skills being assessed." },
  { letter: "L", name: "Locate", tag: "Proof", question: "What work shows students have the skill?", deliverable: "Describe the evidence students will produce." },
  { letter: "I", name: "Inspect", tag: "Loophole Check", question: "Could AI do this and undermine the purpose?", deliverable: "Complete a risk check and identify necessary changes." },
  { letter: "D", name: "Design", tag: "Plan", question: "How will we structure the assignment?", deliverable: "Define the stages, instructions, and accountability structure." },
  { letter: "A", name: "Assign", tag: "Rules", question: "What exactly can students use AI for?", deliverable: "State the AI-use rules and required documentation." },
  { letter: "I", name: "Implement", tag: "Reality", question: "How will it be implemented and graded?", deliverable: "Plan the grading, verification, access, and student support." }
];

export const contextLabels = {
  art: "Art, Design, Performance", business: "Business and Organizations", communication: "Communication",
  education: "Education", stem: "Science, Tech, Engineering", health: "Health and Wellness",
  environment: "Environment", society: "Society, Community, Culture", global: "Global Perspectives", law: "Law and Justice"
};

export const labels = {
  delivery: { classroom: "in-classroom", async: "asynchronous online" },
  purposeType: { formative: "formative", summative: "summative", both: "formative and summative" },
  outcome: {
    knowledge: "foundational knowledge", analysis: "analysis and evaluation", application: "problem solving and application",
    creation: "creation and design", communication: "communication and reflection", judgment: "collaboration or professional judgment"
  },
  evidenceType: {
    written: "written analysis or argument", case: "case analysis or decision", solution: "problem solution or code",
    performance: "performance or demonstration", design: "design or created product", dialogue: "dialogue or presentation", portfolio: "process portfolio"
  },
  accountability: { individual: "individual work", team: "team product", both: "team product plus individual evidence" },
  risk: { low: "low AI-substitution risk", moderate: "moderate AI-substitution risk", high: "high AI-substitution risk", uncertain: "uncertain AI-substitution risk" },
  aiCapability: {
    whole: "Generate most of the final product", draft: "Generate a draft or approach", sources: "Supply claims or sources",
    solve: "Solve or code the task", media: "Generate images, audio, or video", edit: "Edit or polish the work", uncertain: "Uncertain"
  },
  structure: { small: "small seminar or studio", medium: "medium-sized course", large: "large course", team: "team- or project-based course" },
  aiRole: { none: "AI not used in assessed work", support: "AI permitted for limited support", collaborator: "AI required as a collaborator", critique: "AI output treated as an object of critique" },
  aiasLevel: {
    auto: "Recommend an AIAS level", one: "AIAS 1 · No AI", two: "AIAS 2 · AI Planning",
    three: "AIAS 3 · AI Collaboration", four: "AIAS 4 · Full AI", five: "AIAS 5 · AI Exploration"
  },
  disclosure: { statement: "brief AI-use statement", prompts: "prompts and outputs", decisions: "decision log plus selected interactions", full: "complete interaction record and disclosure" },
  grading: { analytic: "analytic rubric", checklist: "criterion checklist with feedback", holistic: "holistic rubric", contract: "specifications or contract grading" },
  verification: { none: "no additional verification", spot: "brief individual spot checks", defense: "short written or recorded defense", observed: "observed or controlled component" }
};

const guide = (choose, why, caution) => ({ choose, why, caution });
export const choiceGuidance = {
  delivery: {
    classroom: guide("Students can interact, perform, or receive feedback together at a scheduled time.", "It supports observation, dialogue, and immediate clarification.", "Provide an equivalent path for absences and accessibility needs."),
    async: guide("Students need flexible participation across different times or locations.", "It supports reflection, staged work, and persistent process evidence.", "Use checkpoints and clear deadlines so the task does not become one large final submission.")
  },
  purposeType: {
    formative: guide("The main goal is practice, feedback, and improvement.", "Students can take risks and use feedback before a higher-stakes judgment.", "Keep the grading weight low enough that experimentation is genuinely safe."),
    summative: guide("The task must support a final judgment about achievement.", "It provides evidence for a grade, credential, or progression decision.", "Use clear criteria, comparable conditions, and enough evidence for the stakes involved."),
    both: guide("Students should practice and then demonstrate achievement in the same assessment sequence.", "Early feedback can improve learning while the final stage supports a summative judgment.", "Separate practice evidence from the evidence used for the final grade.")
  },
  outcome: {
    knowledge: guide("Students must explain, retrieve, or connect foundational ideas.", "It reveals whether students possess the conceptual base needed for later work.", "Avoid assessing memorization alone when students ultimately need to apply the knowledge."),
    analysis: guide("Students must examine evidence, compare interpretations, or judge quality.", "It makes reasoning, criteria, and source evaluation visible.", "Require students to explain how they reached a judgment, not only state a conclusion."),
    application: guide("Students must use knowledge to solve a new problem or make a decision.", "It tests transfer beyond rehearsed examples.", "Use a sufficiently novel situation so students cannot simply reproduce a model answer."),
    creation: guide("Students must design, compose, build, or produce something for a purpose.", "It reveals how students integrate knowledge and make design decisions.", "Assess the rationale and process as well as the polish of the final product."),
    communication: guide("Students must explain ideas to a particular audience or reflect on learning.", "It assesses clarity, audience awareness, and metacognition.", "Do not let production quality outweigh disciplinary meaning."),
    judgment: guide("Students must collaborate, prioritize, or make a defensible professional judgment.", "It approximates consequential decisions students may face in practice.", "Include individual evidence when a shared product is involved.")
  },
  evidenceType: {
    written: guide("Reasoning is best demonstrated through a sustained explanation or argument.", "Writing can reveal evidence use, conceptual connections, and justification.", "A polished paper alone may not establish how the reasoning was produced."),
    case: guide("Students need to evaluate a realistic situation and make a decision.", "Cases make application, tradeoffs, and professional judgment visible.", "Include ambiguity and require justification; otherwise the task may become answer matching."),
    solution: guide("Students must solve a quantitative, technical, or coding problem.", "The solution and visible reasoning can show both accuracy and method.", "Collect tests, intermediate reasoning, or explanation—not only the final answer."),
    performance: guide("The capability must be enacted, demonstrated, or observed.", "Direct observation is strong evidence for procedures and interpersonal skills.", "Plan accessible alternatives and calibrate observers."),
    design: guide("Students must create a product that responds to defined needs or constraints.", "The artifact plus rationale reveals integrated decision-making.", "Grade disciplinary decisions rather than expensive materials or production polish."),
    dialogue: guide("Students must explain, defend, question, or respond in real time or by recording.", "Dialogue can reveal flexible understanding and individual reasoning.", "Use a protocol so confidence and fluency do not replace evidence."),
    portfolio: guide("Learning develops across stages and revisions.", "A portfolio makes process, feedback use, and growth visible.", "Select a few consequential artifacts so documentation does not overwhelm learning.")
  },
  accountability: {
    individual: guide("The grade must represent each student’s own capability.", "Individual evidence supports clearer attribution of learning.", "Collaboration can still occur during practice if final evidence remains attributable."),
    team: guide("The learning outcome is genuinely collective and the shared product is the main target.", "It creates authentic opportunities to coordinate expertise and decisions.", "A team product alone cannot support strong claims about every individual’s learning."),
    both: guide("Students must collaborate and also demonstrate individual understanding.", "It preserves authentic teamwork while supporting individual grading decisions.", "Keep the individual component focused so it does not duplicate the whole project.")
  },
  risk: {
    low: guide("AI cannot readily produce the key evidence or using it would not conceal the target skill.", "The current design already makes the intended learning reasonably visible.", "Continue to monitor tool changes and clarify permitted use."),
    moderate: guide("AI could complete parts of the task but students must still make important decisions.", "Targeted safeguards can preserve evidence without redesigning the entire assessment.", "Identify exactly which stage needs process evidence or verification."),
    high: guide("AI could generate most of the assessed product or conceal the intended capability.", "Recognizing high risk signals that the evidence—not simply the policy—must change.", "Add independent, observed, staged, or defended evidence rather than relying on detection."),
    uncertain: guide("You do not yet know what current tools can do with the assignment.", "Uncertainty is a reason to test the task before using it at high stakes.", "Run the prompt through approved tools and pilot the assessment with sample responses.")
  },
  aiCapability: {
    whole: guide("A tool can create something close to the final submission.", "This identifies a direct threat to attributing the product to the student.", "Shift weight toward decisions, process, verification, or defense."),
    draft: guide("A tool can generate an outline, first version, or plausible approach.", "Draft generation may be acceptable if students must evaluate and transform it.", "Define what meaningful revision and documentation look like."),
    sources: guide("A tool can supply claims, summaries, quotations, or citations.", "Source use is often central to evidence-based reasoning.", "Require verification in original sources and treat fabricated citations as substantive errors."),
    solve: guide("A tool can solve the problem or produce working code.", "The final answer may no longer reveal the student’s reasoning.", "Collect tests, explanations, alternative methods, or a fresh transfer problem."),
    media: guide("A tool can generate images, audio, video, or design elements.", "The output may obscure authorship and design decisions.", "Require provenance, iteration evidence, and a rationale for selection and revision."),
    edit: guide("A tool can substantially rewrite, translate, or polish student work.", "Editing may improve access while also masking communication skill.", "Specify the acceptable level of editing and retain a pre-edit sample when needed."),
    uncertain: guide("The tool capability is unfamiliar or changing quickly.", "Naming uncertainty encourages testing instead of assumptions.", "Pilot the task and revisit the risk after examining real outputs.")
  },
  structure: {
    small: guide("The course allows frequent interaction and individualized feedback.", "Seminars and studios can use dialogue, observation, and iterative critique.", "Document criteria so close interaction does not lead to inconsistent grading."),
    medium: guide("The course can support a few meaningful checkpoints and targeted individual contact.", "It balances rich evidence with a manageable workload.", "Use shared examples and a focused rubric to keep feedback consistent."),
    large: guide("The design must work efficiently across many students or multiple graders.", "Structured stages, common prompts, and sampling can preserve quality at scale.", "Use grader calibration and avoid labor-intensive verification for every student."),
    team: guide("The course centers on collaborative projects or distributed roles.", "It supports authentic coordination and complex products.", "Pair shared work with concise individual evidence and transparent contribution expectations.")
  },
  aiRole: {
    none: guide("Independent performance is essential to the learning claim.", "Excluding AI from the assessed stage can provide attributable evidence of foundational capability.", "Create practical conditions for independent work and explain why they matter."),
    support: guide("AI may assist selected stages but is not the primary object of assessment.", "Students can receive useful support while retaining responsibility for core reasoning.", "Name allowed and prohibited uses with concrete examples."),
    collaborator: guide("Managing AI is itself part of the capability students must learn.", "It supports authentic practice in fields where AI-assisted work is expected.", "Grade prompting, verification, selection, and revision decisions—not the AI’s fluency."),
    critique: guide("Students must analyze, verify, or improve AI-generated work.", "AI output becomes evidence to examine rather than an answer to submit.", "Grade the student’s critique and provide comparable outputs when fairness matters.")
  },
  aiasLevel: {
    auto: guide("You want the tool to suggest a level from the selected AI role and learning outcome.", "It reduces option overload while keeping the recommendation editable.", "Confirm the wording against your institutional policy and the exact task instructions."),
    one: guide("Knowledge, understanding, or skill must be demonstrated independently in conditions designed to exclude AI.", "AIAS 1 provides evidence of performance without AI assistance.", "Controlled conditions are compulsory at this level; explain why unaided performance is necessary."),
    two: guide("The task assesses planning such as topic exploration, outlining, or initial research.", "AI may support planning while the quality of the planning and idea development remains assessable.", "Make clear which planning evidence is submitted and what later work must remain the student’s own."),
    three: guide("AI may support idea generation, drafting, feedback, or refinement, but AI alone cannot meet the standard.", "Assessment can focus on the work and on how students evaluate, modify, and integrate AI output.", "Require evidence of consequential decisions rather than a burdensome transcript of every interaction."),
    four: guide("AI involvement is expected and the task requires human–AI work to reach the goal in the available time.", "Assessment focuses on critical thinking and subject knowledge shown while directing AI.", "Design criteria around direction, verification, integration, and accountability—not merely the finished product."),
    five: guide("The task invites creative or novel uses of AI to solve problems or develop disciplinary insights.", "AIAS 5 supports exploration where approaches may be co-designed with students.", "Use clear ethical boundaries and assess the quality, originality, and disciplinary value of the exploration.")
  },
  disclosure: {
    statement: guide("AI use is minor and only a concise record is needed.", "A brief statement creates transparency without excessive documentation.", "Specify the minimum information: tool, purpose, and where it affected the work."),
    prompts: guide("The prompts and outputs are directly relevant to evaluating the work.", "They reveal what the tool contributed and what the student received.", "Long transcripts can burden students and graders; identify which interactions matter."),
    decisions: guide("The learning target includes judgment about accepting, rejecting, or revising AI output.", "A decision log focuses attention on the student’s reasoning.", "Provide a short template so documentation is consistent and purposeful."),
    full: guide("The complete interaction is necessary for a critique, audit, or high-stakes review.", "A full record supports close examination of process and provenance.", "Address privacy and data retention, and avoid requiring irrelevant conversations.")
  },
  grading: {
    analytic: guide("Several distinct dimensions must be scored separately.", "An analytic rubric clarifies expectations and supports feedback and grader calibration.", "Keep the number of criteria manageable and align each one to the learning outcome."),
    checklist: guide("The task has clear required features and feedback matters more than fine score distinctions.", "A checklist is efficient and makes completion criteria transparent.", "It may not capture important differences in reasoning quality."),
    holistic: guide("The quality of the integrated performance matters more than separate components.", "A holistic rubric supports an overall judgment of complex work.", "Use annotated examples so raters interpret performance levels consistently."),
    contract: guide("Students complete defined levels or bundles of work and revision.", "Specifications can emphasize practice, completion, and improvement.", "Criteria must still define acceptable disciplinary quality, not only task completion.")
  },
  verification: {
    none: guide("The existing evidence already makes authorship and reasoning sufficiently visible.", "Avoiding unnecessary verification reduces burden and surveillance.", "Reconsider this choice if the task is high stakes or easily generated."),
    spot: guide("The course is large or the risk is moderate.", "Sampling provides a feasible check without requiring every student to complete an additional task.", "Use a transparent selection process and consistent questions."),
    defense: guide("Students should briefly explain or defend consequential choices.", "A focused defense can confirm understanding and reveal reasoning behind the product.", "Keep it short, predictable, and accessible; offer written or recorded formats."),
    observed: guide("The skill must be demonstrated independently or in real time.", "Observation provides direct evidence of performance under defined conditions.", "Plan accommodations, equivalent alternatives, and observer calibration.")
  }
};

export const starterApproaches = {
  independent: {
    title: "Independent demonstration",
    summary: "Students show what they can do without AI during the assessed stage.",
    choose: "The learning claim requires unaided knowledge, reasoning, performance, or authorship.",
    why: "It produces clearer evidence that the capability belongs to the individual student.",
    caution: "It may be less representative of professional settings where AI is routinely available.",
    values: {
      outcome: "application", evidenceType: "performance", accountability: "individual", risk: "high", aiCapability: "whole",
      purposeStatement: "Students must demonstrate that they can perform the essential capability independently before using external assistance.",
      learningStatement: "The assessment measures independent application of course knowledge, accurate reasoning, and the ability to explain key decisions.",
      inferenceStatement: "The completed task must support the claim that each student can perform the essential capability independently under defined conditions.",
      skills: "Apply relevant concepts to a new situation, complete the essential task independently, and justify the most consequential decisions.",
      product: "Each student will complete an individual application task and provide a concise explanation of the reasoning used.",
      undermine: "An AI-generated response could conceal whether the student can perform the essential capability independently.",
      mitigation: "Use an observed, controlled, or human-first component and collect a brief explanation of the student’s reasoning.",
      stages: "practice with feedback → independent demonstration → brief explanation → targeted feedback or retry",
      aiRole: "none", aiasLevel: "one", allowed: "AI may be used during designated practice activities but not during the independent assessed component. Students must identify any preparation materials created with AI.",
      disclosure: "statement", grading: "analytic", verification: "observed",
      support: "Provide practice opportunities, clear independent-work conditions, accessibility accommodations, an equivalent make-up option, and an analytic rubric with examples."
    }
  },
  support: {
    title: "AI-supported work",
    summary: "Students may use AI during selected stages while retaining responsibility for the core work.",
    choose: "AI can help with brainstorming, feedback, organization, or editing without replacing the central learning.",
    why: "It supports authentic and efficient work while keeping the intended reasoning visible.",
    caution: "Permitted and prohibited uses must be concrete, and consequential claims still require verification.",
    values: {
      outcome: "creation", evidenceType: "portfolio", accountability: "individual", risk: "moderate", aiCapability: "draft",
      purposeStatement: "Students must create a disciplinary product while making and explaining the decisions that determine its quality.",
      learningStatement: "The assessment measures planning, disciplinary decision-making, revision, and responsible use of support tools.",
      inferenceStatement: "The completed task must support the claim that the student can make, document, and justify disciplinary decisions while using AI as a bounded support tool.",
      skills: "Develop an original approach, evaluate suggestions, revise using disciplinary criteria, and explain which recommendations were accepted or rejected.",
      product: "Each student will submit a final product, selected process evidence, and a rationale explaining the most important revisions and decisions.",
      undermine: "AI could generate a plausible draft that hides whether the student can make the central disciplinary decisions.",
      mitigation: "Collect a human-authored proposal, selected checkpoints, an AI decision log, and a final rationale tied to course criteria.",
      stages: "proposal → evidence or design check → AI-supported draft → feedback → revision → decision rationale",
      aiRole: "support", aiasLevel: "three", allowed: "AI may be used for brainstorming, organization, and feedback. It may not supply unverified claims, fabricate sources, or produce the final submission without substantial student evaluation and revision.",
      disclosure: "decisions", grading: "analytic", verification: "spot",
      support: "Provide an approved tool or equivalent alternative, an AI-use decision-log template, a low-stakes practice activity, checkpoints, privacy guidance, and calibrated examples."
    }
  },
  critique: {
    title: "AI critique",
    summary: "Students evaluate, verify, and improve an AI-generated response.",
    choose: "The learning outcome emphasizes analysis, evaluation, source verification, bias detection, or revision.",
    why: "AI output becomes an object of disciplinary analysis rather than an answer students simply submit.",
    caution: "Grade the student’s reasoning and corrections—not the quality of the original AI response.",
    values: {
      outcome: "analysis", evidenceType: "case", accountability: "individual", risk: "moderate", aiCapability: "sources",
      purposeStatement: "Students must make evidence-based judgments they will encounter in professional practice.",
      learningStatement: "The assessment measures analysis, source evaluation, disciplinary judgment, and the ability to correct flawed reasoning.",
      inferenceStatement: "The completed task must support the claim that the student can recognize quality, verify evidence, and correct a plausible AI-generated response.",
      skills: "Analyze claims, evaluate the credibility and relevance of evidence, identify assumptions or omissions, and justify a corrected conclusion.",
      product: "Each student will submit an annotated AI response, a source-verification record, a corrected recommendation, and a brief rationale.",
      undermine: "Students could accept a polished AI response without demonstrating that they can evaluate its claims, sources, assumptions, or omissions.",
      mitigation: "Require claim-level verification, annotations tied to disciplinary criteria, a corrected response, and a short individual defense of one consequential revision.",
      stages: "initial review → claim and source verification → annotated critique → corrected response → brief defense",
      aiRole: "critique", aiasLevel: "three", allowed: "Students must analyze one approved AI response. AI may be used to generate alternatives but not to write the final critique. All claims and citations must be checked against original sources.",
      disclosure: "full", grading: "analytic", verification: "defense",
      support: "Provide a fixed or approved AI response, an annotated example, source-verification guidance, a disclosure template, accessible response formats, and calibrated benchmark critiques."
    }
  },
  professional: {
    title: "Professional simulation",
    summary: "Students use AI under conditions that resemble responsible professional practice.",
    choose: "The capability includes making consequential decisions while using tools common in the field.",
    why: "It assesses disciplinary judgment, verification, and tool management in an authentic context.",
    caution: "Address privacy, unequal tool access, professional standards, and individual accountability.",
    values: {
      outcome: "judgment", evidenceType: "case", accountability: "both", risk: "moderate", aiCapability: "draft",
      purposeStatement: "Students must make defensible professional decisions while using AI responsibly within disciplinary and ethical constraints.",
      learningStatement: "The assessment measures evidence-based judgment, responsible tool use, communication, and accountability for outcomes.",
      inferenceStatement: "The completed task must support the claim that the student can use legitimate tools to make and defend a responsible professional decision.",
      skills: "Frame a professional problem, direct an AI tool appropriately, verify its contributions, weigh alternatives and risks, and defend a final decision.",
      product: "Students will produce a professional recommendation or solution, a concise AI decision log, and an individual defense of one consequential choice.",
      undermine: "Students could delegate the central professional judgment to AI and submit a plausible result without understanding its risks or limitations.",
      mitigation: "Require a decision log, original-source verification, documented human approval points, and individual accountability for the final recommendation.",
      stages: "case briefing → independent problem framing → bounded AI use → verification → team or individual recommendation → individual defense",
      aiRole: "collaborator", aiasLevel: "four", allowed: "Students may use an approved AI tool for alternatives, drafting, or analysis support. They remain responsible for verification, confidentiality, professional standards, and every final decision.",
      disclosure: "decisions", grading: "analytic", verification: "defense",
      support: "Provide an approved tool or equivalent alternative, privacy and professional-use guidance, a realistic case, decision-log examples, checkpoints, and grader calibration."
    }
  },
  recommend: {
    title: "Not sure—recommend a starting point",
    summary: "Answer the purpose and capability questions first; the tool will then suggest one of the four approaches.",
    choose: "You know what students should learn but are unsure what role AI or verification should play.",
    why: "The recommendation will use the primary student capability to prefill the remaining steps while keeping every choice editable.",
    caution: "Treat the recommendation as a draft. Course stakes, disciplinary standards, access, and local policy may justify a different approach.",
    values: {}
  }
};

export const patterns = [
  { name: "Verified AI-output critique", description: "Students annotate a fixed AI response, verify substantive claims, correct errors or omissions, and explain their disciplinary reasoning.", evidence: "Annotated output, verification table, credible sources, corrected version, and rationale.", caution: "Grade verification and reasoning, not the polish of the AI response.", outcomes: ["analysis", "judgment", "communication"], evidenceTypes: ["written", "case", "solution"], aiRoles: ["critique"], integrity: true },
  { name: "Human-first comparison and reflection", description: "Students complete an initial response independently, compare it with an AI response, then revise while explaining what they accepted or rejected.", evidence: "Independent attempt, prompt and output, comparison, revision, and reflection.", caution: "Collect the independent attempt before AI access.", outcomes: ["analysis", "creation", "communication"], evidenceTypes: ["written", "case", "design"], aiRoles: ["support", "collaborator", "critique"], integrity: true },
  { name: "Authentic case with brief defense", description: "Students analyze a realistic, locally specific case and defend one consequential decision in a short oral, written, or recorded response.", evidence: "Case analysis, sources, decision rationale, and individual defense.", caution: "Use sampling or short recorded defenses to keep larger courses viable.", outcomes: ["analysis", "application", "judgment"], evidenceTypes: ["case", "written", "dialogue"], aiRoles: ["none", "support", "collaborator"], integrity: true },
  { name: "Process portfolio with checkpoints", description: "Students submit a proposal, evidence, interim work, feedback response, revision, and final rationale connecting decisions to course criteria.", evidence: "Staged artifacts, version history, feedback response, final product, and rationale.", caution: "Use a few consequential checkpoints rather than documenting every action.", outcomes: ["creation", "communication", "judgment"], evidenceTypes: ["portfolio", "design", "written"], aiRoles: ["none", "support", "collaborator", "critique"], integrity: true },
  { name: "Attempt–feedback–retry task", description: "Students first solve or explain without AI, evaluate feedback, and submit a corrected attempt with an explanation of changes.", evidence: "First attempt, feedback analysis, revised attempt, and change explanation.", caution: "Do not release generative help before the first attempt when independent retrieval is the target.", outcomes: ["knowledge", "application"], evidenceTypes: ["solution", "written"], aiRoles: ["none", "support", "collaborator"], integrity: true },
  { name: "Observed performance or demonstration", description: "Students perform a procedure, explain a live problem-solving step, create under observation, or demonstrate a professional interaction.", evidence: "Observed performance, rubric ratings, artifact or recording, and focused self-assessment.", caution: "Provide accessible and equivalent alternatives for absences or disability-related needs.", outcomes: ["application", "creation", "judgment"], evidenceTypes: ["performance", "dialogue", "design"], aiRoles: ["none", "support"], integrity: true },
  { name: "Team product with individual accountability", description: "Teams create a shared solution or product while each student submits an individual decision memo or brief defense.", evidence: "Team artifact, role record, individual memo, and peer or instructor evidence.", caution: "Do not infer individual learning from the group product alone.", outcomes: ["application", "creation", "judgment"], evidenceTypes: ["design", "case", "portfolio"], aiRoles: ["none", "support", "collaborator"], integrity: true },
  { name: "Multimodal explanation", description: "Students explain a concept or decision through a concise combination of prose, diagram, data display, audio, video, or demonstration.", evidence: "Final explanation, sources, design rationale, and process note.", caution: "Score disciplinary meaning and audience fit rather than production value.", outcomes: ["knowledge", "creation", "communication"], evidenceTypes: ["design", "dialogue", "performance"], aiRoles: ["none", "support", "collaborator"], integrity: false },
  { name: "Structured dialogue or counterargument", description: "Students defend a claim, respond to a peer or AI-generated counterargument, and revise using disciplinary evidence.", evidence: "Initial claim, counterargument response, evidence trail, revision, and reflection.", caution: "Use a protocol so confidence or fluency does not substitute for evidence.", outcomes: ["analysis", "communication", "judgment"], evidenceTypes: ["dialogue", "written", "case"], aiRoles: ["none", "support", "collaborator", "critique"], integrity: true },
  { name: "Bounded application task", description: "Students apply course concepts to new data, a novel scenario, or a constrained problem in a controlled or time-bounded setting.", evidence: "Completed task, visible reasoning, and a targeted explanation of key decisions.", caution: "Use application rather than memorized recall and provide reasonable accommodations.", outcomes: ["knowledge", "application"], evidenceTypes: ["solution", "case", "performance"], aiRoles: ["none"], integrity: true }
];

// Kept as-is from the original tool. Citations not yet verified — see README.
export const examples = {
  art: { title: "Compare conventional and GenAI design workflows", implementation: "Thirty-four third-year fashion-design students created matched textile designs with conventional Illustrator tools and Adobe text-to-vector GenAI during supervised studios.", assignment: "Create a matched set with and without GenAI, curate one result from each workflow, manually refine a final design, and explain efficiency, editability, style, originality, and authorship.", finding: "GenAI reduced difficulty and increased efficiency, but conventional work was rated higher for personal style, editability, creativity, aesthetic value, satisfaction, and goal fulfillment.", evidence: "Empirical within-student mixed-methods comparison; the grading adaptation extends the studied task.", url: "https://link.springer.com/article/10.1186/s40691-026-00459-w" },
  business: { title: "Human-first environmental scan, then AI comparison", implementation: "Principles of Marketing students completed their own environmental scan, asked generative AI to complete the same task, compared the two, and reflected on the contrast.", assignment: "Complete a sourced human-first PESTLE, SWOT, or market scan; generate an AI scan; then identify useful additions, generic claims, missing context, unsupported statements, and needed revisions.", finding: "Thematic analysis found reflective dialogue, situated judgment, ethical engagement, model-based scaffolding, and meta-learning.", evidence: "Empirical thematic analysis of student reflections; course size and delivery mode were not reported in the accessible summary.", url: "https://doi.org/10.1177/02734753251356691" },
  communication: { title: "Audit AI press releases and defend a correction", implementation: "Forty graduate students compared an official malaria-vaccine press release with three deliberately flawed AI rewrites, using track changes to correct inaccuracies, audience bias, and fallacies.", assignment: "Audit fixed AI versions with a communication framework, record a two-minute defense of the most consequential edit, and complete a short transfer reflection.", finding: "Mean performance was high for factual-error detection, fallacy identification, the elevator pitch, and reflection; subtle audience bias was harder.", evidence: "Implemented curriculum intervention with rubric-based performance evidence.", url: "https://journals.asm.org/doi/10.1128/jmbe.00044-26" },
  education: { title: "Use AI as a mentor for a learning-design project", implementation: "Graduate students in a 16-week asynchronous course completed three AI-mentored activities involving hybrid learning, a virtual community of practice, and a facilitation plan with rubric.", assignment: "Question AI suggestions, select and revise only ideas that fit learners and outcomes, and document accepted and rejected recommendations in a decision log.", finding: "Students reported benefits for idea generation, project structure, and immediate feedback, along with problems involving prompt specificity and pacing.", evidence: "Implemented asynchronous course activities with student survey evidence.", url: "https://www.emerald.com/aiie/article/1/1/56/1297472/Artificial-intelligence-as-a-mentor-in-the" },
  stem: { title: "Alternate student and AI solver–critic roles", implementation: "A graduate computational-bioengineering course integrated LLM components across seven biweekly homework sets for 21 students.", assignment: "On one problem, the student solves and AI critiques; on another, AI solves and the student tests every calculation or line of code and writes a verdict.", finding: "Students frequently found incorrect calculations, unsuitable assumptions, and code errors; all assigned LLM components were completed.", evidence: "Implemented across seven assignments with completion and student-response evidence.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10902225/" },
  health: { title: "Critique AI answers to clinical genetics questions", implementation: "Each of 155 incoming medical students critiqued one fixed ChatGPT response to a clinical-genetics vignette in 300–500 words using four or five biomedical sources.", assignment: "Verify claims individually, correct the answer for a named audience, compare critiques in small groups, and deliver a brief patient- or family-facing explanation.", finding: "Students generally valued the medical context and critical-appraisal practice, though some considered the writing or discussion unnecessary.", evidence: "Implemented large-cohort exercise with student feedback.", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12812124/" },
  environment: { title: "Build and critique a carbon-neutral future", implementation: "An eight-hour climate-change module guided 120 students across two cohorts through scientific pathways, drivers, and text- or image-GenAI representations of a carbon-neutral city in 2053.", assignment: "Analyze evidence-based pathways, generate a future scenario, and audit the output for scientific plausibility, omissions, stereotypes, and actionable detail.", finding: "Both groups developed more positive sustainability associations and greater climate hope; the image group also improved on self-perceived action competence.", evidence: "Mixed-methods pre/post comparison of two implemented course modules.", url: "https://link.springer.com/article/10.1007/s10956-025-10229-w" },
  society: { title: "Analyze an AI-generated youth-work case", implementation: "A social-work instructor used a contextualized AI case involving addiction, safety, family, education, peers, health, and housing; students developed an action plan aligned with professional ethics and policy.", assignment: "Identify assumptions and missing voices, verify relevant policy, analyze structural and cultural factors, and propose an evidence-based action plan.", finding: "The publication argues for specific, contextualized, multilayered tasks but does not report a controlled evaluation of student outcomes.", evidence: "Published instructor practice case and assessment-design analysis, not an outcome trial.", url: "https://doi.org/10.3390/socsci13120648" },
  global: { title: "Compare human and AI global-health research papers", implementation: "Twenty-eight graduate students generated an AI paper from the same prompt as their completed place-specific global-health paper and compared sections, synthesis, quality, and references.", assignment: "Write a human-first briefing integrating three perspectives, generate an AI version, verify every reference, and identify where AI flattened geographic, cultural, political, or historical complexity.", finding: "Most rated AI papers inferior or similar; only 54% of 729 AI references were authentic and 14.4% were both authentic and relevant.", evidence: "Empirical comparison, but the AI phase was an ungraded post-course research activity.", url: "https://link.springer.com/article/10.1186/s13040-024-00408-7" },
  law: { title: "Critique an AI-generated criminal-justice research paper", implementation: "In an asynchronous research-methods course, students generated an AI paper on their criminal-justice topic and completed a critique worksheet with source verification.", assignment: "Evaluate framing, legal or policy claims, research design, affected communities, omitted perspectives, and every cited source before producing a corrected evidence map.", finding: "Many outputs were only outlines or omitted sources; the author recommends requiring a complete response and at least five verifiable sources.", evidence: "Implemented asynchronous assignment with student survey evidence and revision recommendations.", url: "https://www.tandfonline.com/doi/abs/10.1080/10511253.2026.2646601" }
};

export const aiasDescriptions = {
  one: "The task is completed in controlled conditions designed to exclude AI so knowledge, understanding, or skill is demonstrated independently.",
  two: "AI may support planning activities such as topic exploration, outlining, and initial research; the quality of planning and idea development is assessed.",
  three: "AI may support idea generation, drafting, feedback, and refinement; assessment covers the work and how AI output is evaluated, modified, and integrated.",
  four: "AI involvement is expected; assessment focuses on the critical thinking and subject knowledge shown while directing AI.",
  five: "The task supports creative AI use to solve problems, generate insights, or develop innovative disciplinary solutions."
};

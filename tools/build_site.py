"""Build the site from a design file.

The design is made as a single HTML file (sometimes wrapped in a sandboxed
preview frame). This script takes that file apart and writes the four
generated files of the site:

  index.html   the page: the design's markup, plus the site's own files
  base.css     the design's base styles, unchanged
  styles.css   the design's own styles, unchanged
  app.js       the design's script, with the small changes listed in PATCHES

Everything else in the site (site.css, site.js, ai.js, tasks.js, llm.js,
webllm.js, worker.js) is written by hand and isn't touched.

Usage:
  python3 tools/build_site.py <design.html> [site_folder]

Each change looks for an exact piece of the design's code. If the design
changed that piece, the script stops and names the change, so nothing is
patched halfway. Update that change to match the new code, then run again.
"""
import hashlib
import re
import sys
from html.parser import HTMLParser
from pathlib import Path


class SrcdocFinder(HTMLParser):
    """Finds the document inside a preview wrapper's srcdoc attribute."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.srcdoc = None

    def handle_starttag(self, tag, attrs):
        if tag == "iframe" and self.srcdoc is None:
            for name, value in attrs:
                if name in ("data-srcdoc", "srcdoc") and value:
                    self.srcdoc = value


def inner_document(text):
    finder = SrcdocFinder()
    finder.feed(text)
    return finder.srcdoc or text


def fail(message):
    sys.exit(f"build_site.py: {message}")


# ---------------------------------------------------------------------------
# Changes to the design's script. Each one: (name, old, new). `old` must occur
# exactly once.
# ---------------------------------------------------------------------------

ICON_ADDITIONS = """      // Added icons. The sparkle icon is kept for the AI helpers only.
      Object.assign(ICONS, {
        bot: '<rect x="4" y="8" width="16" height="12" rx="2"/><path d="M12 8V4H8"/><path d="M2 14h2M20 14h2M9 13v2M15 13v2"/>',
        download: '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/>'
      });
"""

BASE_RUBRIC = """      function rubricCriteria() {
        // Five distinct criteria (35/25/15/15/10), so no skill is scored twice.
        const capability = labels.outcome[state.outcome];
        const evidence = labels.evidenceType[state.evidenceType];
        const level = resolvedAIAS();
        const aiLevel = labels.aiasLevel[level];
        const independent = level === 'one' || state.aiRole === 'none';
        // When AI use is itself assessed, verification of AI output has its own criterion,
        // so this one keeps to the rules, disclosure, and ownership.
        const accountability = independent ? {
          name: 'Independent demonstration and verification',
          descriptions: [
            'Performs the capability fully on their own under the stated conditions and answers follow-up questions fluently, confirming the work is theirs.',
            'Performs the capability on their own and answers follow-up questions accurately, confirming ownership.',
            'Independent performance or answers to follow-up questions only partly confirm ownership and understanding.',
            'Cannot reproduce, explain, or defend the consequential parts of the work independently.'
          ]
        } : state.aiAssessed === 'yes' ? {
          name: 'Responsible AI use and accountability',
          descriptions: [
            `Works consistently within ${aiLevel}, follows every AI-use rule, discloses use completely, and takes full responsibility for the final work.`,
            `Works within ${aiLevel}, follows the AI-use rules, and provides the required disclosure.`,
            'Disclosure or adherence to the AI-use rules is incomplete or inconsistent.',
            'AI use conflicts with the rules, or required disclosure is missing.'
          ]
        } : {
          name: 'Responsible AI use and accountability',
          descriptions: [
            `Works consistently within ${aiLevel}, verifies consequential AI output, documents use transparently, and owns the result.`,
            `Works within ${aiLevel}, verifies important AI output, and provides the required disclosure.`,
            'Disclosure, verification, or accountability is incomplete or inconsistent with the AI-use rules.',
            'AI use conflicts with the rules, relies on unverified output, or omits required disclosure.'
          ]
        };

        return [
          {
            name: 'Primary disciplinary capability', weight: 35,
            descriptions: [
              `Demonstrates ${capability} with accuracy, depth, and insight, and transfers it to complexity or ambiguity.`,
              `Demonstrates ${capability} accurately in the assigned context using appropriate disciplinary knowledge.`,
              `Demonstrates parts of ${capability}, but accuracy, depth, or transfer is inconsistent.`,
              `Provides insufficient evidence of ${capability} or relies on unsupported conclusions and procedures.`
            ]
          },
          {
            name: 'Use of evidence', weight: 25,
            descriptions: [
              'Selects highly relevant, credible evidence, evaluates its quality and limitations, and weighs alternatives.',
              'Uses relevant, credible evidence and addresses important limitations.',
              'Uses some evidence, but quality, verification, or consideration of alternatives is uneven.',
              'Uses weak, inaccurate, unverified, or insufficient evidence.'
            ]
          },
          {
            name: 'Decision rationale and process', weight: 15,
            descriptions: [
              'Explains consequential decisions and revisions precisely, showing how feedback and evidence changed the work.',
              'Explains key decisions and revisions and links them to evidence or feedback.',
              'Explains some decisions, but the rationale or record of revision is thin.',
              'Does not explain decisions or show how the work developed.'
            ]
          },
          {
            name: `Quality of ${evidence}`, weight: 15,
            descriptions: [
              `The ${evidence} is complete, purposeful, and unusually effective for its audience.`,
              `The ${evidence} is complete, clear, and fit for purpose.`,
              `The ${evidence} is incomplete or difficult to interpret in places.`,
              `The ${evidence} is missing, unusable, or off-task.`
            ]
          },
          { ...accountability, weight: 10 }
        ];
      }

"""

# The design's own version of the base rubric, for the check below.
DESIGN_RUBRIC_SHA256 = "b78ae604712744d28e2a35bf8785acee6b0eced6206ea96c66217286ad71b3a8"

SAVE_OLD = """      function save() {
        if (window.openai?.setWidgetState) {
          window.openai.setWidgetState({
            modelContent: { validAISelection: compactModelState() },
            privateContent: { validAIState: state }
          }).catch(() => {});
        }
      }"""

SAVE_NEW = """      // Saved in this browser. (The design file saved through its preview host instead.)
      const STORAGE_KEY = 'valid-ai-designer-v3';
      const LEGACY_STORAGE_KEY = 'valid-ai-designer-state-v2';
      function save() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { /* storage full or blocked */ }
      }"""

LOAD_OLD = "      applySaved(window.openai?.widgetState);\n"

LOAD_NEW = """      {
        let saved = null;
        try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (error) { saved = null; }
        if (!saved || typeof saved !== 'object') {
          // Answers saved by the previous version of the site carry over; its AI output doesn't.
          try { saved = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || 'null'); } catch (error) { saved = null; }
          if (saved && typeof saved === 'object') {
            ['ai', 'aiCleared', 'aiRubricHidden'].forEach(key => { delete saved[key]; });
            saved.started = saved.view === 'workflow' || saved.view === 'results';
          }
        }
        applySaved({ privateContent: { validAIState: saved } });
        Object.entries(short).forEach(([field, options]) => {
          if (!Object.hasOwn(options, state[field])) state[field] = defaultState[field];
        });
        // Fresh objects, so edits never write into defaultState.
        state.rubricEdits = state.rubricEdits && typeof state.rubricEdits === 'object' && !Array.isArray(state.rubricEdits) ? { ...state.rubricEdits } : {};
        state.touchedFields = Array.isArray(state.touchedFields) ? [...state.touchedFields] : [];
        state.refined = Array.isArray(state.refined) ? [...state.refined] : [];
        if (typeof state.tiltEdited !== 'string') state.tiltEdited = '';
        window.addEventListener('pagehide', () => { clearTimeout(saveTimer); save(); });
      }
"""

BRIDGE = """      /* ---------- Bridge for site.js and ai.js (added by tools/build_site.py) ---------- */
      window.validApp = {
        root,
        get state() { return state; },
        labels, short, contextLabels, starterApproaches, steps, aiasDescriptions,
        resolvedAIAS: () => resolvedAIAS(),
        rubricCriteria: () => rubricCriteria(),
        rubricCriteriaDraft: () => rubricCriteriaDraft(),
        wording: field => wording(field),
        rankedPatterns: () => patterns.map(pattern => ({ pattern, score: scorePattern(pattern) })).sort((a, b) => b.score - a.score).slice(0, 3),
        validRole: () => validRoles[suggestedValidRole()],
        aiRules,
        tiltAsText: node => tiltAsText(node),
        refreshRubric: () => { renderRubric(); renderRubricDependents(); },
        scheduleSave: () => scheduleSave(),
        saveNow: () => { clearTimeout(saveTimer); save(); }
      };
      renderFromState();
      document.dispatchEvent(new CustomEvent('valid-app-ready'));
    })();"""

START_OVER_OLD = """      root.querySelector('#valid-change-start').addEventListener('click', showStarter);
      root.querySelector('#valid-restart').addEventListener('click', showStarter);"""

START_OVER_NEW = """      // Start over goes back to the five questions and keeps those answers, but clears the plan
      // built from them. (The design kept everything, so template and rubric edits from the old
      // plan showed up in the new one.)
      function startOver() {
        const edited = Boolean(state.tiltEdited) || Object.keys(state.rubricEdits || {}).length > 0 || state.touchedFields.length > 0;
        if (edited && !window.confirm('Start over from the five questions? Your answers to them stay. The template, the rubric, and any other changes you made to the plan will be cleared.')) return;
        const keep = {};
        ['context', 'outcome', 'purposeType', 'delivery', 'independent', 'assignmentText'].forEach(key => { if (key in state) keep[key] = state[key]; });
        state = { ...defaultState, touchedFields: [], refined: [], rubricEdits: {}, ...keep, exampleContext: keep.context || defaultState.context };
        openAdjust = '';
        exampleChoice = '';
        clearTimeout(saveTimer);
        save();
        root.dispatchEvent(new CustomEvent('valid:reset'));
        showStarter();
        window.scrollTo(0, 0);
        const heading = root.querySelector('#valid-start-heading');
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
      root.querySelector('#valid-change-start').addEventListener('click', startOver);
      root.querySelector('#valid-restart').addEventListener('click', startOver);"""

GLANCE_OLD = '''            <dd><span class="valid-glance-main">${esc(row.main)}</span><span class="valid-glance-sub" title="${esc(row.sub)}">${esc(row.sub)}</span></dd>
            <button class="btn" type="button" data-adjust="${row.key}" aria-expanded="${openAdjust === row.key}">${openAdjust === row.key ? 'Done' : 'Change'}</button>
            ${openAdjust === row.key ? `<div class="valid-adjust"><div class="valid-fields">${row.fields.map(field => select(field, fieldLabels[field], labels[field] || {}, 'valid-adjust-')).join('')}</div></div>` : ''}
          </div>`).join('');'''

GLANCE_NEW = '''            <dd><span class="valid-glance-text"><span class="valid-glance-main">${esc(row.main)}</span><span class="valid-glance-sub" title="${esc(row.sub)}">${esc(row.sub)}</span></span>
            <button class="btn" type="button" data-adjust="${row.key}" aria-expanded="${openAdjust === row.key}">${openAdjust === row.key ? 'Done' : 'Change'}<span class="sr-only"> ${esc(row.label)}</span></button>
            ${openAdjust === row.key ? `<div class="valid-adjust"><div class="valid-fields">${row.fields.map(field => select(field, fieldLabels[field], labels[field] || {}, 'valid-adjust-')).join('')}</div></div>` : ''}</dd>
          </div>`).join('');'''

STRIP_OLD = '''            <button class="valid-step-chip" type="button" data-strip-step="${index}" aria-describedby="valid-step-tip" aria-label="${esc(step.name)}: ${esc(step.question)} Open this step.">
              <span class="valid-step-tile">${esc(step.letter)}</span><span class="valid-step-label">${esc(step.name)}</span>'''

STRIP_NEW = '''            <button class="valid-step-chip" type="button" data-strip-step="${index}" aria-describedby="valid-step-tip">
              <span class="valid-step-tile" aria-hidden="true">${esc(step.letter)}</span><span class="valid-step-label">${esc(step.name)}</span>'''

PATCHES = [
    ("save to this browser", SAVE_OLD, SAVE_NEW),
    ("load from this browser", LOAD_OLD, LOAD_NEW),
    ("added icons", "      function icon(name, size = 18) {\n",
     ICON_ADDITIONS + "      function icon(name, size = 18) {\n"),
    ("AI involvement icon", "{ key: 'ai', icon: 'sparkles',", "{ key: 'ai', icon: 'bot',"),
    ("AI critique starts at AIAS 3", "aiRole: 'critique', aiasLevel: 'four',", "aiRole: 'critique', aiasLevel: 'three',"),
    ("AI critique recommends AIAS 3",
     "        if (state.aiRole === 'critique') return 'four';",
     "        // Students evaluate and correct AI output, so AI is material, not a co-author: AIAS 3.\n"
     "        if (state.aiRole === 'critique') return 'three';"),
    ("more AIAS alignment checks",
     "        if (level !== 'one' && state.aiRole === 'none') return 'Check alignment: the selected AIAS level expects an AI role, but the assessment currently excludes AI.';\n",
     "        if (level !== 'one' && state.aiRole === 'none') return 'Check alignment: the selected AIAS level expects an AI role, but the assessment currently excludes AI.';\n"
     "        if (level === 'two' && ['critique', 'collaborator'].includes(state.aiRole)) return 'Check alignment: AIAS 2 limits AI to planning, but the selected AI role uses AI beyond planning.';\n"
     "        if (['four', 'five'].includes(level) && state.aiRole === 'support') return 'Check alignment: this level expects substantial AI involvement, but the selected role permits only limited support.';\n"),
    ("weights when AI use is assessed",
     "        const weights = [25, 20, 20, 10, 10];",
     "        const weights = [30, 20, 10, 15, 10]; // plus 15 for the AI criterion: 100"),
    ("template: why these AI rules",
     "            <em>Not permitted</em> — ${esc(rules.prohibited.map(item => item.replace(/\\.$/, '')).join('; '))}.</p>\n",
     "            <em>Not permitted</em> — ${esc(rules.prohibited.map(item => item.replace(/\\.$/, '')).join('; '))}.</p>\n"
     "          <p><strong>Why these rules:</strong> ${ph('one sentence on why AI is limited or required here')}</p>\n"),
    ("rubric rendered event",
     "        if (reset) reset.addEventListener('click', () => { state.rubricEdits = {}; renderRubric(); renderRubricDependents(); scheduleSave(); });\n      }\n",
     "        if (reset) reset.addEventListener('click', () => { state.rubricEdits = {}; renderRubric(); renderRubricDependents(); scheduleSave(); });\n"
     "        root.dispatchEvent(new CustomEvent('valid:rubric-rendered'));\n      }\n"),
    ("ask before replacing typed text with an example",
     "            if (!target || !example) return;\n            state[field] = example;\n",
     "            if (!target || !example) return;\n"
     "            if (target.value.trim() && target.value.trim() !== example && !window.confirm('Replace what you wrote with the suggested wording?')) return;\n"
     "            state[field] = example;\n"),
    ("start over clears the old plan", START_OVER_OLD, START_OVER_NEW),
    # Accessibility: valid list markup in the plan summary (the Change button and panel
    # move inside the <dd>; site.css keeps the layout), and Change buttons say what they change.
    ("plan summary list markup", GLANCE_OLD, GLANCE_NEW),
    # Accessibility: a step chip's spoken name matches its visible name.
    ("step chip names", STRIP_OLD, STRIP_NEW),
]

HOST_LISTENER = re.compile(r"      window\.addEventListener\('openai:set_globals', event => \{\n.*?\n      \}\);\n", re.S)
BASE_RUBRIC_SLICE = re.compile(r"      function rubricCriteria\(\) \{\n.*?\n      \}\n\n(?=      function safeguards\(\) \{)", re.S)


def patch_script(js):
    warnings = []
    for name, old, new in PATCHES:
        count = js.count(old)
        if count != 1:
            fail(f'change "{name}" expected to find its code once, but found it {count} times. '
                 "The design changed there; update this change in tools/build_site.py.")
        js = js.replace(old, new)

    js, n = HOST_LISTENER.subn("", js)
    if n != 1:
        fail('change "stop listening to the preview host" did not find the host listener.')

    match = BASE_RUBRIC_SLICE.search(js)
    if not match:
        fail('change "five distinct rubric criteria" did not find the base rubricCriteria() function.')
    digest = hashlib.sha256(match.group(0).encode()).hexdigest()
    if DESIGN_RUBRIC_SHA256 not in ("SET_BY_FIRST_RUN", digest):
        warnings.append("The design changed its base rubric. It was replaced with the five-criteria version; "
                        "check that nothing new in the design's rubric was lost.")
    js = js[:match.start()] + BASE_RUBRIC + js[match.end():]

    tail = "      renderFromState();\n    })();"
    if js.count(tail) != 1:
        fail('change "bridge for site.js and ai.js" did not find the end of the script.')
    js = js.replace(tail, BRIDGE)

    if "window.openai" in js:
        fail("the script still refers to window.openai; a host feature was added that needs a change here.")
    return js, warnings, digest


def patch_markup(markup):
    old = '<span data-icon="sparkles"></span>Build my plan'
    if markup.count(old) != 1:
        fail('change "Build my plan icon" did not find the button.')
    markup = markup.replace(old, 'Build my plan<span data-icon="arrow"></span>')

    # A main landmark around the three views. The drawer moves outside it at runtime.
    if markup.count("</header>") != 1:
        fail('change "main landmark" did not find the header.')
    markup = markup.replace("</header>", "</header>\n\n  <main id=\"valid-main\">\n  <noscript><p class=\"card\">This tool needs JavaScript. "
                                          "Turn it on in your browser to design an assessment.</p></noscript>", 1)
    body = markup.rstrip()
    if not body.endswith("</div>"):
        fail('change "main landmark" expected the markup to end with the column\'s </div>.')
    markup = body[:-len("</div>")].rstrip() + "\n  </main>\n  </div>\n"
    # Accessibility: the Guide button's spoken name starts with its visible text.
    old = 'data-open="guide" aria-label="How to use this tool"'
    if markup.count(old) != 1:
        fail('change "Guide button name" did not find the button.')
    markup = markup.replace(old, 'data-open="guide" aria-label="Guide: how to use this tool"')
    if "sparkles" in markup:
        fail("the markup has another sparkle icon; the sparkle is kept for the AI helpers only.")
    return markup


FAVICON = ("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E"
           "%3Crect width='32' height='32' rx='4' fill='%23990000'/%3E"
           "%3Ccircle cx='16' cy='16' r='10.5' fill='none' stroke='white' stroke-width='2.6'/%3E"
           "%3Ccircle cx='16' cy='16' r='4.8' fill='none' stroke='white' stroke-width='2.6'/%3E%3C/svg%3E")

PAGE = """<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>VALID-AI Assessment Designer</title>
<meta name="description" content="Design assessments that still show what students can do when AI is available, with the VALID-AI framework and the AI Assessment Scale.">
<meta name="color-scheme" content="light">
<meta name="referrer" content="no-referrer">
<link rel="icon" href="{favicon}">
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="styles.css">
<link rel="stylesheet" href="site.css">
<!-- Generated by tools/build_site.py from the design file. Edit site.css, site.js, and ai.js, not this file. -->
<script src="app.js" defer></script>
<script src="site.js" defer></script>
<script type="module" src="ai.js"></script>
</head>
<body>
<div id="valid-ai-designer">
{markup}</div>
</body>
</html>
"""


def main():
    if len(sys.argv) < 2:
        fail("usage: python3 tools/build_site.py <design.html> [site_folder]")
    source = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parent.parent
    doc = inner_document(source.read_text(encoding="utf-8"))

    head = re.search(r"<head>(.*?)</head>", doc, re.S)
    base_css = re.search(r"<style[^>]*>(.*?)</style>", head.group(1), re.S) if head else None
    app = re.search(r'<div id="valid-ai-designer">\s*<style[^>]*>(.*?)</style>(.*?)<script>(.*?)</script>\s*</div>', doc, re.S)
    if not base_css or not app:
        fail("couldn't find the design's base styles, app styles, markup, and script.")
    design_css, markup, script = app.group(1), app.group(2), app.group(3)

    script, warnings, digest = patch_script(script)
    markup = patch_markup(markup)

    out.mkdir(parents=True, exist_ok=True)
    (out / "base.css").write_text(base_css.group(1).strip() + "\n", encoding="utf-8")
    (out / "styles.css").write_text(design_css.strip("\n") + "\n", encoding="utf-8")
    header = ("// Generated by tools/build_site.py from the design file, with the changes listed there.\n"
              "// To change the design, update the design file and run the script again.\n")
    (out / "app.js").write_text(header + script.strip("\n") + "\n", encoding="utf-8")
    (out / "index.html").write_text(PAGE.replace("{favicon}", FAVICON).replace("{markup}", markup), encoding="utf-8")

    # The PATCHES list, plus the host listener, the base rubric, and the bridge; and three page changes.
    print(f"Built {out} from {source.name}: {len(PATCHES) + 3} script changes and 3 page changes applied.")
    print(f"Design rubric fingerprint: {digest}")
    for warning in warnings:
        print(f"Warning: {warning}")


if __name__ == "__main__":
    main()

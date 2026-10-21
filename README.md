# VALID-AI Assessment Designer

A static web app for designing assessments that still show what students can do when AI is available. It uses the VALID-AI framework (Verify, Articulate, Locate, Inspect, Design, Assign, Implement) and the AI Assessment Scale (AIAS 2.1).

This version uses the IU design from the design file. It adds back the fixes from the previous build, a Canvas rubric export, and three optional AI helpers that run on the instructor's own computer.

## Files

| File | What it is | Edit it? |
|---|---|---|
| `index.html` | The page | No, it's generated |
| `base.css` | The design file's base styles | No, it's generated |
| `styles.css` | The design file's own styles | No, it's generated |
| `app.js` | The design file's script, with the changes listed below | No, it's generated |
| `site.css` | Styles for everything this site adds | Yes |
| `site.js` | Canvas export, links in new tabs, keyboard focus in drawers | Yes |
| `ai.js` | The three AI helpers, the Local AI chip, and its settings | Yes |
| `tasks.js` | The AI prompts, their JSON schemas, and the checks on each answer | Yes |
| `llm.js` | Device checks and the two AI engines (in-browser WebLLM and Ollama) | Yes |
| `webllm.js` | Pins the WebLLM version (0.2.86) | Only to upgrade WebLLM |
| `worker.js` | Runs the in-browser model off the main thread | No |
| `tools/build_site.py` | Builds the four generated files from a design file | When the design changes |

There's nothing to install and no build step for the site itself. The script in `tools` only runs when a new design file comes in.

## Deploy to GitHub Pages

1. Upload every file above to the root of the repository, with `tools/build_site.py` in a `tools` folder, replacing the files that are already there.
2. Delete `data.js`. This version doesn't use it.
3. In **Settings → Pages**, the source should be **Deploy from a branch**, branch `main`, folder `/ (root)`. If the site is already published, nothing changes here.
4. Give it a minute, then hard-refresh the site (Shift+Reload).

The AI code uses ES modules, which don't run from `file://`. To try the site on your own computer, run `python3 -m http.server` in the folder and open `http://localhost:8000`.

Answers saved by the previous version of the site still load, and so do the AI model choice and downloaded models. The previous version's AI sections don't carry over.

## Bringing in a new design file

When your coworker sends a new version of the design file, run this from the site folder:

```
python3 tools/build_site.py path/to/new-design.html
```

It rewrites `index.html`, `base.css`, `styles.css`, and `app.js`, and leaves everything else alone. It works with the file as exported from the design tool (the preview wrapper) or with a plain HTML file.

Each change looks for an exact piece of the design's code. If the new design changed one of those pieces, the script stops, names the change, and writes nothing, so the site is never patched halfway. Then that change needs updating to match the new code. If the design changes its base rubric, the script still replaces it with the five-criteria version and prints a warning, so you can check whether anything new was lost.

## Changes from the design file

These apply on every build:

- **Rubric.** Five distinct criteria at 35/25/15/15/10: primary disciplinary capability, use of evidence, decision rationale and process, quality of the evidence, and either independent demonstration or responsible AI use. The design had three overlapping reasoning criteria worth 80% between them. When AI use is itself assessed, the weights become 30/20/10/15/10 plus 15 for the AI criterion, and the accountability criterion stops repeating the AI criterion's verification.
- **AIAS.** AI critique maps to AIAS 3, not AIAS 4: students evaluate and correct the AI's output, and the critique itself has to be theirs. The AIAS card also flags AIAS 2 with a critique or collaborator role, and AIAS 4 or 5 with only limited support.
- **Saving.** Answers are saved in the browser. The design saved through its preview host, which doesn't exist on GitHub Pages.
- **Start over** goes back to the five questions and keeps those answers, but clears the template, the rubric, and other changes to the plan, after asking. The design kept everything, so template and rubric edits from the old plan showed up in the new one.
- **Inserting a suggestion** over text you typed asks first.
- **Links** to sources open in a new tab, so the tool stays open.
- **The template** gains a "Why these rules" line, a blank for one sentence telling students why AI is limited or required. The design's guide recommends exactly that.
- **The sparkle icon** is kept for AI features. "Build my plan" now has an arrow, and the "AI involvement" row has a robot icon.
- **Accessibility.** A main landmark; valid list markup in the plan summary; the step chips' and Guide button's spoken names match what's on screen; Change buttons say what they change; Tab stays inside an open drawer. All screens pass an automated WCAG check (axe-core).
- **Phones.** The results header's buttons wrap instead of running off the screen.

The design is light only, so the page stays light when a computer uses dark mode.

## Export the rubric to Canvas

The **Draft rubric** drawer ends with **Export to Canvas**. Set a rubric name and total points (default 100), then select **Download Canvas CSV**. Points follow the criterion weights and split 4-3-2-1 across Exemplary, Proficient, Developing, and Beginning. The file includes your edits and any AI wording. If the weights don't add up to 100%, the export says so.

The format follows Canvas's own rubric importer (`lib/rubric_csv_importer.rb` in canvas-lms): one row per criterion, grouped by `Rubric Name`, with repeating `Rating Name` / `Rating Description` / `Rating Points` columns. The file has no byte-order mark, because one would break the `Rubric Name` header.

To import it: in the course, open **Rubrics** and select **Import Rubric**, then upload the file. Imported rubrics arrive as drafts, so open the rubric and select **Save Rubric**. The file can't set the rating order or scoring options; set those in Canvas. Then attach the rubric to the assignment with **Find Rubric**. Holistic, checklist, and specifications layouts export as the analytic grid, since that's what Canvas rubrics are.

This is the rubric import. The Canvas article on importing rubric *assessments* covers uploading students' scores, which is a different file.

## The local AI helpers

Three optional helpers, each in the place you'd already be working:

1. **Start from your current assignment** (start screen). Paste the assignment you give students now and select **Suggest answers from this**. The AI suggests answers to the five questions, and each suggestion shows the words from your text that support it. An answer is only filled in if those words really appear in your text; otherwise the question says your text doesn't make it clear. The pasted text also gives the other two helpers background about your course.
2. **Draft the blanks** (Assignment template). Fills the title, the purpose, the task, each stage, the "Why these rules" line, and the course outcome if your pasted text states one. Each stage gets a `[due date]` blank for you. The AI-use statement blanks are left for students.
3. **Tailor to my course** (Draft rubric). Rewrites the four descriptors of each criterion for your assignment. Criterion names and weights never change, and cells you've edited are left alone.

How they behave:

- Nothing runs until you click. On a device that can't run a model, the helpers don't appear.
- AI text is marked with a blue underline and an "AI" tag until you edit it. The tag isn't copied or exported.
- AI text never replaces your own edits.
- **Undo** removes the AI text you haven't edited. If you hadn't changed anything else, the template goes back to following your plan.
- **Stop** cancels a run and changes nothing.
- If your plan changes after tailoring the rubric, the rubric's note says so.
- Every answer is forced into a JSON schema, so it always fits the page. The AI never sets the rubric's criteria or weights, the AIAS level, the recommended approach, or the research.

### The Local AI chip

The chip at the top of the page shows what's available ("off", the model's name, loading, working) and opens the settings: which model to use, the pasted assignment text, connecting Ollama, and a switch to hide the helpers on that device.

### In-browser models

The default runs in the browser with WebLLM, which needs WebGPU (current Chrome and Edge on most recent computers). The first run asks before downloading the model, once; after that it loads from the browser's storage.

| Model | Download | Graphics memory | Notes |
|---|---|---|---|
| Qwen3 4B | about 2.3 GB | about 3.4 GB | Best quality; recommended on capable laptops |
| Qwen2.5 3B | about 1.7 GB | about 2.5 GB | Balanced |
| Qwen3 1.7B | about 1 GB | about 2.0 GB | Lighter |
| Llama 3.2 1B | about 0.7 GB | about 0.9 GB | Smallest; lowest quality |

Download sizes are estimates. These figures are for GPUs that support 16-bit math; others get the 32-bit versions, which need a little more. In-browser models read about the first 6,000 characters of pasted text for suggestions, and less when drafting; the helper says when it read only part. To change the list, edit `BROWSER_MODELS` in `llm.js`. To upgrade WebLLM, change the version in `webllm.js` and check that the model IDs still exist.

### Optional: connect Ollama for better quality

1. Install Ollama from https://ollama.com and pull a model, for example `ollama pull qwen3:8b` or `ollama pull gemma3:12b`.
2. Let the site reach it by setting `OLLAMA_ORIGINS` to the site's address:
   - **macOS:** run `launchctl setenv OLLAMA_ORIGINS "https://<your-username>.github.io"`, then quit and reopen Ollama.
   - **Windows:** add a user environment variable named `OLLAMA_ORIGINS` with that value, then restart Ollama.
   - **Linux (systemd):** add `Environment="OLLAMA_ORIGINS=https://<your-username>.github.io"` to the service override, then restart Ollama.
3. Open the Local AI chip and select **Connect to Ollama**. If Chrome asks to allow access to devices on your local network, allow it.

The page never contacts Ollama until someone selects Connect. After one successful connection, it reconnects automatically on later visits. This works in Chrome, Edge, and Firefox; Safari may block a secure site from reaching `localhost`.

### What leaves the computer

In-browser mode downloads the WebLLM library from `cdn.jsdelivr.net` and the model files from `huggingface.co`. Course details, pasted text, and answers are never sent anywhere; they're saved only in that browser.

## What was tested

The site was run in headless Chromium with 128 automated checks, plus a check of every AI schema with xgrammar (the grammar engine WebLLM uses):

- the design's flow: start screen, plan, plan tabs, Change panels, wizard, drawers, worked examples
- every fix above, including saving, reload, answers from the previous version, and Start over
- the Canvas export, also read by Canvas's own importer code
- accessibility scans (axe-core) on every screen, including the AI notes and the settings
- phone width and print
- the AI helpers against a stand-in Ollama server: suggestions and their quotes, an answer whose quote isn't in the text, drafting, editing and Undo, tailoring around your edits, the plan-changed note, Stop, a model that returns broken output, and the fallback for models that reject Ollama's "think" option
- the in-browser path against a stand-in WebLLM: the download question, progress, reusing the loaded model, switching models, Qwen3-only settings, and trimming long text
- the real WebLLM 0.2.86 library on emulated WebGPU. It loaded, started the worker, and requested the model from huggingface.co. The test environment blocks that download, and the page reported it clearly.

**Not yet tested:** real model output. The first live run on a real computer is still to come. If anything goes wrong, copy the message from the page or the browser console.

## Known limitations

- **Small models make mistakes.** Treat every AI suggestion as a draft.
- **The research examples are unverified.** The examples and links come from the design file unchanged. Check each citation before sharing the tool widely.
- **Canvas.** Embedding the page in a Canvas iframe may block WebGPU or model caching. Link to it instead.
- **Saved per browser.** Answers are saved in the browser's local storage and aren't shared between devices.

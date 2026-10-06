# VALID-AI Assessment Designer

A static web app for designing AI-aware assessments with the VALID-AI framework (Verify, Articulate, Locate, Inspect, Design, Assign, Implement) and the AI Assessment Scale (AIAS 2.1). It also offers optional personalization by a **local** LLM, so course details never leave the instructor's computer.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `styles.css` | Styling (light and dark mode, print) |
| `data.js` | All static content: guidance, starter approaches, patterns, research examples |
| `app.js` | Wizard, plan logic, rubric, persistence, AI panel |
| `llm.js` | Engine detection and adapters for WebLLM (in-browser) and Ollama |
| `tasks.js` | Prompts, JSON schemas, and validators for the three AI tasks |
| `worker.js` | Web Worker that runs WebLLM off the main thread |

There's no build step and no dependencies to install.

## Deploy to GitHub Pages

1. Create a repository, for example `valid-ai-designer`, and upload all seven files to the root.
2. Go to **Settings → Pages**. Under "Build and deployment", set the source to **Deploy from a branch**, the branch to `main`, and the folder to `/ (root)`.
3. After a minute the site is live at `https://<your-username>.github.io/valid-ai-designer/`.

ES modules don't run from `file://`. To test locally, serve the folder with `python3 -m http.server` and open `http://localhost:8000`.

## How the local AI works

After you build a plan, the **Personalize with local AI** panel checks what this device can run:

1. **Ollama.** If a local Ollama server is running, its models are listed first. This route gives the best quality.
2. **In-browser (WebLLM).** If the browser supports WebGPU (current Chrome or Edge on most laptops), the panel offers small models, recommending one based on the device. The first run downloads the model (about 0.5–3 GB), and the browser caches it for later visits.
3. **Neither.** The panel explains why, and the template-based plan still works fully.

The model does three jobs. Each uses a JSON schema so the output always fits the page:

- **Rubric descriptors.** It rewrites the four performance levels for each criterion around the instructor's own skills, product, and AI rules. Criterion names and weights stay fixed. "Show template version" reverts to the template descriptors.
- **Student AI-use instructions.** It drafts student-facing text (permitted uses, prohibited uses, required documentation, and the rationale), with a Copy button.
- **Alignment check.** It flags up to five contradictions between answers.

The model is never asked for research, citations, the AIAS level, or the pattern ranking. Those stay deterministic. If you change your answers, any personalized output is discarded when the plan is rebuilt, so stale AI text never appears.

### In-browser model tiers

The app offers whichever of these exist in WebLLM's prebuilt list, best first: Qwen3-4B, Qwen3-1.7B, Qwen2.5-3B, Llama-3.2-3B, Qwen3-0.6B, Qwen2.5-1.5B, Llama-3.2-1B. Adjust `BROWSER_FAMILIES` in `llm.js` to change this.

**Pin the WebLLM version.** `llm.js` and `worker.js` import `https://esm.run/@mlc-ai/web-llm` without a version. Once you've confirmed it works, change both URLs to a specific version (for example `@mlc-ai/web-llm@0.2.x`) so a future release can't break the site.

### Optional: connect Ollama for better quality

1. Install Ollama from https://ollama.com and pull a model, for example `ollama pull qwen3:8b` or `ollama pull gemma3:12b`.
2. Allow the site to reach it by setting `OLLAMA_ORIGINS`:
   - **macOS:** `launchctl setenv OLLAMA_ORIGINS "https://<your-username>.github.io"`, then restart Ollama.
   - **Windows:** add a user environment variable `OLLAMA_ORIGINS` with that value, then restart Ollama.
   - **Linux (systemd):** add `Environment="OLLAMA_ORIGINS=https://<your-username>.github.io"` to the service override, then restart Ollama.
3. Reload the page. Your Ollama models appear at the top of the model list.

Chrome may show a one-time prompt asking whether the site can access devices on your local network. Allow it.

## Known limitations

- **Not tested with real inference yet.** The code was checked for syntax and logic, but the first live run in a browser hasn't happened. Report any console errors and they can be fixed.
- **Small models make mistakes.** Treat AI output as a draft, especially the alignment check.
- **Canvas embedding.** Canvas iframes may block WebGPU or model caching. Link to the page rather than embedding it.
- **Research examples are unverified.** The 10 examples and their links are carried over unchanged from the original tool. Check each citation before sharing widely.
- **Answers are saved per browser** in `localStorage` and are not shared between devices.

## Changes from the original single-file version

- Fixed: text fields no longer lose focus while you type.
- Fixed: switching starting approaches keeps the fields you've edited, and inserting an example asks before replacing your text.
- Fixed: editing answers after building the plan shows an "Update plan" banner instead of leaving stale results.
- Fixed: the rubric no longer has three overlapping reasoning criteria. It now has five distinct criteria, weighted 35, 25, 15, 15, and 10.
- AI critique now maps to AIAS 3, and the alignment notes catch more mismatches.
- Built results are restored on reload.
- Steps in the progress list can be clicked to jump between them.
- Added proper dark mode, print/PDF output, and a Start over button.
- Removed unused tooltip and icon libraries.

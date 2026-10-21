// Site additions that don't need AI:
//   - the Canvas rubric export in the Draft rubric drawer
//   - links to sources open in a new tab, so the tool stays open
//   - while a drawer is open, the page behind it can't be reached with the keyboard
// Runs after app.js, which provides window.validApp.
(() => {
  const app = window.validApp;
  if (!app) return;
  const root = app.root;
  const $ = (selector) => root.querySelector(selector);

  const DOWNLOAD_ICON = '<svg class="valid-svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M5 21h14"/></svg>';

  /* ---------- Canvas rubric export ---------- */

  function clampPoints(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.min(1000, Math.round(n * 100) / 100) : 100;
  }

  const roundPoints = (n) => Math.round(n * 100) / 100;

  function defaultRubricName() {
    return `VALID-AI rubric: ${app.labels.evidenceType[app.state.evidenceType] || 'assessment'}`;
  }

  // Canvas reads the file as UTF-8; plain punctuation avoids odd characters in some imports.
  function plainText(value) {
    return String(value ?? '')
      .replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-').replace(/…/g, '...').replace(/·/g, '-')
      .replace(/→/g, '->').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
  }

  const csvCell = (value) => `"${plainText(value).replace(/"/g, '""')}"`;

  function rubricName() {
    return plainText(app.state.rubricName) || defaultRubricName();
  }

  // Format from Canvas's rubric importer (lib/rubric_csv_importer.rb in canvas-lms):
  // one row per criterion, grouped by "Rubric Name", then repeating
  // Rating Name / Rating Description / Rating Points columns. No byte-order mark:
  // it would become part of the first header and break "Rubric Name".
  function canvasRubricCSV() {
    const criteria = app.rubricCriteria();
    const total = clampPoints(app.state.rubricPoints);
    const name = rubricName();
    const levels = [['Exemplary', 1], ['Proficient', 0.75], ['Developing', 0.5], ['Beginning', 0.25]];
    const header = ['Rubric Name', 'Criteria Name', 'Criteria Description', 'Criteria Enable Range'];
    levels.forEach((_, i) => header.push(`Rating Name ${i + 1}`, `Rating Description ${i + 1}`, `Rating Points ${i + 1}`));
    const rows = criteria.map((criterion) => {
      const max = (Number(criterion.weight) || 0) * total / 100;
      const row = [name, criterion.name, `Weight: ${criterion.weight}% of the assessment.`, 'FALSE'];
      levels.forEach(([level, share], i) => row.push(level, criterion.descriptions[i], String(roundPoints(max * share))));
      return row;
    });
    return `${[header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
  }

  function downloadCanvasRubric() {
    const name = rubricName();
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'rubric';
    const file = `${slug}-canvas.csv`;
    const url = URL.createObjectURL(new Blob([canvasRubricCSV()], { type: 'text/csv;charset=utf-8' }));
    const link = Object.assign(document.createElement('a'), { href: url, download: file });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $('#valid-canvas-status').textContent = `Downloaded ${file}.`;
  }

  function updateCanvasNotes() {
    const name = $('#valid-canvas-name');
    if (!name) return;
    name.placeholder = defaultRubricName();
    const criteria = app.rubricCriteria();
    const total = clampPoints(app.state.rubricPoints);
    const weightSum = criteria.reduce((sum, item) => sum + (Number(item.weight) || 0), 0);
    const notes = [];
    if (weightSum !== 100) {
      notes.push(`The weights add up to ${weightSum}%, so this rubric would total ${roundPoints(weightSum * total / 100)} points instead of ${total}. Change the weights in the table so they add up to 100%.`);
    }
    if (app.state.grading !== 'analytic') {
      notes.push('Canvas rubrics are grids, so this exports as an analytic rubric with four levels for each criterion.');
    }
    const warn = $('#valid-canvas-warn');
    warn.textContent = notes.join(' ');
    warn.hidden = notes.length === 0;
    $('#valid-canvas-status').textContent = '';
  }

  function addCanvasExport() {
    const output = $('#valid-rubric-output');
    if (!output || $('#valid-canvas')) return;
    output.insertAdjacentHTML('afterend', `
      <section class="valid-canvas" id="valid-canvas" aria-labelledby="valid-canvas-title">
        <h3 id="valid-canvas-title"><span class="valid-canvas-icon">${DOWNLOAD_ICON}</span>Export to Canvas</h3>
        <p class="text-small text-muted">Download this rubric, with your edits, as a file you can import into a Canvas course.</p>
        <div class="valid-canvas-fields">
          <label class="form-label text-small" for="valid-canvas-name">Rubric name
            <input class="form-control" id="valid-canvas-name" type="text" maxlength="120" autocomplete="off">
          </label>
          <label class="form-label text-small" for="valid-canvas-points">Total points
            <input class="form-control" id="valid-canvas-points" type="number" min="1" max="1000" step="any" inputmode="decimal">
          </label>
          <button class="btn btn-primary" id="valid-canvas-download" type="button">${DOWNLOAD_ICON}Download Canvas CSV</button>
        </div>
        <p class="valid-canvas-warn text-small" id="valid-canvas-warn" hidden></p>
        <p class="valid-canvas-status text-small" id="valid-canvas-status" role="status"></p>
        <details class="valid-more valid-canvas-help text-small">
          <summary>How to import it into Canvas</summary>
          <ol>
            <li>In your course, open <strong>Rubrics</strong> and select <strong>Import Rubric</strong>.</li>
            <li>Upload the file. Canvas adds the rubric as a draft.</li>
            <li>Open the rubric, check it, and select <strong>Save Rubric</strong>.</li>
            <li>In the assignment, add it with <strong>Find Rubric</strong>.</li>
          </ol>
          <p>Points follow the weights and split 4-3-2-1 across Exemplary, Proficient, Developing, and Beginning. The file can't set the rating order or scoring options, so set those in Canvas.</p>
        </details>
      </section>`);

    const name = $('#valid-canvas-name');
    const points = $('#valid-canvas-points');
    name.value = app.state.rubricName || '';
    points.value = String(clampPoints(app.state.rubricPoints));
    name.addEventListener('input', () => {
      app.state.rubricName = name.value.slice(0, 120);
      $('#valid-canvas-status').textContent = '';
      app.scheduleSave();
    });
    points.addEventListener('change', () => {
      app.state.rubricPoints = clampPoints(points.value);
      points.value = String(app.state.rubricPoints);
      updateCanvasNotes();
      app.scheduleSave();
    });
    $('#valid-canvas-download').addEventListener('click', downloadCanvasRubric);
    updateCanvasNotes();
  }

  addCanvasExport();
  root.addEventListener('valid:rubric-rendered', updateCanvasNotes);
  root.addEventListener('valid:reset', () => {
    const name = $('#valid-canvas-name');
    if (name) name.value = '';
    const points = $('#valid-canvas-points');
    if (points) points.value = '100';
    updateCanvasNotes();
  });

  /* ---------- Links to sources open in a new tab ---------- */

  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
    if (!link || link.hasAttribute('download') || link.target) return;
    if (!/^https?:$/.test(link.protocol) || link.origin === window.location.origin) return;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }, true);

  /* ---------- Keep keyboard focus in the open drawer ---------- */

  // The drawer is a modal dialog, so Tab shouldn't reach the page behind it.
  // (A dialog opened from inside the drawer, like the AI settings, is allowed.)
  const drawer = $('#valid-drawer');
  if (drawer) {
    document.addEventListener('focusin', (event) => {
      if (drawer.hidden || drawer.contains(event.target)) return;
      if (event.target instanceof Element && event.target.closest('dialog[open]')) return;
      const panel = drawer.querySelector('.valid-drawer-panel');
      const focusable = [...panel.querySelectorAll('button, [href], input, select, textarea, summary, [contenteditable="true"], [tabindex]:not([tabindex="-1"])')]
        .filter((node) => !node.disabled && !node.closest('[hidden]') && node.getClientRects().length);
      // Tabbing forward out of the end wraps to the start, and backward wraps to the end.
      const leavingFromStart = event.relatedTarget === focusable[0];
      (leavingFromStart ? focusable[focusable.length - 1] : focusable[0])?.focus();
    });
  }


  /* ---------- Check an edited template against the current plan ---------- */

  // Once the template is edited, plan changes no longer update it. These checks point
  // out where the two have drifted apart. No AI: plain comparisons.
  const norm = (value) => String(value ?? '').toLowerCase().replace(/[‘’]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const LEVEL_NUMBER = { one: 1, two: 2, three: 3, four: 4, five: 5 };

  function planDifferences() {
    const tilt = $('#valid-tilt');
    if (!tilt || !app.state.tiltEdited) return [];
    const text = tilt.innerText;
    const flat = norm(text);
    const found = [];

    const level = app.resolvedAIAS();
    const mentioned = [...text.matchAll(/AIAS\s*([1-5])/g)].map((m) => Number(m[1]));
    if (mentioned.length && !mentioned.includes(LEVEL_NUMBER[level])) {
      found.push(`The template says AIAS ${mentioned[0]}, but the plan is now ${app.labels.aiasLevel[level]}.`);
    }

    const planStages = app.wording('stages').replace(/\(.*?\)/g, '').split('→').map((stage) => stage.trim()).filter(Boolean).map(cap);
    const sheetStages = [...tilt.querySelectorAll('ol > li > strong:first-child')].map((node) => node.textContent.replace(/[.:]\s*$/, '').trim());
    if (sheetStages.length) {
      const missing = planStages.filter((stage) => !sheetStages.some((s) => norm(s) === norm(stage)));
      const extra = sheetStages.filter((stage) => !planStages.some((s) => norm(s) === norm(stage)));
      if (missing.length) found.push(`The plan has stages the template doesn't: ${missing.join(', ')}.`);
      if (extra.length) found.push(`The template has stages that aren't in the plan: ${extra.join(', ')}.`);
    }

    const rules = app.aiRules[app.state.aiRole];
    if (rules) {
      const items = [...rules.permitted, ...rules.prohibited, rules.required].filter(Boolean);
      const absent = items.filter((item) => !flat.includes(norm(item)));
      if (absent.length > items.length / 2) {
        found.push(`The template's AI rules don't match the plan's AI role (${app.short.aiRole[app.state.aiRole]}). The plan's rules include: ${absent.slice(0, 3).map((item) => item.replace(/\.$/, '')).join('; ')}.`);
      }
    }

    const statement = /AI-use statement/i.test(text);
    if (app.state.aiRole === 'none' && /AI-use statement \(required\)/i.test(text)) {
      found.push('The template asks for an AI-use statement, but the plan now excludes AI from the assessed work.');
    } else if (app.state.aiRole !== 'none' && !statement) {
      found.push('The plan uses AI, but the template no longer asks students for an AI-use statement.');
    }
    return found;
  }

  let dismissedFor = '';

  function syncPlanCheck() {
    const tilt = $('#valid-tilt');
    if (!tilt) return;
    let note = $('#valid-plan-check');
    if (!note) {
      note = document.createElement('div');
      note.className = 'valid-plan-check';
      note.id = 'valid-plan-check';
      note.setAttribute('role', 'region');
      note.setAttribute('aria-label', 'Differences from your plan');
      note.hidden = true;
      tilt.before(note);
    }
    const found = planDifferences();
    const key = found.join('|');
    if (!found.length || key === dismissedFor) { note.hidden = true; return; }
    note.innerHTML = `<p><strong>Your template differs from your current plan in ${found.length} place${found.length === 1 ? '' : 's'}.</strong> Plan changes don't update an edited template. Edit these by hand, or use Reset to rebuild the template from the plan.</p>
      <ul>${found.map((item) => `<li>${item.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</li>`).join('')}</ul>
      <button class="btn btn-ghost" type="button">Dismiss</button>`;
    note.querySelector('button').addEventListener('click', () => { dismissedFor = key; note.hidden = true; });
    note.hidden = false;
  }

  const tiltNode = $('#valid-tilt');
  if (tiltNode && drawer) {
    let timer = 0;
    const later = () => { clearTimeout(timer); timer = setTimeout(syncPlanCheck, 400); };
    tiltNode.addEventListener('input', later);
    new MutationObserver(() => { if (!drawer.hidden) syncPlanCheck(); }).observe(drawer, { attributes: true, attributeFilter: ['hidden'] });
    root.addEventListener('valid:rubric-rendered', later);
    root.addEventListener('valid:reset', () => { dismissedFor = ''; later(); });
  }

  window.validSite = { canvasRubricCSV, planDifferences };
})();

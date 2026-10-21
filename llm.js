// Local LLM layer: in-browser (WebLLM on WebGPU) or a local Ollama server.
// Both engines expose the same interface:
//   { kind, id, label, generate(messages, schema, { maxTokens, signal, onProgress }) -> parsed JSON, dispose() }

const OLLAMA_URL = "http://localhost:11434";
const loadWebLLM = () => import("./webllm.js");

// In-browser models, best first. IDs and GPU memory figures come from WebLLM 0.2.86
// (the version pinned in webllm.js). Each has a 4,096-token context window.
// Download sizes are estimates from the parameter count at 4-bit quantization.
const BROWSER_MODELS = [
  { family: "Qwen3-4B", label: "Qwen3 4B", note: "best quality", vram: { f16: 3432, f32: 4328 }, downloadGB: { f16: 2.3, f32: 2.5 } },
  { family: "Qwen2.5-3B-Instruct", label: "Qwen2.5 3B", note: "balanced", vram: { f16: 2505, f32: 2894 }, downloadGB: { f16: 1.7, f32: 1.9 } },
  { family: "Qwen3-1.7B", label: "Qwen3 1.7B", note: "lighter", vram: { f16: 2037, f32: 2635 }, downloadGB: { f16: 1, f32: 1.1 } },
  { family: "Llama-3.2-1B-Instruct", label: "Llama 3.2 1B", note: "smallest", vram: { f16: 879, f32: 1129 }, downloadGB: { f16: 0.7, f32: 0.8 } }
];

// Ollama model families, best first for this kind of structured writing task.
const OLLAMA_PREFERENCE = ["qwen3", "gemma3", "qwen2.5", "llama3.1", "llama3.2", "mistral", "phi4"];

/* ---------- Detection ---------- */

export async function detectWebGPU() {
  if (!("gpu" in navigator)) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    return {
      f16: adapter.features.has("shader-f16"),
      maxBuffer: Number(adapter.limits.maxBufferSize) || 0,
      memoryGB: navigator.deviceMemory ?? null
    };
  } catch {
    return null;
  }
}

export function browserModels(gpu) {
  const quant = gpu.f16 ? "q4f16_1-MLC" : "q4f32_1-MLC";
  const key = gpu.f16 ? "f16" : "f32";
  return BROWSER_MODELS.map((m) => ({
    kind: "browser",
    id: `${m.family}-${quant}`,
    label: m.label,
    note: m.note,
    vramMB: m.vram[key],
    downloadGB: m.downloadGB[key]
  }));
}

// WebGPU does not report total GPU memory, so this is a heuristic from the
// buffer limit and (in Chromium) the coarse device-memory hint.
export function recommendBrowserModel(models, gpu) {
  if (!models.length) return null;
  const mem = gpu.memoryGB ?? 4;
  let budgetMB = 1500;
  if (mem >= 8 && gpu.maxBuffer >= 2 ** 30) budgetMB = 4500;
  else if (mem >= 4) budgetMB = 2700;
  return models.find((m) => m.vramMB <= budgetMB) ?? models[models.length - 1];
}

function paramsInBillions(size) {
  const match = /([\d.]+)\s*([BM])/i.exec(size || "");
  if (!match) return 8;
  const value = parseFloat(match[1]);
  return match[2].toUpperCase() === "M" ? value / 1000 : value;
}

// Only call this after the person asks to connect: Chrome may ask them to
// allow access to devices on the local network the first time.
export async function detectOllama(timeoutMs = 2500) {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return { reachable: false, models: [] };
    const data = await res.json();
    const rank = (name) => {
      const i = OLLAMA_PREFERENCE.findIndex((prefix) => name.startsWith(prefix));
      return i === -1 ? OLLAMA_PREFERENCE.length : i;
    };
    const models = (data.models ?? [])
      .filter((m) => typeof m.name === "string")
      .filter((m) => !/embed|bge|minilm|rerank/i.test(m.name) && !/bert/i.test(m.details?.family ?? ""))
      .map((m) => ({ kind: "ollama", id: m.name, label: m.name, size: m.details?.parameter_size ?? "" }))
      .sort((a, b) => rank(a.id) - rank(b.id)
        || Math.abs(paramsInBillions(a.size) - 8) - Math.abs(paramsInBillions(b.size) - 8));
    return { reachable: true, models };
  } catch {
    return { reachable: false, models: [] };
  }
}

/* ---------- Output parsing ---------- */

export function parseJSON(text) {
  const cleaned = String(text).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("The model did not return JSON.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function abortError() {
  return new DOMException("Stopped", "AbortError");
}

export function isAbort(err) {
  return err?.name === "AbortError";
}

/* ---------- Engines ---------- */

export async function createBrowserEngine(model, { onLoadProgress, signal } = {}) {
  const webllm = await loadWebLLM();
  if (signal?.aborted) throw abortError();
  const known = webllm.prebuiltAppConfig?.model_list?.some((m) => m.model_id === model.id);
  if (!known) throw new Error(`This version of WebLLM doesn't include ${model.label}. Pick another model.`);

  const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  // Stopping during the download ends the worker; finished parts stay cached.
  const loading = webllm.CreateWebWorkerMLCEngine(worker, model.id, {
    initProgressCallback: (report) => onLoadProgress?.(report.progress ?? 0, report.text ?? "")
  });
  let engine;
  try {
    engine = await new Promise((resolve, reject) => {
      const stop = () => { worker.terminate(); reject(abortError()); };
      signal?.addEventListener("abort", stop, { once: true });
      loading.then(resolve, reject).finally(() => signal?.removeEventListener("abort", stop));
    });
  } catch (err) {
    worker.terminate();
    throw err;
  }

  const isQwen3 = model.id.startsWith("Qwen3");
  return {
    kind: "browser",
    id: model.id,
    label: model.label,
    async generate(messages, schema, { maxTokens = 1200, signal: runSignal, onProgress } = {}) {
      const request = {
        messages,
        stream: true,
        temperature: 0.3,
        max_tokens: maxTokens,
        response_format: { type: "json_object", schema: JSON.stringify(schema) }
      };
      // Turns off Qwen3's "thinking" pass. WebLLM applies it to any model, so only send it to Qwen3.
      if (isQwen3) request.extra_body = { enable_thinking: false };

      const interrupt = () => engine.interruptGenerate();
      runSignal?.addEventListener("abort", interrupt, { once: true });
      try {
        const stream = await engine.chat.completions.create(request);
        let out = "";
        let finish = null;
        for await (const chunk of stream) {
          const choice = chunk.choices?.[0];
          out += choice?.delta?.content ?? "";
          if (choice?.finish_reason) finish = choice.finish_reason;
          onProgress?.(out.length);
        }
        if (runSignal?.aborted) throw abortError();
        try {
          return parseJSON(out);
        } catch (err) {
          if (finish === "length") throw new Error("The model ran out of room before it finished. Try again, or shorten your longest answers.");
          throw err;
        }
      } finally {
        runSignal?.removeEventListener("abort", interrupt);
      }
    },
    async dispose() {
      try { await engine.unload(); } catch { /* already gone */ }
      worker.terminate();
    }
  };
}

export function createOllamaEngine(model) {
  const post = (body, signal) => fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal
  });

  const errorText = async (res) => {
    const text = await res.text().catch(() => "");
    try { return JSON.parse(text).error || text; } catch { return text; }
  };

  let sendThink = true;
  return {
    kind: "ollama",
    id: model.id,
    label: model.label,
    async generate(messages, schema, { maxTokens = 1200, signal, onProgress } = {}) {
      const body = {
        model: model.id,
        messages,
        stream: true,
        format: schema,
        options: { temperature: 0.3, num_predict: maxTokens, num_ctx: 8192 }
      };
      if (sendThink) body.think = false; // skip the "thinking" pass on reasoning models
      let res = await post(body, signal);
      if (res.status === 400 && sendThink) {
        const message = await errorText(res);
        // Some Ollama versions or models reject the "think" option; retry once without it, then stop sending it.
        if (!/think/i.test(message)) throw new Error(`Ollama: ${message || "bad request"}`);
        sendThink = false;
        delete body.think;
        res = await post(body, signal);
      }
      if (res.status === 404) throw new Error(`Ollama doesn't have ${model.id}. Run "ollama pull ${model.id}" and try again.`);
      if (!res.ok) throw new Error(`Ollama: ${(await errorText(res)) || `error ${res.status}`}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let out = "";
      const handleLine = (line) => {
        if (!line.trim()) return;
        const msg = JSON.parse(line);
        if (msg.error) throw new Error(`Ollama: ${msg.error}`);
        out += msg.message?.content ?? "";
        onProgress?.(out.length);
      };
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        lines.forEach(handleLine);
      }
      handleLine(buffer + decoder.decode());
      return parseJSON(out);
    },
    async dispose() {}
  };
}

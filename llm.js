// Local LLM layer: in-browser (WebLLM + WebGPU) or a local Ollama server.
// Both engines expose the same interface:
//   { kind, label, generate(messages, schema, onProgress) -> parsed JSON, dispose() }

const WEBLLM_URL = "https://esm.run/@mlc-ai/web-llm"; // pin a version here once tested, e.g. @0.2.x
const OLLAMA_URL = "http://localhost:11434";

// Preferred model families, best first. Only ones present in WebLLM's prebuilt list are offered.
const BROWSER_FAMILIES = [
  "Qwen3-4B", "Qwen3-1.7B", "Qwen2.5-3B-Instruct", "Llama-3.2-3B-Instruct",
  "Qwen3-0.6B", "Qwen2.5-1.5B-Instruct", "Llama-3.2-1B-Instruct"
];
const OLLAMA_PREFERENCE = ["qwen3", "gemma3", "qwen2.5", "llama3.1", "llama3.2", "mistral", "phi4"];

let webllmLib = null;
async function lib() {
  webllmLib ??= await import(WEBLLM_URL);
  return webllmLib;
}

/* ---------- Detection ---------- */

export async function detectWebGPU() {
  if (!("gpu" in navigator)) return null;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return null;
    return {
      f16: adapter.features.has("shader-f16"),
      maxBuffer: adapter.limits.maxBufferSize,
      memoryGB: navigator.deviceMemory ?? null
    };
  } catch {
    return null;
  }
}

export async function listBrowserModels(gpu) {
  const { prebuiltAppConfig } = await lib();
  const list = prebuiltAppConfig.model_list;
  const quant = gpu.f16 ? "q4f16_1-MLC" : "q4f32_1-MLC";
  return BROWSER_FAMILIES
    .map((family) => list.find((m) => m.model_id === `${family}-${quant}`))
    .filter(Boolean)
    .map((m) => ({ id: m.model_id, vramMB: Math.round(m.vram_required_MB ?? 0) }));
}

// Heuristic tiering. WebGPU does not expose total VRAM, so use buffer limits + device memory.
export function recommendBrowserModel(models, gpu) {
  if (!models.length) return null;
  const mem = gpu.memoryGB ?? 4;
  let budgetMB;
  if (mem >= 8 && gpu.maxBuffer >= 2 ** 30) budgetMB = 4500;
  else if (mem >= 4) budgetMB = 2600;
  else budgetMB = 1500;
  return models.find((m) => !m.vramMB || m.vramMB <= budgetMB) ?? models[models.length - 1];
}

export async function detectOllama() {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 1500);
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    const names = (data.models ?? []).map((m) => m.name);
    const rank = (n) => {
      const i = OLLAMA_PREFERENCE.findIndex((p) => n.startsWith(p));
      return i === -1 ? 99 : i;
    };
    return names.sort((a, b) => rank(a) - rank(b));
  } catch {
    return [];
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

/* ---------- Engines ---------- */

export async function createBrowserEngine(modelId, onLoadProgress) {
  const webllm = await lib();
  const worker = new Worker(new URL("./worker.js", import.meta.url), { type: "module" });
  const engine = await webllm.CreateWebWorkerMLCEngine(worker, modelId, {
    initProgressCallback: (r) => onLoadProgress?.(r.progress ?? 0, r.text ?? "")
  });

  return {
    kind: "browser",
    label: modelId.replace(/-q4f(16|32)_1-MLC$/, ""),
    async generate(messages, schema, onProgress) {
      const stream = await engine.chat.completions.create({
        messages,
        stream: true,
        temperature: 0.3,
        max_tokens: 1600,
        response_format: { type: "json_object", schema: JSON.stringify(schema) },
        extra_body: { enable_thinking: false }
      });
      let out = "";
      for await (const chunk of stream) {
        out += chunk.choices?.[0]?.delta?.content ?? "";
        onProgress?.(out.length);
      }
      return parseJSON(out);
    },
    async dispose() {
      try { await engine.unload(); } catch { /* ignore */ }
      worker.terminate();
    }
  };
}

export function createOllamaEngine(model) {
  return {
    kind: "ollama",
    label: `${model} (Ollama)`,
    async generate(messages, schema, onProgress) {
      const res = await fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model, messages, stream: true, format: schema, think: false,
          options: { temperature: 0.3, num_predict: 2000 }
        })
      });
      if (!res.ok) throw new Error(`Ollama returned ${res.status}. Is the model pulled and OLLAMA_ORIGINS set?`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let out = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim()) continue;
          const msg = JSON.parse(line);
          out += msg.message?.content ?? "";
          onProgress?.(out.length);
        }
      }
      return parseJSON(out);
    },
    async dispose() {}
  };
}

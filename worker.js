// Runs WebLLM inference off the main thread so the UI stays responsive.
// Keep this URL identical to WEBLLM_URL in llm.js.
import { WebWorkerMLCEngineHandler } from "https://esm.run/@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);

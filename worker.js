// Runs WebLLM inference off the main thread so the page stays responsive.
import { WebWorkerMLCEngineHandler } from "./webllm.js";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (message) => handler.onmessage(message);

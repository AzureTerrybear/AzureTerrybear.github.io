// The pinned WebLLM build. The page (llm.js) and the worker (worker.js) both
// import from this file, so upgrading WebLLM is a one-line change here.
// The model IDs in llm.js were checked against this version's model list.
export * from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.86/+esm";

/**
 * Resolve/load hooks that turn any `import "server-only"` into a harmless
 * empty module. See _register-server-only.mjs for why this is needed.
 */
const STUB_URL = "stub:server-only";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: STUB_URL, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}

export async function load(url, context, nextLoad) {
  if (url === STUB_URL) {
    return { format: "module", source: "export {};", shortCircuit: true };
  }
  return nextLoad(url, context);
}

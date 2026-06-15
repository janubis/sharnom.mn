/**
 * Node module-resolution hook that stubs the `server-only` package.
 *
 * `src/lib/search/opensearch.ts` starts with `import "server-only"`. That
 * package is a Next.js bundler shim with no standalone Node entry point, so it
 * fails to resolve under plain `tsx`/Node. Reindexing is a server-side script,
 * not a client bundle, so neutralising the guard is safe here.
 *
 * Preloaded via `tsx --import ./scripts/_register-server-only.mjs` in the
 * `reindex` npm script.
 */
import { register } from "node:module";

register(new URL("./_server-only-hooks.mjs", import.meta.url));

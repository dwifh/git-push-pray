// Lets Node run Expo Router API routes in tests: resolves the `@/` alias (tsconfig paths) and bare JSON imports.
// Needs Node ≥ 22.15 (module.registerHooks).
// shortcut: maps only `@/` → src/ and adds `.ts`; mirror tsconfig `paths` if routes import `@/assets`, `.tsx` or index files.
import { registerHooks } from 'node:module';

const src = new URL('../src/', import.meta.url);
registerHooks({
  resolve(spec, ctx, next) {
    if (spec.startsWith('@/')) spec = new URL(spec.slice(2) + (/\.\w+$/.test(spec) ? '' : '.ts'), src).href;
    const r = next(spec, ctx);
    return r.url.endsWith('.json') ? { ...r, importAttributes: { type: 'json' } } : r;
  },
});

// Custom Node.js specifier resolver: adds .js extension to relative bare imports.
// This lets us import src/lib/*.js files that omit the extension (Vite/bundler convention).
//
// Usage: node --loader ./scripts/loader.mjs scripts/generate-batch.mjs

import { resolve as resolvePath } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { existsSync } from 'fs';

export async function resolve(specifier, context, nextResolve) {
  // Only patch relative bare specifiers (no extension)
  if (specifier.startsWith('.') && !/\.[^/]+$/.test(specifier)) {
    const parentDir = context.parentURL
      ? resolvePath(fileURLToPath(context.parentURL), '..')
      : process.cwd();
    const withJs = resolvePath(parentDir, specifier + '.js');
    if (existsSync(withJs)) {
      return nextResolve(pathToFileURL(withJs).href, context);
    }
  }
  return nextResolve(specifier, context);
}

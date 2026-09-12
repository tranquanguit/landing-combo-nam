import { pathToFileURL } from 'node:url';

const SHIM = pathToFileURL(new URL('./astro-content.mjs', import.meta.url).pathname).href;

export function resolve(specifier, context, next) {
  if (specifier === 'astro:content') return { url: SHIM, shortCircuit: true };
  if (specifier === 'astro/loaders') {
    return { url: pathToFileURL(new URL('./astro-loaders.mjs', import.meta.url).pathname).href, shortCircuit: true };
  }
  return next(specifier, context);
}

import fs from 'fs/promises';
import path from 'path';
import { cosmiconfig } from 'cosmiconfig';
import { Config, ConfigSchema } from './schema.js';

const explorer = cosmiconfig('autodocs', {
  searchPlaces: [
    'autodocs.config.js',
    'autodocs.config.ts',
    'autodocs.config.json',
    '.autodocsrc',
    '.autodocsrc.json',
    'package.json',
  ],
});

let cachedConfig: Config | null = null;

export async function loadConfig(overrides: Partial<Config> = {}): Promise<Config> {
  if (cachedConfig && Object.keys(overrides).length === 0) {
    return cachedConfig;
  }

  const result = await explorer.search();
  const fileConfig = result?.config ?? {};

  // Deep merge: defaults < file config < overrides
  const merged = deepMerge(
    ConfigSchema.parse({}), // defaults
    fileConfig,
    overrides
  );

  const validated = ConfigSchema.parse(merged);

  // Resolve paths relative to root
  validated.paths.components = path.resolve(validated.root, validated.paths.components);
  validated.paths.docs = path.resolve(validated.root, validated.paths.docs);
  validated.paths.suggestions = path.resolve(validated.root, validated.paths.suggestions);
  validated.paths.cache = path.resolve(validated.root, validated.paths.cache);

  cachedConfig = validated;
  return validated;
}

function deepMerge<T extends Record<string, unknown>>(...objects: T[]): T {
  return objects.reduce((acc, obj) => {
    Object.keys(obj).forEach(key => {
      const accVal = acc[key];
      const objVal = obj[key];

      if (Array.isArray(accVal) && Array.isArray(objVal)) {
        (acc as Record<string, unknown>)[key] = objVal; // Arrays are replaced, not merged
      } else if (isObject(accVal) && isObject(objVal)) {
        (acc as Record<string, unknown>)[key] = deepMerge(accVal as Record<string, unknown>, objVal as Record<string, unknown>);
      } else if (objVal !== undefined) {
        (acc as Record<string, unknown>)[key] = objVal;
      }
    });
    return acc;
  }, {} as T);
}

function isObject(item: unknown): item is Record<string, unknown> {
  return item !== null && typeof item === 'object' && !Array.isArray(item);
}

export function clearConfigCache(): void {
  cachedConfig = null;
}

export * from './schema.js';

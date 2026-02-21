import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const args = process.argv.slice(2);
const mockFlagIndex = args.indexOf('--mock');

if (mockFlagIndex === -1) {
  throw new Error('Only mock mode is supported in this foundation build. Use --mock <inputDir>.');
}

const inputDir = args[mockFlagIndex + 1];
if (typeof inputDir !== 'string' || inputDir.trim().length === 0) {
  throw new Error('Mock mode requires an input directory path.');
}

const absoluteInputDir = resolve(process.cwd(), inputDir);
if (!existsSync(absoluteInputDir)) {
  throw new Error(`Input directory does not exist: ${absoluteInputDir}`);
}

console.log(`MOCK MODE: processed ${absoluteInputDir}`);

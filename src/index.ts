import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { generateDocs } from './generate.js';

const USAGE = `Usage: node dist/index.js --mock <inputDir> [--responses <file>] [--out <dir>]

  --mock <inputDir>    Generate docs for every .ts/.tsx file in inputDir from canned responses.
  --responses <file>   Mock responses JSON keyed by filename (default: <inputDir>/../mock-responses.json).
  --out <dir>          Output directory (default: $AUTODOCS_OUTPUT_DIR, else ./docs).

Live LLM generation for React components runs through the scripts CLI: npm run autodocs -- generate`;

function fail(message: string): never {
  console.error(`${message}\n\n${USAGE}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    mock: { type: 'string' },
    responses: { type: 'string' },
    out: { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log(USAGE);
  process.exit(0);
}
if (!values.mock?.trim()) fail('Only mock mode is supported here. Pass --mock <inputDir>.');

const inputDir = resolve(values.mock);
if (!existsSync(inputDir)) fail(`Input directory does not exist: ${inputDir}`);

const responsesPath = resolve(values.responses ?? join(dirname(inputDir), 'mock-responses.json'));
if (!existsSync(responsesPath)) fail(`Mock responses file not found: ${responsesPath}`);

const outDir = resolve(values.out ?? process.env.AUTODOCS_OUTPUT_DIR ?? 'docs');
const responses = JSON.parse(await readFile(responsesPath, 'utf-8'));
const result = await generateDocs({ inputDir, outDir, responses });

for (const path of result.written) console.log(`wrote   ${path}`);
for (const file of result.skipped) console.log(`skipped ${file} (unchanged)`);
for (const { file, error } of result.failed) console.error(`failed  ${file}: ${error}`);
console.log(`MOCK MODE: ${result.written.length} written, ${result.skipped.length} unchanged, ${result.failed.length} failed -> ${outDir}`);

if (result.failed.length > 0) process.exit(1);

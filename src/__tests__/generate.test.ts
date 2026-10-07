import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { extractExports, generateDocs, validateDoc } from '../generate.js';

const examples = join(__dirname, '..', '..', 'examples');
const inputDir = join(examples, 'sample-input');

describe('mock generation', () => {
  let outDir = '';
  afterAll(() => rm(outDir, { recursive: true, force: true }));

  it('writes one markdown file per example source, then skips unchanged files', async () => {
    outDir = await mkdtemp(join(tmpdir(), 'autodocs-'));
    const responses = JSON.parse(await readFile(join(examples, 'mock-responses.json'), 'utf-8'));

    const first = await generateDocs({ inputDir, outDir, responses });
    expect(first.failed).toEqual([]);
    expect(first.written).toHaveLength(4);
    expect((await readdir(outDir)).filter(f => f.endsWith('.md')).sort())
      .toEqual(['ApiClient.md', 'UserCard.md', 'UserService.md', 'stringUtils.md']);

    const md = await readFile(join(outDir, 'stringUtils.md'), 'utf-8');
    expect(md).toContain('# stringUtils');
    expect(md).toContain('export const truncate = (input: string, maxLength: number): string');
    expect(md).toContain('| `maxLength` | `number` |');

    const second = await generateDocs({ inputDir, outDir, responses });
    expect(second.written).toEqual([]);
    expect(second.skipped).toHaveLength(4);
  });

  it('fails a file whose response is missing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'autodocs-'));
    const result = await generateDocs({ inputDir, outDir: dir, responses: {} });
    await rm(dir, { recursive: true, force: true });
    expect(result.written).toEqual([]);
    expect(result.failed).toHaveLength(4);
  });
});

describe('validateDoc', () => {
  const symbols = extractExports('a.ts', 'export function add(a: number, b: number): number { return a + b; }');
  const entry = { name: 'add', kind: 'function', description: 'Adds.', parameters: [], usageExamples: [], edgeCases: [] };

  it('extracts the signature without the body', () => {
    expect(symbols).toEqual([{ name: 'add', signature: 'export function add(a: number, b: number): number' }]);
  });

  it('rejects an export the source does not have', () => {
    expect(() => validateDoc({ moduleOverview: 'x', exports: [{ ...entry, name: 'sub' }] }, symbols))
      .toThrow(/sub/);
  });

  it('rejects a response that breaks the schema', () => {
    expect(() => validateDoc({ exports: [entry] }, symbols)).toThrow();
  });
});

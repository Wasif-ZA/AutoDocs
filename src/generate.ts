import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { Node, Project, ts } from 'ts-morph';
import { z } from 'zod';

export const ModuleDocSchema = z.object({
  moduleOverview: z.string().min(1),
  exports: z.array(z.object({
    name: z.string().min(1),
    kind: z.string().min(1),
    description: z.string().min(1),
    parameters: z.array(z.object({
      name: z.string(),
      type: z.string(),
      description: z.string(),
    })).default([]),
    returns: z.object({ type: z.string(), description: z.string() }).nullable().optional(),
    usageExamples: z.array(z.string()).default([]),
    edgeCases: z.array(z.string()).default([]),
  })).min(1),
});

export type ModuleDoc = z.infer<typeof ModuleDocSchema>;

export interface ExportedSymbol {
  name: string;
  signature: string;
}

export interface GenerateOptions {
  inputDir: string;
  outDir: string;
  responses: Record<string, unknown>;
}

export interface GenerateResult {
  written: string[];
  skipped: string[];
  failed: Array<{ file: string; error: string }>;
}

const MANIFEST = '.autodocs-manifest.json';
const project = new Project({ useInMemoryFileSystem: true, compilerOptions: { jsx: ts.JsxEmit.ReactJSX } });

export function extractExports(fileName: string, source: string): ExportedSymbol[] {
  const sourceFile = project.createSourceFile(fileName, source, { overwrite: true });
  const symbols: ExportedSymbol[] = [];
  for (const [name, declarations] of sourceFile.getExportedDeclarations()) {
    const decl = declarations[0];
    symbols.push({ name, signature: signatureOf(decl) });
  }
  return symbols;
}

function signatureOf(decl: Node): string {
  const node = Node.isVariableDeclaration(decl) ? decl.getVariableStatementOrThrow() : decl;
  let text = node.getText();
  const init = Node.isVariableDeclaration(decl) ? decl.getInitializer() : undefined;
  const body =
    Node.isFunctionDeclaration(decl) ? decl.getBody()
    : init && (Node.isArrowFunction(init) || Node.isFunctionExpression(init)) ? init.getBody()
    : undefined;
  if (body) {
    text = text.slice(0, body.getStart() - node.getStart()).replace(/\s*=>\s*$/, '').trimEnd();
  } else if (Node.isClassDeclaration(decl)) {
    text = text.slice(0, text.indexOf('{')).trimEnd();
  }
  return text.replace(/^(\/\*\*[\s\S]*?\*\/\s*)/, '');
}

export function validateDoc(raw: unknown, symbols: ExportedSymbol[]): ModuleDoc {
  const doc = ModuleDocSchema.parse(raw);
  const known = new Set(symbols.map(s => s.name));
  const unknown = doc.exports.filter(e => !known.has(e.name)).map(e => e.name);
  if (unknown.length > 0) {
    throw new Error(`documents exports not found in source: ${unknown.join(', ')}`);
  }
  return doc;
}

const cell = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function renderMarkdown(moduleName: string, lang: string, doc: ModuleDoc, symbols: ExportedSymbol[]): string {
  const out: string[] = [`# ${moduleName}`, '', '## Module Overview', doc.moduleOverview, ''];

  out.push('## Exported Members');
  for (const s of symbols) out.push(`- \`${s.name}\``);
  out.push('', '## Signature', '```' + lang, ...symbols.map(s => s.signature), '```', '');

  for (const e of doc.exports) {
    out.push(`## ${e.name} (${e.kind})`, e.description, '');
    if (e.parameters.length > 0) {
      out.push('| Name | Type | Description |', '| --- | --- | --- |');
      for (const p of e.parameters) out.push(`| \`${cell(p.name)}\` | \`${cell(p.type)}\` | ${cell(p.description)} |`);
      out.push('');
    }
    if (e.returns) out.push(`**Returns** \`${e.returns.type}\`: ${e.returns.description}`, '');
    if (e.usageExamples.length > 0) out.push('**Usage**', '```' + lang, ...e.usageExamples, '```', '');
    if (e.edgeCases.length > 0) out.push('**Edge cases**', ...e.edgeCases.map(c => `- ${c}`), '');
  }
  return out.join('\n');
}

export async function generateDocs({ inputDir, outDir, responses }: GenerateOptions): Promise<GenerateResult> {
  const result: GenerateResult = { written: [], skipped: [], failed: [] };
  const manifestPath = join(outDir, MANIFEST);
  const manifest: Record<string, string> = existsSync(manifestPath)
    ? JSON.parse(await readFile(manifestPath, 'utf-8'))
    : {};

  const files = (await readdir(inputDir))
    .filter(f => /\.tsx?$/.test(f) && !f.endsWith('.d.ts'))
    .sort();
  await mkdir(outDir, { recursive: true });

  for (const file of files) {
    const source = await readFile(join(inputDir, file), 'utf-8');
    const response = responses[file];
    const moduleName = basename(file, extname(file));
    const outPath = join(outDir, `${moduleName}.md`);
    const hash = createHash('sha256').update(source).update(JSON.stringify(response ?? null)).digest('hex');

    if (manifest[file] === hash && existsSync(outPath)) {
      result.skipped.push(file);
      continue;
    }
    try {
      if (response === undefined) throw new Error('no mock response for this file');
      const symbols = extractExports(file, source);
      const doc = validateDoc(response, symbols);
      await writeFile(outPath, renderMarkdown(moduleName, extname(file).slice(1), doc, symbols));
      manifest[file] = hash;
      result.written.push(outPath);
    } catch (error) {
      result.failed.push({ file, error: (error as Error).message });
    }
  }

  await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  return result;
}

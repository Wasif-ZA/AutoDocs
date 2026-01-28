import ts from 'typescript';
import { ComponentDoc } from '../config/schema.js';
import { logger } from '../utils/logger.js';

interface ValidationResult {
  valid: boolean;
  errors: Array<{
    example: string;
    line?: number;
    message: string;
  }>;
}

export class CodeValidator {
  private compilerOptions: ts.CompilerOptions;

  constructor() {
    this.compilerOptions = {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      jsx: ts.JsxEmit.React,
      strict: false, // Lenient for examples
      noEmit: true,
      skipLibCheck: true,
      esModuleInterop: true,
      allowSyntheticDefaultImports: true,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
    };
  }

  validateExamples(doc: ComponentDoc): ValidationResult {
    const result: ValidationResult = { valid: true, errors: [] };

    for (const example of doc.usage) {
      const validation = this.validateCode(example.code, example.title);

      if (!validation.valid) {
        result.valid = false;
        result.errors.push({
          example: example.title,
          message: validation.error!,
        });
      }
    }

    return result;
  }

  private validateCode(code: string, title: string): { valid: boolean; error?: string } {
    // Wrap in a component context for validation
    const wrappedCode = `
      import React from 'react';

      function ExampleWrapper() {
        return (
          <>
            ${code}
          </>
        );
      }
    `;

    const fileName = `example-${Date.now()}.tsx`;

    // Create a virtual file system
    const sourceFile = ts.createSourceFile(
      fileName,
      wrappedCode,
      ts.ScriptTarget.ESNext,
      true,
      ts.ScriptKind.TSX
    );

    // Check for syntax errors
    const syntaxErrors = this.getSyntaxErrors(sourceFile);

    if (syntaxErrors.length > 0) {
      return {
        valid: false,
        error: `Syntax error in "${title}": ${syntaxErrors[0]}`,
      };
    }

    // Basic semantic validation (without full type checking)
    const semanticIssues = this.checkBasicSemantics(code);

    if (semanticIssues.length > 0) {
      logger.warn(`Potential issues in example "${title}"`, { issues: semanticIssues });
    }

    return { valid: true };
  }

  private getSyntaxErrors(sourceFile: ts.SourceFile): string[] {
    const errors: string[] = [];

    // Walk the AST looking for error nodes
    const visit = (node: ts.Node) => {
      if (node.kind === ts.SyntaxKind.Unknown) {
        errors.push(`Unknown syntax at position ${node.pos}`);
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return errors;
  }

  private checkBasicSemantics(code: string): string[] {
    const issues: string[] = [];

    // Check for common issues
    if (code.includes('undefined.')) {
      issues.push('Potential undefined access');
    }

    if (code.match(/onClick=\{[^}]*\(\)/)) {
      issues.push('Possible immediate function invocation in onClick');
    }

    if (code.match(/key=\{index\}/)) {
      issues.push('Using array index as key is not recommended');
    }

    return issues;
  }
}

import {
  Project,
  SyntaxKind,
  Node,
  FunctionDeclaration,
  VariableDeclaration,
  PropertySignature,
  SourceFile,
  ts,
} from 'ts-morph';
import { ASTExtractionResult } from '../config/schema.js';
import { logger } from '../utils/logger.js';

export class ComponentExtractor {
  private project: Project;

  constructor() {
    this.project = new Project({
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ESNext,
        module: ts.ModuleKind.ESNext,
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
      },
      skipAddingFilesFromTsConfig: true,
      useInMemoryFileSystem: true,
    });
  }

  extract(filePath: string, content: string): ASTExtractionResult {
    const result: ASTExtractionResult = {
      componentName: '',
      exportType: 'named',
      isForwardRef: false,
      isMemo: false,
      isHOC: false,
      props: [],
      imports: [],
      hooks: [],
      astSuccess: false,
      astErrors: [],
    };

    try {
      const sourceFile = this.project.createSourceFile(
        `${Date.now()}.tsx`,
        content,
        { overwrite: true }
      );

      // Extract imports
      result.imports = this.extractImports(sourceFile);

      // Find the main component
      const component = this.findMainComponent(sourceFile);
      if (!component) {
        result.astErrors.push('Could not identify main component export');
        return result;
      }

      result.componentName = component.name;
      result.exportType = component.exportType;
      result.isForwardRef = component.isForwardRef;
      result.isMemo = component.isMemo;
      result.isHOC = component.isHOC;

      // Extract props
      if (component.propsType) {
        result.props = this.extractPropsFromType(sourceFile, component.propsType);
      }

      // Extract JSDoc
      if (component.node) {
        result.jsDoc = this.extractJSDoc(component.node);
      }

      // Extract hooks used
      result.hooks = this.extractHooks(sourceFile);

      result.astSuccess = true;
    } catch (error) {
      result.astErrors.push(`AST parsing failed: ${(error as Error).message}`);
      logger.warn(`AST extraction failed for ${filePath}`, { error: (error as Error).message });
    }

    return result;
  }

  private extractImports(sourceFile: SourceFile): ASTExtractionResult['imports'] {
    return sourceFile.getImportDeclarations().map(imp => {
      const source = imp.getModuleSpecifierValue();
      const specifiers: string[] = [];

      // Default import
      const defaultImport = imp.getDefaultImport();
      if (defaultImport) {
        specifiers.push(defaultImport.getText());
      }

      // Named imports
      imp.getNamedImports().forEach(named => {
        specifiers.push(named.getName());
      });

      // Namespace import
      const namespace = imp.getNamespaceImport();
      if (namespace) {
        specifiers.push(`* as ${namespace.getText()}`);
      }

      return {
        source,
        specifiers,
        isRelative: source.startsWith('.') || source.startsWith('/'),
      };
    });
  }

  private findMainComponent(sourceFile: SourceFile): {
    name: string;
    exportType: 'default' | 'named' | 'both';
    isForwardRef: boolean;
    isMemo: boolean;
    isHOC: boolean;
    propsType: string | null;
    node: Node | null;
  } | null {
    const exports = sourceFile.getExportedDeclarations();

    // Priority: default export > named export matching filename
    let defaultExport: { name: string; node: Node } | null = null;
    const namedExports: Array<{ name: string; node: Node }> = [];

    for (const [name, declarations] of exports) {
      const decl = declarations[0];

      if (name === 'default') {
        // Handle: export default ComponentName
        if (decl.getKind() === SyntaxKind.Identifier) {
          defaultExport = { name: decl.getText(), node: decl };
        }
        // Handle: export default function ComponentName()
        else if (decl.getKind() === SyntaxKind.FunctionDeclaration) {
          const funcName = (decl as FunctionDeclaration).getName() || 'Component';
          defaultExport = { name: funcName, node: decl };
        }
      } else {
        namedExports.push({ name, node: decl });
      }
    }

    // Determine which export is the "main" component
    const mainExport = defaultExport || namedExports[0];
    if (!mainExport) return null;

    // Analyze the component
    const analysis = this.analyzeComponent(sourceFile, mainExport.name);

    return {
      name: mainExport.name,
      exportType: defaultExport && namedExports.find(e => e.name === mainExport!.name)
        ? 'both'
        : defaultExport
          ? 'default'
          : 'named',
      ...analysis,
      node: mainExport.node,
    };
  }

  private analyzeComponent(sourceFile: SourceFile, name: string): {
    isForwardRef: boolean;
    isMemo: boolean;
    isHOC: boolean;
    propsType: string | null;
  } {
    const result = {
      isForwardRef: false,
      isMemo: false,
      isHOC: false,
      propsType: null as string | null,
    };

    // Find the variable/function declaration
    const varDecl = sourceFile.getVariableDeclaration(name);
    const funcDecl = sourceFile.getFunction(name);

    if (varDecl) {
      const initializer = varDecl.getInitializer();
      if (initializer) {
        const text = initializer.getText();

        // Check for forwardRef
        if (text.includes('forwardRef')) {
          result.isForwardRef = true;
        }

        // Check for memo
        if (text.includes('memo(')) {
          result.isMemo = true;
        }

        // Extract props type from generic
        const propsMatch = text.match(/<(\w+(?:Props)?)\s*[,>]/);
        if (propsMatch) {
          result.propsType = propsMatch[1];
        }

        // Check for HOC pattern
        if (text.includes('withRouter') || text.includes('connect(') || text.includes('withStyles')) {
          result.isHOC = true;
        }
      }

      // Also check type annotation
      const typeNode = varDecl.getTypeNode();
      if (typeNode) {
        const typeText = typeNode.getText();
        const fcMatch = typeText.match(/(?:React\.)?FC<(\w+)>/);
        if (fcMatch) {
          result.propsType = fcMatch[1];
        }
      }
    }

    if (funcDecl) {
      // Check first parameter for props type
      const params = funcDecl.getParameters();
      if (params.length > 0) {
        const firstParam = params[0];
        const typeNode = firstParam.getTypeNode();
        if (typeNode) {
          result.propsType = typeNode.getText();
        }
      }
    }

    return result;
  }

  private extractPropsFromType(
    sourceFile: SourceFile,
    typeName: string
  ): ASTExtractionResult['props'] {
    const props: ASTExtractionResult['props'] = [];

    // Find type alias or interface
    const typeAlias = sourceFile.getTypeAlias(typeName);
    const interfaceDecl = sourceFile.getInterface(typeName);

    const declaration = typeAlias || interfaceDecl;
    if (!declaration) {
      logger.debug(`Props type ${typeName} not found in file`);
      return props;
    }

    // Get properties
    let properties: PropertySignature[] = [];

    if (interfaceDecl) {
      properties = interfaceDecl.getProperties();
    } else if (typeAlias) {
      // Handle type alias - try to get the underlying type
      const typeNode = typeAlias.getTypeNode();
      if (typeNode?.getKind() === SyntaxKind.TypeLiteral) {
        properties = typeNode.getDescendantsOfKind(SyntaxKind.PropertySignature);
      }
    }

    for (const prop of properties) {
      const name = prop.getName();
      const typeNode = prop.getTypeNode();
      const type = typeNode?.getText() || 'unknown';
      const required = !prop.hasQuestionToken();

      // Extract JSDoc comment for this property
      const jsDoc = prop.getJsDocs()[0];
      const description = jsDoc?.getDescription()?.trim() || '';

      props.push({
        name,
        type: this.normalizeType(type),
        required,
        defaultValue: undefined,
        jsDoc: description,
      });
    }

    return props;
  }

  private normalizeType(type: string): string {
    // Clean up complex types for readability
    return type
      .replace(/\s+/g, ' ')
      .replace(/import\([^)]+\)\./g, '')
      .trim();
  }

  private extractJSDoc(node: Node): ASTExtractionResult['jsDoc'] | undefined {
    const jsDocs = Node.isJSDocable(node) ? node.getJsDocs() : [];
    if (jsDocs.length === 0) return undefined;

    const jsDoc = jsDocs[0];
    const tags: Record<string, string> = {};

    jsDoc.getTags().forEach(tag => {
      const tagName = tag.getTagName();
      const comment = tag.getCommentText() || '';
      tags[tagName] = comment;
    });

    return {
      description: jsDoc.getDescription()?.trim(),
      tags,
    };
  }

  private extractHooks(sourceFile: SourceFile): string[] {
    const hooks: Set<string> = new Set();

    // Find all call expressions that start with "use"
    sourceFile.forEachDescendant(node => {
      if (node.getKind() === SyntaxKind.CallExpression) {
        const text = node.getText();
        const match = text.match(/^(use\w+)/);
        if (match) {
          hooks.add(match[1]);
        }
      }
    });

    return Array.from(hooks);
  }
}

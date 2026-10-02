import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import ts from "typescript";

export type LspOperation =
  | "goToDefinition"
  | "findReferences"
  | "goToImplementation"
  | "hover"
  | "documentSymbols";

export interface LspLocation {
  filePath: string;
  line: number;
  character: number;
  text?: string;
  preview?: string;
}

export interface LspHoverResult {
  signature: string;
  documentation?: string;
  range?: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  };
}

export interface LspSymbolItem {
  name: string;
  kind: string;
  line: number;
  character: number;
  containerName?: string;
}

export interface LspQueryResult {
  operation: LspOperation;
  target: {
    filePath: string;
    line?: number;
    character?: number;
  };
  locations?: LspLocation[];
  hover?: LspHoverResult | null;
  symbols?: LspSymbolItem[];
  formatted: string;
}

function normalizeFsPath(filePath: string): string {
  return path.resolve(filePath).replace(/\\/g, "/");
}

function lineColToOffset(sourceText: string, targetLine: number, targetCol: number): number {
  if (targetLine <= 1 && targetCol <= 1) return 0;
  let curLine = 1;
  let curCol = 1;
  for (let i = 0; i < sourceText.length; i++) {
    if (curLine === targetLine && curCol === targetCol) {
      return i;
    }
    if (sourceText[i] === "\n") {
      curLine++;
      curCol = 1;
    } else {
      curCol++;
    }
  }
  return sourceText.length;
}

function offsetToLineCol(sourceText: string, offset: number): { line: number; character: number } {
  let line = 1;
  let character = 1;
  const bound = Math.min(offset, sourceText.length);
  for (let i = 0; i < bound; i++) {
    if (sourceText[i] === "\n") {
      line++;
      character = 1;
    } else {
      character++;
    }
  }
  return { line, character };
}

function getLineSnippet(sourceText: string, line: number): string {
  const lines = sourceText.split(/\r?\n/);
  if (line >= 1 && line <= lines.length) {
    return lines[line - 1]?.trim() ?? "";
  }
  return "";
}

/**
 * High performance TypeScript Language Service host for in-process code intelligence
 */
class TypeScriptWorkspaceService {
  private service: ts.LanguageService | null = null;
  private rootFiles = new Set<string>();
  private fileVersions = new Map<string, number>();
  private fileContents = new Map<string, string>();
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = normalizeFsPath(workspaceRoot);
    this.initService();
  }

  private initService() {
    let compilerOptions: ts.CompilerOptions = {
      allowJs: true,
      target: ts.ScriptTarget.Latest,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.NodeNext,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      skipLibCheck: true,
    };

    const configPath =
      ts.findConfigFile(this.workspaceRoot, ts.sys.fileExists, "tsconfig.json") ||
      ts.findConfigFile(this.workspaceRoot, ts.sys.fileExists, "jsconfig.json");

    if (configPath) {
      const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
      if (!configFile.error && configFile.config) {
        const parsed = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          path.dirname(configPath).replace(/\\/g, "/")
        );
        compilerOptions = {
          ...compilerOptions,
          ...parsed.options,
        };
        for (const f of parsed.fileNames) {
          this.rootFiles.add(normalizeFsPath(f));
        }
      }
    }

    const host: ts.LanguageServiceHost = {
      getScriptFileNames: () => Array.from(this.rootFiles),
      getScriptVersion: (fileName: string) => {
        const norm = normalizeFsPath(fileName);
        return (this.fileVersions.get(norm) || 0).toString();
      },
      getScriptSnapshot: (fileName: string) => {
        const norm = normalizeFsPath(fileName);
        if (this.fileContents.has(norm)) {
          return ts.ScriptSnapshot.fromString(this.fileContents.get(norm)!);
        }
        if (fsSync.existsSync(norm)) {
          try {
            const content = fsSync.readFileSync(norm, "utf-8");
            this.fileContents.set(norm, content);
            return ts.ScriptSnapshot.fromString(content);
          } catch {
            return undefined;
          }
        }
        return undefined;
      },
      getCurrentDirectory: () => this.workspaceRoot,
      getCompilationSettings: () => compilerOptions,
      getDefaultLibFileName: (options) => ts.getDefaultLibFilePath(options).replace(/\\/g, "/"),
      fileExists: (filePath: string) => {
        const norm = normalizeFsPath(filePath);
        return this.fileContents.has(norm) || fsSync.existsSync(norm);
      },
      readFile: (filePath: string) => {
        const norm = normalizeFsPath(filePath);
        if (this.fileContents.has(norm)) {
          return this.fileContents.get(norm)!;
        }
        if (fsSync.existsSync(norm)) {
          try {
            const content = fsSync.readFileSync(norm, "utf-8");
            this.fileContents.set(norm, content);
            return content;
          } catch {
            return undefined;
          }
        }
        return undefined;
      },
      readDirectory: (rootDir, extensions, excludes, includes, depth) => {
        return ts.sys.readDirectory(rootDir, extensions, excludes, includes, depth).map(f => f.replace(/\\/g, "/"));
      },
      directoryExists: ts.sys.directoryExists,
      getDirectories: ts.sys.getDirectories,
    };

    const documentRegistry = ts.createDocumentRegistry();
    this.service = ts.createLanguageService(host, documentRegistry);
  }

  public registerFile(filePath: string, content?: string): string {
    const norm = normalizeFsPath(filePath);
    this.rootFiles.add(norm);
    const prevVersion = this.fileVersions.get(norm) || 0;
    this.fileVersions.set(norm, prevVersion + 1);

    if (content !== undefined) {
      this.fileContents.set(norm, content);
    } else if (fsSync.existsSync(norm)) {
      try {
        this.fileContents.set(norm, fsSync.readFileSync(norm, "utf-8"));
      } catch {}
    }
    return norm;
  }

  public getService(): ts.LanguageService {
    if (!this.service) {
      this.initService();
    }
    return this.service!;
  }
}

const servicePool = new Map<string, TypeScriptWorkspaceService>();

function getOrCreateTypeScriptService(workspaceRoot: string): TypeScriptWorkspaceService {
  const normRoot = normalizeFsPath(workspaceRoot);
  let inst = servicePool.get(normRoot);
  if (!inst) {
    inst = new TypeScriptWorkspaceService(normRoot);
    servicePool.set(normRoot, inst);
  }
  return inst;
}

/**
 * Execute LSP operations via TypeScript LanguageService
 */
export async function executeLspQuery(
  operation: LspOperation,
  rawFilePath: string,
  line: number,
  character: number,
  workspaceRoot: string
): Promise<LspQueryResult> {
  const absoluteFilePath = path.isAbsolute(rawFilePath)
    ? normalizeFsPath(rawFilePath)
    : normalizeFsPath(path.resolve(workspaceRoot, rawFilePath));

  if (!fsSync.existsSync(absoluteFilePath)) {
    throw new Error(`File not found: ${absoluteFilePath}`);
  }

  const tsService = getOrCreateTypeScriptService(workspaceRoot);
  const normalizedFile = tsService.registerFile(absoluteFilePath);
  const service = tsService.getService();

  const sourceContent = fsSync.readFileSync(normalizedFile, "utf-8");
  const offset = lineColToOffset(sourceContent, line || 1, character || 1);

  const relTargetFile = path.relative(workspaceRoot, normalizedFile).replace(/\\/g, "/") || normalizedFile;

  switch (operation) {
    case "goToDefinition": {
      const defs = service.getDefinitionAtPosition(normalizedFile, offset);
      if (!defs || defs.length === 0) {
        return {
          operation,
          target: { filePath: relTargetFile, line, character },
          locations: [],
          formatted: `No definition found for symbol at ${relTargetFile}:${line}:${character}`,
        };
      }

      const locations: LspLocation[] = [];
      for (const def of defs) {
        let defContent = "";
        try {
          defContent = fsSync.readFileSync(def.fileName, "utf-8");
        } catch {
          defContent = "";
        }
        const { line: defLine, character: defChar } = offsetToLineCol(defContent, def.textSpan.start);
        const preview = getLineSnippet(defContent, defLine);
        const relPath = path.relative(workspaceRoot, def.fileName).replace(/\\/g, "/") || def.fileName;
        locations.push({
          filePath: relPath,
          line: defLine,
          character: defChar,
          preview,
        });
      }

      const formatted = locations
        .map((loc) => `${loc.filePath}:${loc.line}:${loc.character}${loc.preview ? ` -> ${loc.preview}` : ""}`)
        .join("\n");

      return {
        operation,
        target: { filePath: relTargetFile, line, character },
        locations,
        formatted: `[LSP goToDefinition] (${locations.length} location${locations.length > 1 ? "s" : ""}):\n${formatted}`,
      };
    }

    case "findReferences": {
      const refEntries = service.getReferencesAtPosition(normalizedFile, offset);
      if (!refEntries || refEntries.length === 0) {
        return {
          operation,
          target: { filePath: relTargetFile, line, character },
          locations: [],
          formatted: `No references found for symbol at ${relTargetFile}:${line}:${character}`,
        };
      }

      const locations: LspLocation[] = [];
      for (const ref of refEntries) {
        let refContent = "";
        try {
          refContent = fsSync.readFileSync(ref.fileName, "utf-8");
        } catch {
          refContent = "";
        }
        const { line: refLine, character: refChar } = offsetToLineCol(refContent, ref.textSpan.start);
        const preview = getLineSnippet(refContent, refLine);
        const relPath = path.relative(workspaceRoot, ref.fileName).replace(/\\/g, "/") || ref.fileName;
        locations.push({
          filePath: relPath,
          line: refLine,
          character: refChar,
          preview,
        });
      }

      const formatted = locations
        .map((loc) => `${loc.filePath}:${loc.line}:${loc.character} ${loc.preview ? `| ${loc.preview}` : ""}`)
        .join("\n");

      return {
        operation,
        target: { filePath: relTargetFile, line, character },
        locations,
        formatted: `[LSP findReferences] (${locations.length} reference${locations.length > 1 ? "s" : ""}):\n${formatted}`,
      };
    }

    case "goToImplementation": {
      const imps = service.getImplementationAtPosition(normalizedFile, offset);
      if (!imps || imps.length === 0) {
        return {
          operation,
          target: { filePath: relTargetFile, line, character },
          locations: [],
          formatted: `No implementations found for symbol at ${relTargetFile}:${line}:${character}`,
        };
      }

      const locations: LspLocation[] = [];
      for (const imp of imps) {
        let impContent = "";
        try {
          impContent = fsSync.readFileSync(imp.fileName, "utf-8");
        } catch {
          impContent = "";
        }
        const { line: impLine, character: impChar } = offsetToLineCol(impContent, imp.textSpan.start);
        const preview = getLineSnippet(impContent, impLine);
        const relPath = path.relative(workspaceRoot, imp.fileName).replace(/\\/g, "/") || imp.fileName;
        locations.push({
          filePath: relPath,
          line: impLine,
          character: impChar,
          preview,
        });
      }

      const formatted = locations
        .map((loc) => `${loc.filePath}:${loc.line}:${loc.character}${loc.preview ? ` -> ${loc.preview}` : ""}`)
        .join("\n");

      return {
        operation,
        target: { filePath: relTargetFile, line, character },
        locations,
        formatted: `[LSP goToImplementation] (${locations.length} implementation${locations.length > 1 ? "s" : ""}):\n${formatted}`,
      };
    }

    case "hover": {
      const quickInfo = service.getQuickInfoAtPosition(normalizedFile, offset);
      if (!quickInfo) {
        return {
          operation,
          target: { filePath: relTargetFile, line, character },
          hover: null,
          formatted: `No hover information available at ${relTargetFile}:${line}:${character}`,
        };
      }

      const signature = ts.displayPartsToString(quickInfo.displayParts || []);
      const documentation = ts.displayPartsToString(quickInfo.documentation || []);
      const { line: startLine, character: startChar } = offsetToLineCol(sourceContent, quickInfo.textSpan.start);
      const { line: endLine, character: endChar } = offsetToLineCol(
        sourceContent,
        quickInfo.textSpan.start + quickInfo.textSpan.length
      );

      const hoverResult: LspHoverResult = {
        signature,
        documentation: documentation || undefined,
        range: {
          startLine,
          startCharacter: startChar,
          endLine,
          endCharacter: endChar,
        },
      };

      const formatted = `[LSP Hover for ${relTargetFile}:${line}:${character}]\n` +
        `\`\`\`typescript\n${signature}\n\`\`\`` +
        (documentation ? `\n\n${documentation}` : "");

      return {
        operation,
        target: { filePath: relTargetFile, line, character },
        hover: hoverResult,
        formatted,
      };
    }

    case "documentSymbols": {
      const navTree = service.getNavigationTree(normalizedFile);
      const symbols: LspSymbolItem[] = [];

      function walkTree(item: ts.NavigationTree, container?: string) {
        const span = item.nameSpan || (item.spans && item.spans.length > 0 ? item.spans[0] : undefined);
        if (span && item.text && item.kind !== "module" && item.kind !== "script") {
          const { line: symLine, character: symChar } = offsetToLineCol(sourceContent, span.start);
          symbols.push({
            name: item.text,
            kind: item.kind,
            line: symLine,
            character: symChar,
            containerName: container,
          });
        }
        if (item.childItems && item.childItems.length > 0) {
          for (const child of item.childItems) {
            walkTree(child, item.text === '""' || item.text.startsWith('"') ? container : item.text);
          }
        }
      }

      if (navTree.childItems) {
        for (const child of navTree.childItems) {
          walkTree(child);
        }
      }

      const formatted = symbols
        .map((sym) => `[${sym.kind}] ${sym.containerName ? `${sym.containerName}.` : ""}${sym.name} (Line ${sym.line}:${sym.character})`)
        .slice(0, 100)
        .join("\n");

      return {
        operation,
        target: { filePath: relTargetFile },
        symbols,
        formatted: `[LSP documentSymbols] Found ${symbols.length} symbol${symbols.length > 1 ? "s" : ""} in ${relTargetFile}:\n${formatted}`,
      };
    }

    default:
      throw new Error(`Unsupported LSP operation: ${operation}`);
  }
}

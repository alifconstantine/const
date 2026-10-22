/**
 * Syntax Highlighter for File Previews and Code Viewers
 * Provides line-by-line syntax highlighting for diverse languages,
 * producing safe HTML lines with dark-mode optimized color tokens.
 */

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightJsTsLine(line: string): string {
  // Comments, Strings, Keywords, Builtins/Types, Numbers, Functions, JSX tags, Identifiers, Operators, Spaces
  const regex =
    /(\/\/.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b(?:import|export|from|as|default|const|let|var|function|return|if|else|switch|case|break|continue|for|while|do|try|catch|finally|throw|new|class|extends|implements|interface|type|enum|public|private|protected|readonly|static|async|await|yield|typeof|instanceof|void|null|undefined|this|super|true|false|debugger|package|namespace)\b)|(\b(?:string|number|boolean|any|unknown|never|object|Symbol|BigInt|Array|Record|Promise|Map|Set|Date|RegExp|Error|JSON|Math|console|window|document|React|HTMLElement|Event)\b)|(\b\d+(?:\.\d+)?\b|0x[0-9a-fA-F]+\b)|(<\/?(?:[a-zA-Z0-9_\-]+)\b)|(\b[a-zA-Z_$][\w$]*(?=\s*\())|([a-zA-Z_$][\w$]*)|([^\s\w$]+)|(\s+)/g;

  return line.replace(
    regex,
    (
      match,
      comment,
      str,
      kw,
      builtin,
      num,
      jsxTag,
      fnCall,
      _ident,
      _symbol,
      spaces
    ) => {
      if (comment)
        return `<span class="text-[#6a9955] dark:text-[#6a9955] italic">${escapeHtml(comment)}</span>`;
      if (str)
        return `<span class="text-[#ce9178] dark:text-[#ce9178]">${escapeHtml(str)}</span>`;
      if (kw)
        return `<span class="text-[#c586c0] dark:text-[#c586c0] font-semibold">${escapeHtml(kw)}</span>`;
      if (builtin)
        return `<span class="text-[#4ec9b0] dark:text-[#4ec9b0]">${escapeHtml(builtin)}</span>`;
      if (num)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(num)}</span>`;
      if (jsxTag)
        return `<span class="text-[#569cd6] dark:text-[#569cd6] font-medium">${escapeHtml(jsxTag)}</span>`;
      if (fnCall)
        return `<span class="text-[#dcdcaa] dark:text-[#dcdcaa]">${escapeHtml(fnCall)}</span>`;
      if (spaces) return spaces;
      return escapeHtml(match);
    }
  );
}

function highlightHtmlLine(line: string): string {
  // Comments, DOCTYPE, Opening/closing tag names, Tag brackets, Attribute names with =, Attribute strings, Entities, spaces, symbols
  const regex =
    /(<!--.*?-->|<!--.*$|^.*?-->)|(<!DOCTYPE[^>]*>|<!\[CDATA\[[\s\S]*?\]\]>)|(<\/?[a-zA-Z0-9_\-]+)|(\/?>)|([a-zA-Z0-9_\-:@]+)(?=\s*=)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(&[a-zA-Z0-9#]+;)|(\s+)|([^<>"'=\s&]+)/g;

  return line.replace(
    regex,
    (
      match,
      comment,
      doctype,
      tag,
      bracket,
      attrName,
      attrVal,
      entity,
      spaces,
      text
    ) => {
      if (comment)
        return `<span class="text-[#6a9955] dark:text-[#6a9955] italic">${escapeHtml(comment)}</span>`;
      if (doctype)
        return `<span class="text-[#c586c0] dark:text-[#c586c0] font-semibold">${escapeHtml(doctype)}</span>`;
      if (tag) {
        const prefix = tag.startsWith("</") ? "&lt;/" : "&lt;";
        const name = tag.replace(/^<\/?/, "");
        return `${prefix}<span class="text-[#569cd6] dark:text-[#569cd6] font-medium">${escapeHtml(name)}</span>`;
      }
      if (bracket)
        return `<span class="text-[#569cd6] dark:text-[#569cd6]">${escapeHtml(bracket)}</span>`;
      if (attrName)
        return `<span class="text-[#9cdcfe] dark:text-[#9cdcfe]">${escapeHtml(attrName)}</span>`;
      if (attrVal)
        return `<span class="text-[#ce9178] dark:text-[#ce9178]">${escapeHtml(attrVal)}</span>`;
      if (entity)
        return `<span class="text-[#d7ba7d] dark:text-[#d7ba7d] font-mono">${escapeHtml(entity)}</span>`;
      if (spaces) return spaces;
      if (text) return escapeHtml(text);
      return escapeHtml(match);
    }
  );
}

function highlightCssLine(line: string): string {
  // Comments, At-rules, Selectors / pseudo, Properties, Strings, Hex colors, Units & Numbers, Values, spaces, symbols
  const regex =
    /(\/\*.*?\*\/|\/\/.*$)|(@[a-zA-Z\-]+)|(:(?:hover|active|focus|visited|before|after|first-child|last-child|nth-child\([^)]*\)))|([a-zA-Z\-]+)(?=\s*:)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(#[0-9a-fA-F]{3,8}\b)|(\b\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw|s|ms|deg|fr|pt)?\b)|(\b(?:!important|flex|grid|block|inline|none|hidden|absolute|relative|fixed|sticky|auto|inherit|initial|border-box|sans-serif|monospace|pointer|center|wrap|nowrap|solid|dashed|transparent|cover|contain)\b)|(\s+)|([^:;{}()\s]+)/g;

  return line.replace(
    regex,
    (
      match,
      comment,
      atRule,
      pseudo,
      prop,
      str,
      hex,
      unitNum,
      val,
      spaces,
      text
    ) => {
      if (comment)
        return `<span class="text-[#6a9955] dark:text-[#6a9955] italic">${escapeHtml(comment)}</span>`;
      if (atRule)
        return `<span class="text-[#c586c0] dark:text-[#c586c0] font-semibold">${escapeHtml(atRule)}</span>`;
      if (pseudo)
        return `<span class="text-[#d7ba7d] dark:text-[#d7ba7d]">${escapeHtml(pseudo)}</span>`;
      if (prop)
        return `<span class="text-[#9cdcfe] dark:text-[#9cdcfe]">${escapeHtml(prop)}</span>`;
      if (str)
        return `<span class="text-[#ce9178] dark:text-[#ce9178]">${escapeHtml(str)}</span>`;
      if (hex)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(hex)}</span>`;
      if (unitNum)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(unitNum)}</span>`;
      if (val)
        return `<span class="text-[#ce9178] dark:text-[#ce9178] font-medium">${escapeHtml(val)}</span>`;
      if (spaces) return spaces;
      if (text) return escapeHtml(text);
      return escapeHtml(match);
    }
  );
}

function highlightJsonLine(line: string): string {
  // Comments, Keys (quoted string before :), String values, Numbers, Booleans/null, spaces, symbols
  const regex =
    /(\/\/.*$)|("(?:\\.|[^"\\])*")(?=\s*:)|("(?:\\.|[^"\\])*")|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\b(?:true|false|null)\b)|(\s+)|([^\s])/g;

  return line.replace(
    regex,
    (match, comment, key, strVal, num, boolNull, spaces, sym) => {
      if (comment)
        return `<span class="text-[#6a9955] dark:text-[#6a9955] italic">${escapeHtml(comment)}</span>`;
      if (key)
        return `<span class="text-[#9cdcfe] dark:text-[#9cdcfe]">${escapeHtml(key)}</span>`;
      if (strVal)
        return `<span class="text-[#ce9178] dark:text-[#ce9178]">${escapeHtml(strVal)}</span>`;
      if (num)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(num)}</span>`;
      if (boolNull)
        return `<span class="text-[#569cd6] dark:text-[#569cd6] font-semibold">${escapeHtml(boolNull)}</span>`;
      if (spaces) return spaces;
      if (sym) return escapeHtml(sym);
      return escapeHtml(match);
    }
  );
}

function highlightPythonLine(line: string): string {
  // Comments, Strings, Keywords, Builtins, Numbers, Decorators, Functions, Identifiers, Spaces, symbols
  const regex =
    /(#.*$)|(f?["'](?:\\.|[^"'\\])*["'])|(\b(?:def|class|return|if|elif|else|for|while|try|except|finally|with|as|import|from|in|is|not|and|or|lambda|yield|raise|pass|break|continue|async|await|global|nonlocal|assert)\b)|(\b(?:True|False|None|self|cls|print|len|range|open|int|str|float|bool|list|dict|set|tuple|enumerate|zip|map|filter|type|isinstance|issubclass|super|sum|min|max|abs|any|all|sorted|reversed)\b)|(\b\d+(?:\.\d+)?\b)|(@[a-zA-Z_]\w*)|(\b[a-zA-Z_]\w*(?=\s*\())|([a-zA-Z_]\w*)|([^\s\w]+)|(\s+)/g;

  return line.replace(
    regex,
    (
      match,
      comment,
      str,
      kw,
      builtin,
      num,
      decorator,
      fnCall,
      _ident,
      _symbol,
      spaces
    ) => {
      if (comment)
        return `<span class="text-[#6a9955] dark:text-[#6a9955] italic">${escapeHtml(comment)}</span>`;
      if (str)
        return `<span class="text-[#ce9178] dark:text-[#ce9178]">${escapeHtml(str)}</span>`;
      if (kw)
        return `<span class="text-[#c586c0] dark:text-[#c586c0] font-semibold">${escapeHtml(kw)}</span>`;
      if (builtin)
        return `<span class="text-[#4ec9b0] dark:text-[#4ec9b0]">${escapeHtml(builtin)}</span>`;
      if (num)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(num)}</span>`;
      if (decorator)
        return `<span class="text-[#dcdcaa] dark:text-[#dcdcaa]">${escapeHtml(decorator)}</span>`;
      if (fnCall)
        return `<span class="text-[#dcdcaa] dark:text-[#dcdcaa]">${escapeHtml(fnCall)}</span>`;
      if (spaces) return spaces;
      return escapeHtml(match);
    }
  );
}

function highlightBashLine(line: string): string {
  // Comments, Strings, Variables ($VAR or ${VAR}), Keywords, Commands, Flags, Numbers, Spaces, symbols
  const regex =
    /(#.*$)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\$(?:\{[^}]+\}|[a-zA-Z_]\w*|[0-9?*!@#$]))|(\b(?:if|then|else|elif|fi|case|esac|for|while|until|do|done|in|function|select|time|return|exit|export|local|readonly|set|unset|shift|source)\b)|(\b(?:echo|printf|cd|pwd|ls|cat|mkdir|rm|cp|mv|grep|sed|awk|find|curl|wget|tar|zip|unzip|git|npm|pnpm|yarn|node|bun|deno|docker|sudo|chmod|chown)\b)|(-{1,2}[a-zA-Z0-9_\-]+)|(\b\d+\b)|(\s+)|([^\s])/g;

  return line.replace(
    regex,
    (
      match,
      comment,
      str,
      variable,
      kw,
      cmd,
      flag,
      num,
      spaces,
      sym
    ) => {
      if (comment)
        return `<span class="text-[#6a9955] dark:text-[#6a9955] italic">${escapeHtml(comment)}</span>`;
      if (str)
        return `<span class="text-[#ce9178] dark:text-[#ce9178]">${escapeHtml(str)}</span>`;
      if (variable)
        return `<span class="text-[#9cdcfe] dark:text-[#9cdcfe] font-medium">${escapeHtml(variable)}</span>`;
      if (kw)
        return `<span class="text-[#c586c0] dark:text-[#c586c0] font-semibold">${escapeHtml(kw)}</span>`;
      if (cmd)
        return `<span class="text-[#dcdcaa] dark:text-[#dcdcaa] font-medium">${escapeHtml(cmd)}</span>`;
      if (flag)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(flag)}</span>`;
      if (num)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(num)}</span>`;
      if (spaces) return spaces;
      if (sym) return escapeHtml(sym);
      return escapeHtml(match);
    }
  );
}

function highlightSqlLine(line: string): string {
  // Comments, Strings, Keywords, Functions, Numbers, Spaces, symbols
  const regex =
    /(--.*$|\/\*[\s\S]*?\*\/)|('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*")|(\b(?:SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN|LEFT|RIGHT|INNER|OUTER|CROSS|FULL|ON|GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|CREATE|ALTER|DROP|TABLE|VIEW|INDEX|DATABASE|SCHEMA|TRUNCATE|UNION|ALL|DISTINCT|AS|AND|OR|NOT|IN|IS|NULL|LIKE|ILIKE|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END|PRIMARY|KEY|FOREIGN|REFERENCES|DEFAULT|CHECK|UNIQUE|CONSTRAINT|CASCADE|ASC|DESC|WITH)\b)|(\b(?:COUNT|SUM|AVG|MIN|MAX|COALESCE|NOW|CURRENT_TIMESTAMP|UPPER|LOWER|TRIM|SUBSTRING|CONCAT|CAST|ROUND|DATE|YEAR|MONTH|DAY)\b)|(\b\d+(?:\.\d+)?\b)|(\s+)|([^\s])/gi;

  return line.replace(
    regex,
    (match, comment, str, kw, fn, num, spaces, sym) => {
      if (comment)
        return `<span class="text-[#6a9955] dark:text-[#6a9955] italic">${escapeHtml(comment)}</span>`;
      if (str)
        return `<span class="text-[#ce9178] dark:text-[#ce9178]">${escapeHtml(str)}</span>`;
      if (kw)
        return `<span class="text-[#569cd6] dark:text-[#569cd6] font-semibold">${escapeHtml(kw)}</span>`;
      if (fn)
        return `<span class="text-[#dcdcaa] dark:text-[#dcdcaa]">${escapeHtml(fn)}</span>`;
      if (num)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(num)}</span>`;
      if (spaces) return spaces;
      if (sym) return escapeHtml(sym);
      return escapeHtml(match);
    }
  );
}

function highlightYamlLine(line: string): string {
  // Comments, Keys, Strings, Booleans/null, Numbers, spaces, symbols
  const regex =
    /(#.*$)|(^[ \t]*[a-zA-Z0-9_\-]+(?=\s*:))|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(\b(?:true|false|null|yes|no|on|off)\b)|(\b\d+(?:\.\d+)?\b)|(\s+)|([^\s])/g;

  return line.replace(
    regex,
    (match, comment, key, str, boolNull, num, spaces, sym) => {
      if (comment)
        return `<span class="text-[#6a9955] dark:text-[#6a9955] italic">${escapeHtml(comment)}</span>`;
      if (key)
        return `<span class="text-[#9cdcfe] dark:text-[#9cdcfe] font-medium">${escapeHtml(key)}</span>`;
      if (str)
        return `<span class="text-[#ce9178] dark:text-[#ce9178]">${escapeHtml(str)}</span>`;
      if (boolNull)
        return `<span class="text-[#569cd6] dark:text-[#569cd6] font-semibold">${escapeHtml(boolNull)}</span>`;
      if (num)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(num)}</span>`;
      if (spaces) return spaces;
      if (sym) return escapeHtml(sym);
      return escapeHtml(match);
    }
  );
}

function highlightMarkdownLine(line: string): string {
  // Headings, blockquotes, lists, bold/italic, code, links
  if (/^#{1,6}\s+/.test(line)) {
    return `<span class="text-[#569cd6] font-semibold">${escapeHtml(line)}</span>`;
  }
  if (/^>\s+/.test(line)) {
    return `<span class="text-[#6a9955] italic">${escapeHtml(line)}</span>`;
  }
  if (/^\s*(?:[-*+]|\d+\.)\s+/.test(line)) {
    return line.replace(/^(\s*(?:[-*+]|\d+\.)\s+)(.*)$/, (_, bullet, rest) => {
      return `<span class="text-[#569cd6] font-bold">${escapeHtml(bullet)}</span>${escapeHtml(rest)}`;
    });
  }

  // Inline formatting
  const regex =
    /(`[^`]+`)|(\*\*[^*]+\*\*|__[^_]+__)|(\*[^*]+\*|_[^_]+_)|(!?\[[^\]]*\]\([^)]*\))|(\s+)|([^\s`*_!\[]+)/g;

  return line.replace(
    regex,
    (match, code, bold, italic, link, spaces, text) => {
      if (code)
        return `<span class="text-[#ce9178] font-mono bg-white/5 px-1 rounded">${escapeHtml(code)}</span>`;
      if (bold)
        return `<span class="font-bold text-white">${escapeHtml(bold)}</span>`;
      if (italic)
        return `<span class="italic text-neutral-300">${escapeHtml(italic)}</span>`;
      if (link)
        return `<span class="text-[#4ec9b0] underline">${escapeHtml(link)}</span>`;
      if (spaces) return spaces;
      if (text) return escapeHtml(text);
      return escapeHtml(match);
    }
  );
}

function highlightGenericLine(line: string): string {
  // Comments (// or # or /*), Strings, Numbers, Keywords, Functions, Identifiers, Spaces, symbols
  const regex =
    /(\/\/.*$|#.*$|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|(\b\d+(?:\.\d+)?\b)|(\b(?:fn|func|def|function|pub|public|private|static|class|struct|interface|impl|trait|enum|import|export|from|include|return|if|else|switch|case|break|continue|for|while|loop|match|try|catch|throw|new|const|let|var|mut|val|async|await|yield)\b)|(\b[a-zA-Z_]\w*(?=\s*\())|([a-zA-Z_]\w*)|(\s+)|([^\s\w]+)/g;

  return line.replace(
    regex,
    (match, comment, str, num, kw, fnCall, _ident, spaces, _sym) => {
      if (comment)
        return `<span class="text-[#6a9955] dark:text-[#6a9955] italic">${escapeHtml(comment)}</span>`;
      if (str)
        return `<span class="text-[#ce9178] dark:text-[#ce9178]">${escapeHtml(str)}</span>`;
      if (num)
        return `<span class="text-[#b5cea8] dark:text-[#b5cea8]">${escapeHtml(num)}</span>`;
      if (kw)
        return `<span class="text-[#c586c0] dark:text-[#c586c0] font-semibold">${escapeHtml(kw)}</span>`;
      if (fnCall)
        return `<span class="text-[#dcdcaa] dark:text-[#dcdcaa]">${escapeHtml(fnCall)}</span>`;
      if (spaces) return spaces;
      return escapeHtml(match);
    }
  );
}

/**
 * Highlights a single line according to file extension or language tag.
 */
export function highlightLine(line: string, languageOrExt: string): string {
  if (!line) return "";
  const ext = languageOrExt.replace(/^\./, "").toLowerCase();

  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "mjs":
    case "cjs":
      return highlightJsTsLine(line);

    case "html":
    case "htm":
    case "xml":
    case "svg":
    case "vue":
    case "svelte":
      return highlightHtmlLine(line);

    case "css":
    case "scss":
    case "less":
    case "sass":
      return highlightCssLine(line);

    case "json":
    case "jsonc":
    case "json5":
      return highlightJsonLine(line);

    case "py":
    case "pyw":
      return highlightPythonLine(line);

    case "sh":
    case "bash":
    case "zsh":
      return highlightBashLine(line);

    case "sql":
      return highlightSqlLine(line);

    case "yaml":
    case "yml":
      return highlightYamlLine(line);

    case "md":
    case "markdown":
      return highlightMarkdownLine(line);

    case "rs":
    case "go":
    case "c":
    case "cpp":
    case "h":
    case "hpp":
    case "cc":
    case "cs":
    case "java":
    case "kt":
    case "kts":
    case "dart":
    case "php":
    case "rb":
    case "toml":
    case "ini":
    case "env":
      return highlightGenericLine(line);

    default:
      return escapeHtml(line);
  }
}

/**
 * Returns an array of HTML strings, one for each line in code.
 * Guaranteed to match line-for-line with code.split(/\r?\n/).
 */
export function highlightCodeToHtmlLines(
  code: string,
  filenameOrExt: string
): string[] {
  if (!code && code !== "") return [];
  const ext = filenameOrExt.includes(".")
    ? filenameOrExt.split(".").pop()?.toLowerCase() || ""
    : filenameOrExt.toLowerCase();

  const rawLines = code.split(/\r?\n/);
  return rawLines.map((line) => {
    if (!line) return "";
    return highlightLine(line, ext);
  });
}

/**
 * Backwards-compatible function for SkillCodeViewer in skills-settings.tsx.
 * Produces full table row HTML elements.
 */
export function highlightCodeLines(code: string, filename: string): string {
  const lines = highlightCodeToHtmlLines(code, filename);

  return lines
    .map((highlighted, idx) => {
      return `<div class="table-row hover:bg-[#252528] transition-colors leading-5"><span class="table-cell select-none pr-4 text-right text-[11px] text-[#5d5d5d] font-mono w-10">${
        idx + 1
      }</span><span class="table-cell select-text text-xs font-mono text-[#d4d4d4] whitespace-pre">${
        highlighted || "&nbsp;"
      }</span></div>`;
    })
    .join("");
}

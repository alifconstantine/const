import React from "react";

/**
 * VS Code Seti Icon Theme:
 * - JSON (*.json, package.json): {} in yellow/gold
 * - React (*.tsx, *.jsx): Cyan atom
 * - TypeScript (*.ts, tailwind.config.ts): TS in cyan/blue text
 * - JavaScript (*.js, *.mjs, postcss.config.mjs): JS in yellow text
 * - HTML (*.html): <> in orange/red
 * - CSS (*.css): # in cyan/blue
 * - SCSS/Sass (*.scss, *.sass): # in pink
 * - Markdown (*.md): Blue downward arrow ↓
 * - Vite config (*vite.config.*): Yellow lightning bolt ⚡
 * - YAML (*.yaml, *.yml): Exclamation mark ! in purple
 * - Git (*.gitignore, .git): Git diamond
 * - Shell / Batch (*.bat, *.cmd, *.sh, *.bash): >_ prompt
 * - Python (*.py): Python glyph
 * - Rust (*.rs): RS
 * - Go (*.go): GO
 * - SQL (*.sql): SQL
 * - Images: 🖼
 */
export function FileIcon({
  filename,
  className = "w-3.5 h-3.5",
}: {
  filename: string;
  className?: string;
}) {
  const lower = filename.toLowerCase().trim();
  const basename = lower.replace(/\\/g, "/").split("/").filter(Boolean).pop() || lower;
  const ext = basename.includes(".") ? basename.split(".").pop() || "" : "";

  // 1. Vite Config -> Yellow Lightning Bolt ⚡
  if (basename.startsWith("vite.config")) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center text-xs font-bold leading-none select-none text-[#ffd700] shrink-0`}
        title={filename}
      >
        ⚡
      </span>
    );
  }

  // 2. README.md -> Blue Info Circle ⓘ
  if (basename === "readme.md" || basename === "readme") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center text-[11px] font-bold leading-none select-none text-[#519aba] shrink-0`}
        title={filename}
      >
        ⓘ
      </span>
    );
  }

  // 3. JSON files (*.json, package.json, tsconfig.base.json, turbo.json, etc.) -> {} in yellow/gold
  if (ext === "json" || basename.endsWith(".json")) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[11px] leading-none select-none text-[#cbcb41] shrink-0`}
        title={filename}
      >
        {"{}"}
      </span>
    );
  }

  // 4. YAML files (*.yaml, *.yml, pnpm-lock.yaml, pnpm-workspace.yaml) -> ! in purple/magenta
  if (ext === "yaml" || ext === "yml" || basename.includes("pnpm-lock") || basename.includes("pnpm-workspace")) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[12px] leading-none select-none text-[#c678dd] shrink-0`}
        title={filename}
      >
        !
      </span>
    );
  }

  // 5. React TSX / JSX -> Cyan Atom
  if (ext === "tsx" || ext === "jsx") {
    return (
      <svg
        viewBox="-11.5 -10.23174 23 20.46348"
        className={`${className} text-[#00d8ff] shrink-0 inline-block`}
        fill="currentColor"
      >
        <circle cx="0" cy="0" r="2.05" fill="#00d8ff" />
        <g stroke="#00d8ff" strokeWidth="1.2" fill="none">
          <ellipse rx="11" ry="4.2" />
          <ellipse rx="11" ry="4.2" transform="rotate(60)" />
          <ellipse rx="11" ry="4.2" transform="rotate(120)" />
        </g>
      </svg>
    );
  }

  // 6. TypeScript (*.ts, tailwind.config.ts, vite-env.d.ts) -> TS in blue/cyan text
  if (ext === "ts" || ext === "mts" || ext === "cts") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[9.5px] tracking-tighter leading-none select-none text-[#519aba] shrink-0`}
        title={filename}
      >
        TS
      </span>
    );
  }

  // 7. JavaScript (*.js, *.mjs, postcss.config.mjs) -> JS in yellow text
  if (ext === "js" || ext === "mjs" || ext === "cjs") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[9.5px] tracking-tighter leading-none select-none text-[#cbcb41] shrink-0`}
        title={filename}
      >
        JS
      </span>
    );
  }

  // 8. HTML (*.html, *.htm) -> <> in orange
  if (ext === "html" || ext === "htm") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[10px] leading-none select-none text-[#e34c26] shrink-0`}
        title={filename}
      >
        {"<>"}
      </span>
    );
  }

  // 9. CSS (*.css) -> # in cyan/blue
  if (ext === "css") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[11px] leading-none select-none text-[#519aba] shrink-0`}
        title={filename}
      >
        #
      </span>
    );
  }

  // 10. SCSS / Sass (*.scss, *.sass) -> # in pink
  if (ext === "scss" || ext === "sass") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[11px] leading-none select-none text-[#f06292] shrink-0`}
        title={filename}
      >
        #
      </span>
    );
  }

  // 11. Markdown (*.md, arsitektur.md, DESIGN.md) -> Blue downward arrow ↓
  if (ext === "md" || ext === "markdown" || ext === "mdx") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-bold text-[11px] leading-none select-none text-[#519aba] shrink-0`}
        title={filename}
      >
        ↓
      </span>
    );
  }

  // 12. Git (*.gitignore, .gitattributes) -> Git diamond
  if (basename.startsWith(".git")) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-bold text-[11px] leading-none select-none text-[#f34f29] shrink-0`}
        title={filename}
      >
        ◈
      </span>
    );
  }

  // 13. Windows Batch / Cmd (*.bat, *.cmd) -> >_ prompt
  if (ext === "bat" || ext === "cmd") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[9px] leading-none select-none text-[#409D62] shrink-0`}
        title={filename}
      >
        &gt;_
      </span>
    );
  }

  // 14. Shell / PowerShell (*.sh, *.bash, *.zsh, *.ps1) -> >_ prompt
  if (ext === "sh" || ext === "bash" || ext === "zsh" || ext === "ps1") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[9px] leading-none select-none text-[#409D62] shrink-0`}
        title={filename}
      >
        &gt;_
      </span>
    );
  }

  // 15. Python (*.py, *.pyw) -> Python glyph
  if (ext === "py" || ext === "pyw") {
    return (
      <svg viewBox="0 0 16 16" className={`${className} shrink-0 inline-block`}>
        <path
          d="M7.9 1C5.2 1 5.3 2.2 5.3 2.2V3.4H8V3.8H4.3C2.8 3.8 1.6 4.9 1.6 6.8C1.6 8.7 2.6 8.8 3.3 8.8H4.2V7.6C4.2 6.2 5.4 5 6.8 5H9.4C10.5 5 11.4 4.1 11.4 3V1.8C11.4 1.8 10.6 1 7.9 1ZM6.2 2.1C6.6 2.1 6.9 2.4 6.9 2.8C6.9 3.2 6.6 3.5 6.2 3.5C5.8 3.5 5.5 3.2 5.5 2.8C5.5 2.4 5.8 2.1 6.2 2.1Z"
          fill="#3776ab"
        />
        <path
          d="M8.1 15C10.8 15 10.7 13.8 10.7 13.8V12.6H8V12.2H11.7C13.2 12.2 14.4 11.1 14.4 9.2C14.4 7.3 13.4 7.2 12.7 7.2H11.8V8.4C11.8 9.8 10.6 11 9.2 11H6.6C5.5 11 4.6 11.9 4.6 13V14.2C4.6 14.2 5.4 15 8.1 15ZM9.8 13.9C9.4 13.9 9.1 13.6 9.1 13.2C9.1 12.8 9.4 12.5 9.8 12.5C10.2 12.5 10.5 12.8 10.5 13.2C10.5 13.6 10.2 13.9 9.8 13.9Z"
          fill="#ffd438"
        />
      </svg>
    );
  }

  // 16. Environment (*.env, *.env.*) -> Key / gear
  if (basename.startsWith(".env")) {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[10px] leading-none select-none text-[#e5c07b] shrink-0`}
        title={filename}
      >
        ⚙
      </span>
    );
  }

  // 17. SQL (*.sql)
  if (ext === "sql") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[9px] leading-none select-none text-[#519aba] shrink-0`}
        title={filename}
      >
        SQL
      </span>
    );
  }

  // 18. Rust (*.rs)
  if (ext === "rs") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[9.5px] leading-none select-none text-[#dea584] shrink-0`}
        title={filename}
      >
        RS
      </span>
    );
  }

  // 19. Go (*.go)
  if (ext === "go") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center font-mono font-bold text-[9.5px] leading-none select-none text-[#00add8] shrink-0`}
        title={filename}
      >
        GO
      </span>
    );
  }

  // 20. Images (*.png, *.jpg, *.jpeg, *.svg, *.webp, *.ico)
  if (ext === "svg" || ext === "png" || ext === "jpg" || ext === "jpeg" || ext === "gif" || ext === "webp" || ext === "ico") {
    return (
      <span
        className={`${className} inline-flex items-center justify-center text-[11px] leading-none select-none text-[#409D62] shrink-0`}
        title={filename}
      >
        🖼
      </span>
    );
  }

  // Default File
  return (
    <span
      className={`${className} inline-flex items-center justify-center text-[10px] leading-none select-none text-[#777777] shrink-0`}
      title={filename}
    >
      •
    </span>
  );
}

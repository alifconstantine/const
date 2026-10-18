import React from "react";
import {
  FileText,
  FileCode,
  Terminal,
  FileSpreadsheet,
  FileArchive,
  Image as ImageIcon,
  Music,
  Video,
} from "lucide-react";
import {
  Python,
  Java,
  Html5,
  Markdown,
  Typescript,
  Javascript,
  React as ReactIcon,
  Css3,
  Sass,
  Cplusplus,
  C,
  Csharp,
  Go,
  Rust,
  Php,
  Ruby,
  Kotlin,
  Swift,
  Dart,
  Flutter,
  Sqlite,
  GnuBash,
  Powershell,
  Git,
  Json,
  Yaml,
  Docker,
  Vite,
  Pnpm,
  Vue,
  Svelte,
  Astro,
  Graphql,
  Prisma,
  Lua,
  Zig,
  R,
  Scala,
  Elixir,
  Haskell,
  Solidity,
} from "@thesvg/react";

/**
 * File & Programming Language Brand Icons powered by @thesvg/react
 */
export function FileIcon({
  filename,
  className = "w-3.5 h-3.5",
  fallbackIcon,
}: {
  filename: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}) {
  const lower = filename.toLowerCase().trim();
  const basename = lower.replace(/\\/g, "/").split("/").filter(Boolean).pop() || lower;
  const ext = basename.includes(".") ? basename.split(".").pop() || "" : basename;

  const renderIcon = () => {
    // 1. Vite Config -> Official Vite logo
    if (basename.startsWith("vite.config") || ext === "vite") {
      return <Vite className="w-full h-full shrink-0" />;
    }

    // 2. pnpm files (pnpm-lock.yaml, pnpm-workspace.yaml) -> Official pnpm logo
    if (basename.includes("pnpm-lock") || basename.includes("pnpm-workspace") || ext === "pnpm") {
      return <Pnpm className="w-full h-full shrink-0" />;
    }

    // 3. Docker files (Dockerfile, docker-compose.yml, *.dockerfile) -> Official Docker logo
    if (basename === "dockerfile" || basename.startsWith("docker-compose") || ext === "dockerfile" || ext === "docker") {
      return <Docker className="w-full h-full shrink-0" />;
    }

    // 4. Git (*.gitignore, .gitattributes, .gitmodules, .git) -> Official Git diamond
    if (basename.startsWith(".git") || ext === "git") {
      return <Git className="w-full h-full shrink-0" />;
    }

    // 5. JSON (*.json, *.jsonc, *.json5, tsconfig.json) -> Official JSON logo
    if (ext === "json" || ext === "jsonc" || ext === "json5" || basename.endsWith(".json")) {
      return <Json className="w-full h-full shrink-0" />;
    }

    // 6. YAML (*.yaml, *.yml) -> Official YAML logo
    if (ext === "yaml" || ext === "yml") {
      return <Yaml className="w-full h-full shrink-0" />;
    }

    // 7. React TSX / JSX -> React Atom with cyan branding
    if (ext === "tsx" || ext === "jsx" || ext === "react") {
      return <ReactIcon className="w-full h-full text-[#00d8ff] shrink-0" />;
    }

    // 8. TypeScript (*.ts, *.mts, *.cts) -> Official TypeScript badge
    if (ext === "ts" || ext === "mts" || ext === "cts" || ext === "typescript") {
      return <Typescript className="w-full h-full shrink-0" />;
    }

    // 9. JavaScript (*.js, *.mjs, *.cjs) -> Official JavaScript badge
    if (ext === "js" || ext === "mjs" || ext === "cjs" || ext === "javascript") {
      return <Javascript className="w-full h-full shrink-0" />;
    }

    // 10. HTML (*.html, *.htm) -> Official HTML5 shield
    if (ext === "html" || ext === "htm") {
      return <Html5 className="w-full h-full shrink-0" />;
    }

    // 11. CSS (*.css) -> Official CSS3 shield
    if (ext === "css") {
      return <Css3 className="w-full h-full shrink-0" />;
    }

    // 12. SCSS / Sass (*.scss, *.sass) -> Official Sass logo
    if (ext === "scss" || ext === "sass") {
      return <Sass className="w-full h-full shrink-0" />;
    }

    // 13. Markdown (*.md, *.markdown, *.mdx) -> Official Markdown badge in BLUE (User Request)
    if (ext === "md" || ext === "markdown" || ext === "mdx" || basename === "readme") {
      return (
        <Markdown
          variant="mono"
          className="w-full h-full text-blue-500 dark:text-blue-400 shrink-0 fill-current"
        />
      );
    }

    // 14. Python (*.py, *.pyw) -> Official Python blue & yellow logo
    if (ext === "py" || ext === "pyw" || ext === "python") {
      return <Python className="w-full h-full shrink-0" />;
    }

    // 15. Java (*.java, *.jar, *.class) -> Official Java coffee cup
    if (ext === "java" || ext === "jar" || ext === "class") {
      return <Java className="w-full h-full shrink-0" />;
    }

    // 16. C++ (*.cpp, *.cxx, *.cc, *.hpp, *.h) -> Official C++ logo
    if (ext === "cpp" || ext === "cxx" || ext === "cc" || ext === "c++" || ext === "hpp") {
      return <Cplusplus className="w-full h-full shrink-0" />;
    }

    // 17. C (*.c) -> Official C logo
    if (ext === "c") {
      return <C className="w-full h-full shrink-0" />;
    }

    // 18. C# (*.cs) -> Official C# logo
    if (ext === "cs" || ext === "csharp" || ext === "c#") {
      return <Csharp className="w-full h-full shrink-0" />;
    }

    // 19. Go (*.go) -> Official Go cyan logo
    if (ext === "go" || ext === "golang") {
      return <Go className="w-full h-full shrink-0" />;
    }

    // 20. Rust (*.rs) -> Official Rust gear
    if (ext === "rs" || ext === "rust") {
      return (
        <Rust
          variant="mono"
          className="w-full h-full text-orange-600 dark:text-orange-400 shrink-0 fill-current"
        />
      );
    }

    // 21. PHP (*.php) -> Official PHP logo
    if (ext === "php") {
      return <Php className="w-full h-full shrink-0" />;
    }

    // 22. Ruby (*.rb) -> Official Ruby red gem
    if (ext === "rb" || ext === "ruby") {
      return <Ruby className="w-full h-full shrink-0" />;
    }

    // 23. Kotlin (*.kt, *.kts) -> Official Kotlin gradient logo
    if (ext === "kt" || ext === "kts" || ext === "kotlin") {
      return <Kotlin className="w-full h-full shrink-0" />;
    }

    // 24. Swift (*.swift) -> Official Swift orange bird
    if (ext === "swift") {
      return <Swift className="w-full h-full shrink-0" />;
    }

    // 25. Dart / Flutter (*.dart) -> Official Dart logo
    if (ext === "dart") {
      return <Dart className="w-full h-full shrink-0" />;
    }
    if (ext === "flutter") {
      return <Flutter className="w-full h-full shrink-0" />;
    }

    // 26. Vue (*.vue) -> Official Vue logo
    if (ext === "vue") {
      return <Vue className="w-full h-full shrink-0" />;
    }

    // 27. Svelte (*.svelte) -> Official Svelte logo
    if (ext === "svelte") {
      return <Svelte className="w-full h-full shrink-0" />;
    }

    // 28. Astro (*.astro) -> Official Astro logo
    if (ext === "astro") {
      return <Astro className="w-full h-full shrink-0" />;
    }

    // 29. GraphQL (*.graphql, *.gql) -> Official GraphQL logo
    if (ext === "graphql" || ext === "gql") {
      return <Graphql className="w-full h-full shrink-0" />;
    }

    // 30. Prisma (*.prisma) -> Official Prisma logo
    if (ext === "prisma") {
      return <Prisma className="w-full h-full shrink-0" />;
    }

    // 31. Lua (*.lua) -> Official Lua logo
    if (ext === "lua") {
      return <Lua className="w-full h-full shrink-0" />;
    }

    // 32. Zig (*.zig) -> Official Zig logo
    if (ext === "zig") {
      return <Zig className="w-full h-full shrink-0" />;
    }

    // 33. R (*.r, *.rmd) -> Official R logo
    if (ext === "r" || ext === "rmd") {
      return <R className="w-full h-full shrink-0" />;
    }

    // 34. Scala (*.scala) -> Official Scala logo
    if (ext === "scala") {
      return <Scala className="w-full h-full shrink-0" />;
    }

    // 35. Elixir (*.ex, *.exs) -> Official Elixir logo
    if (ext === "ex" || ext === "exs" || ext === "elixir") {
      return <Elixir className="w-full h-full shrink-0" />;
    }

    // 36. Haskell (*.hs) -> Official Haskell logo
    if (ext === "hs" || ext === "haskell") {
      return <Haskell className="w-full h-full shrink-0" />;
    }

    // 37. Solidity (*.sol) -> Official Solidity logo
    if (ext === "sol" || ext === "solidity") {
      return <Solidity className="w-full h-full shrink-0" />;
    }

    // 38. SQL (*.sql, *.sqlite, *.pgsql) -> SQLite / Database logo
    if (ext === "sql" || ext === "sqlite" || ext === "sqlite3" || ext === "pgsql" || ext === "mysql") {
      return <Sqlite className="w-full h-full shrink-0" />;
    }

    // 39. Shell / Bash (*.sh, *.bash, *.zsh) -> GNU Bash terminal green
    if (ext === "sh" || ext === "bash" || ext === "zsh") {
      return <GnuBash className="w-full h-full shrink-0" />;
    }

    // 40. PowerShell / Windows Batch (*.ps1, *.psm1, *.bat, *.cmd) -> Official PowerShell logo
    if (ext === "ps1" || ext === "psm1" || ext === "powershell" || ext === "bat" || ext === "cmd") {
      return <Powershell className="w-full h-full shrink-0" />;
    }

    // 41. Generic Console / Terminal tags
    if (ext === "terminal" || ext === "console" || ext === "shell" || ext === "prompt") {
      return <Terminal className="w-full h-full text-amber-500" />;
    }

    // 42. Environment (*.env, *.env.*) -> Key / gear
    if (basename.startsWith(".env")) {
      return (
        <span className="font-mono font-bold text-[10px] leading-none text-[#e5c07b]">
          ⚙
        </span>
      );
    }

    // 43. Spreadsheets (*.csv, *.tsv, *.xlsx, *.xls)
    if (["csv", "tsv", "xlsx", "xls"].includes(ext)) {
      return <FileSpreadsheet className="w-full h-full text-emerald-500" />;
    }

    // 44. Archives (*.zip, *.tar, *.gz, *.rar, *.7z)
    if (["zip", "tar", "gz", "rar", "7z"].includes(ext)) {
      return <FileArchive className="w-full h-full text-amber-500" />;
    }

    // 45. Images (*.png, *.jpg, *.jpeg, *.svg, *.webp, *.ico, *.gif)
    if (["svg", "png", "jpg", "jpeg", "gif", "webp", "ico"].includes(ext)) {
      return <ImageIcon className="w-full h-full text-[#409D62]" />;
    }

    // 46. Audio (*.mp3, *.wav, *.m4a, *.ogg, *.flac)
    if (["mp3", "wav", "m4a", "ogg", "flac"].includes(ext)) {
      return <Music className="w-full h-full text-purple-400" />;
    }

    // 47. Video (*.mp4, *.mkv, *.avi, *.mov, *.webm)
    if (["mp4", "mkv", "avi", "mov", "webm"].includes(ext)) {
      return <Video className="w-full h-full text-rose-400" />;
    }

    // 48. Explicit user-provided fallback
    if (fallbackIcon) {
      return <>{fallbackIcon}</>;
    }

    // 49. Generic Code fallback (if it's a code block language or code-like extension)
    if (
      ["code", "text", "txt", "plain", "plaintext"].includes(ext) ||
      !basename.includes(".")
    ) {
      return <FileCode className="w-full h-full text-muted-foreground" />;
    }

    // 50. Default generic FileText fallback
    return <FileText className="w-full h-full text-muted-foreground" />;
  };

  return (
    <span
      className={`${className} inline-flex items-center justify-center shrink-0 select-none`}
      title={filename}
    >
      {renderIcon()}
    </span>
  );
}

/**
 * Helper component to render language logo from a programming language name
 */
export function LanguageIcon({
  language,
  className = "w-3.5 h-3.5",
  fallbackIcon,
}: {
  language: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}) {
  return <FileIcon filename={language} className={className} fallbackIcon={fallbackIcon} />;
}

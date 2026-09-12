import {
  ConstLogoIcon,
  Avatar,
  AvatarImage,
  AvatarFallback,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  useTheme,
  Input,
} from "@const/ui";
import {
  Settings,
  LogOut,
  User as UserIcon,
  ArrowLeftRight,
  Sun,
  Moon,
  Laptop,
  Search,
  X,
} from "lucide-react";

export interface UserProfile {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: string | null;
}

interface NavbarProps {
  user?: UserProfile | null;
  onSignOut: () => void;
  onSwitchAccount?: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  isSearchOpen?: boolean;
  onToggleSearch?: () => void;
}

export function getUserInitials(name?: string | null, email?: string | null): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    const first = parts[0];
    const last = parts.length > 1 ? parts[parts.length - 1] : undefined;
    if (first) {
      if (last && last[0]) {
        return (first[0] + last[0]).toUpperCase();
      }
      return first.substring(0, 2).toUpperCase();
    }
  }
  if (email && email.trim()) {
    const parts = email.trim().split("@");
    const username = parts[0];
    if (username && username.length > 0) {
      return username.substring(0, 2).toUpperCase();
    }
  }
  return "U";
}

export function Navbar({
  user,
  onSignOut,
  onSwitchAccount,
  searchQuery = "",
  onSearchChange,
  isSearchOpen = false,
  onToggleSearch,
}: NavbarProps) {
  const initials = getUserInitials(user?.name, user?.email);
  const [theme, setTheme] = useTheme();

  return (
    <header className="sticky top-0 w-full h-14 border-b border-border/70 bg-background/95 backdrop-blur-md px-3.5 flex items-center justify-between select-none z-40">
      {isSearchOpen ? (
        <div className="w-full flex items-center gap-2 animate-in fade-in duration-150">
          <div className="relative flex-1 flex items-center">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              placeholder="Search notebooks, collections..."
              className="h-9 w-full pl-9 pr-8 text-xs rounded-full bg-secondary/60 border-border/70 focus-visible:ring-1"
              autoFocus
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange?.("")}
                className="absolute right-2.5 p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onToggleSearch}
            className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground cursor-pointer font-medium"
          >
            Cancel
          </button>
        </div>
      ) : (
        <>
          {/* Left: Const Logo & Product Title */}
          <div className="flex items-center gap-2">
            <ConstLogoIcon size="sm" className="w-5 h-5 text-foreground shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="font-sans font-semibold text-base tracking-tight text-foreground">
                Const
              </span>
              <span className="text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
                Learn
              </span>
            </div>
          </div>

          {/* Middle Spacer */}
          <div className="flex-1" />

          {/* Right: Search button & User Account Avatar */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleSearch}
              className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-secondary active:bg-secondary/80 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="relative flex items-center justify-center rounded-full outline-none ring-offset-background transition-all hover:ring-2 hover:ring-ring/20 focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none p-0.5"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8 rounded-full border border-border/70 transition-transform active:scale-95">
                    {user?.image ? (
                      <AvatarImage
                        src={user.image}
                        alt={user.name || "Avatar"}
                        referrerPolicy="no-referrer"
                      />
                    ) : null}
                    <AvatarFallback className="bg-secondary text-secondary-foreground font-sans text-xs font-medium">
                      {user === undefined ? (
                        <UserIcon className="h-3.5 w-3.5 text-muted-foreground animate-pulse" />
                      ) : (
                        initials
                      )}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56 p-1.5 shadow-md mr-1">
            {(user?.name || user?.email) && (
              <>
                <div className="px-2 py-1.5">
                  {user.name && (
                    <p className="text-xs font-semibold text-foreground truncate">
                      {user.name}
                    </p>
                  )}
                  {user.email && (
                    <p className="text-[11px] text-muted-foreground truncate">
                      {user.email}
                    </p>
                  )}
                </div>
                <DropdownMenuSeparator />
              </>
            )}

            {/* App Theme (Segmented Control) */}
            <div className="px-2 py-1.5 flex flex-col gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1.5">
                {theme === "dark" ? (
                  <Moon className="h-3.5 w-3.5" />
                ) : theme === "light" ? (
                  <Sun className="h-3.5 w-3.5" />
                ) : (
                  <Laptop className="h-3.5 w-3.5" />
                )}
                Theme
              </span>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-secondary/80 border border-border/50">
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    theme === "system"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Laptop className="h-3 w-3" />
                  <span>System</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    theme === "light"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Sun className="h-3 w-3" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-md text-[11px] font-medium transition-all cursor-pointer ${
                    theme === "dark"
                      ? "bg-background text-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Moon className="h-3 w-3" />
                  <span>Dark</span>
                </button>
              </div>
            </div>

            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                // Settings placeholder: intentionally does nothing
              }}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            {onSwitchAccount && (
              <DropdownMenuItem
                className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2 text-muted-foreground hover:text-foreground"
                onClick={onSwitchAccount}
              >
                <ArrowLeftRight className="h-4 w-4" />
                <span>Switch account</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              className="cursor-pointer flex items-center gap-2 text-xs py-2 px-2 text-destructive focus:text-destructive"
              onClick={onSignOut}
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </>
  )}
</header>
);
}

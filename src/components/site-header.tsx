export function SiteHeader() {
  return (
    <header className="flex min-h-24 items-center justify-between gap-6 border-b border-border">
      <a href="#" className="flex min-h-11 items-center gap-3 rounded-sm" aria-label="Aosser home">
        <img src="/favicon.svg" width={36} height={36} alt="" />
        <span className="text-2xl font-extrabold tracking-tight">
          Aosser<span className="text-sage">.</span>
        </span>
      </a>
      <nav
        aria-label="Main navigation"
        className="flex items-center gap-5 text-sm font-semibold sm:gap-8"
      >
        <a
          href="#workspace"
          className="hidden min-h-11 items-center text-muted transition-colors hover:text-fg sm:inline-flex"
        >
          Workspace
        </a>
        <a
          href="#formats"
          className="hidden min-h-11 items-center text-muted transition-colors hover:text-fg sm:inline-flex"
        >
          Supported files
        </a>
      </nav>
    </header>
  );
}

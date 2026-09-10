const links = [
  { href: "#services", label: "Services" },
  { href: "#process", label: "Process" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-12 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <a href="#top" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
            Zaane
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          </a>
          <p className="mt-2 max-w-xs text-sm text-muted">
            Software, apps, and business systems built to run.
          </p>
        </div>

        <nav className="flex flex-wrap gap-6">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="border-t border-border px-6 py-6">
        <p className="mx-auto max-w-6xl text-xs text-muted">
          © {year} Zaane. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

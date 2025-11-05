'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { UserMenu } from './user-menu';
import { ThemeToggle } from './theme-toggle';
import { MobileNav } from './mobile-nav';
import { CommandMenu } from './command-menu';
import { ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const pathLabels: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  workflows: 'Workflows',
  agents: 'Agents',
  settings: 'Settings',
  new: 'New',
};

export function Header() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const segments = pathname.split('/').filter(Boolean);

  // Generate breadcrumbs
  const breadcrumbs = segments.map((segment, index) => {
    const path = '/' + segments.slice(0, index + 1).join('/');
    const label = pathLabels[segment] || segment;
    return { label, path };
  });

  return (
    <header className="flex h-16 items-center justify-between border-b bg-background px-4 lg:px-6">
      {/* Mobile menu button - visible on small screens */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <MobileNav onNavigate={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs - hidden on small screens */}
      <div className="hidden md:flex items-center gap-2 text-sm">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
            {index === breadcrumbs.length - 1 ? (
              <span className="font-medium text-foreground">{crumb.label}</span>
            ) : (
              <Link
                href={crumb.path}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {crumb.label}
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Command menu - centered on large screens */}
      <div className="hidden lg:flex flex-1 justify-center px-6">
        <div className="w-full max-w-sm">
          <CommandMenu />
        </div>
      </div>

      {/* Spacer for mobile */}
      <div className="flex-1 lg:hidden" />

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {/* Future: Notifications bell icon */}
        <UserMenu />
      </div>
    </header>
  );
}

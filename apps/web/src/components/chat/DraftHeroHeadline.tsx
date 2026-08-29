interface DraftHeroHeadlineProps {
  readonly activeProjectTitle: string | null;
}

/**
 * Nero has exactly one project per workspace (the workspace itself), so the
 * T3 project switcher collapsed into a static headline.
 */
export function DraftHeroHeadline({ activeProjectTitle }: DraftHeroHeadlineProps) {
  return (
    <h1 className="mx-auto w-full max-w-5xl text-center font-normal text-2xl text-foreground tracking-tight sm:text-3xl">
      What should we build in {activeProjectTitle ?? "this workspace"}?
    </h1>
  );
}

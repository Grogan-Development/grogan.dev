import Link from "next/link";
import { Card } from "./Card";

type CardItem = {
  title: string;
  description?: string;
  href?: string;
  /** Optional mono eyebrow (e.g. index or category) */
  label?: string;
};

type CardGridProps = {
  items: CardItem[];
  columns?: 2 | 3;
};

export function CardGrid({ items, columns = 2 }: CardGridProps) {
  const gridClass =
    columns === 3 ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4 sm:grid-cols-2";

  return (
    <div className={gridClass}>
      {items.map((item) => {
        const body = (
          <>
            {item.label ? (
              <span className="font-mono text-[length:var(--text-label)] uppercase tracking-wider text-muted">
                {item.label}
              </span>
            ) : null}
            <h3
              className={`font-display text-[length:var(--text-h3)] text-ink group-hover:text-accent ${
                item.label ? "mt-2" : ""
              }`}
            >
              {item.title}
            </h3>
            {item.description ? (
              <p className="mt-2 line-clamp-3 font-sans text-[length:var(--text-small)] leading-snug text-muted">
                {item.description}
              </p>
            ) : null}
          </>
        );

        if (item.href) {
          return (
            <Link
              key={item.title}
              href={item.href}
              className="group block min-h-[var(--tap-min)] focus-visible:outline-none"
            >
              <Card className="h-full transition-colors group-hover:border-ink group-focus-visible:border-accent">
                {body}
              </Card>
            </Link>
          );
        }

        return (
          <Card key={item.title} className="h-full">
            {body}
          </Card>
        );
      })}
    </div>
  );
}

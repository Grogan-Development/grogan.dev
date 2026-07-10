import type { SVGProps } from "react";
import {
  Briefcase,
  Grape,
  HardHat,
  Settings2,
  SquareStack,
  Wrench,
} from "lucide-react";

type MarkProps = SVGProps<SVGSVGElement>;

const stroke = { strokeWidth: 1.5 as const };

/** Monoline industry marks — not emoji, not rounded-full pills. */

export function ContractorsMark(props: MarkProps) {
  return <HardHat aria-hidden {...stroke} {...props} />;
}

export function ManufacturingMark(props: MarkProps) {
  return <Settings2 aria-hidden {...stroke} {...props} />;
}

export function SignShopMark(props: MarkProps) {
  return <SquareStack aria-hidden {...stroke} {...props} />;
}

export function HospitalityMark(props: MarkProps) {
  return <Grape aria-hidden {...stroke} {...props} />;
}

export function ProfessionalMark(props: MarkProps) {
  return <Briefcase aria-hidden {...stroke} {...props} />;
}

export function ServiceMark(props: MarkProps) {
  return <Wrench aria-hidden {...stroke} {...props} />;
}

export const industryMarkBySlug = {
  "contractors-home-services": ContractorsMark,
  "manufacturing-fabrication": ManufacturingMark,
  "sign-print-wrap-cnc-shops": SignShopMark,
  "wineries-events-hospitality": HospitalityMark,
  "professional-offices": ProfessionalMark,
  "local-service-businesses": ServiceMark,
} as const;

export type IndustryMarkSlug = keyof typeof industryMarkBySlug;

type IndustryMarkProps = MarkProps & {
  slug: string;
  className?: string;
};

/** Resolve a monoline mark for an industry slug; falls back to wrench. */
export function IndustryMark({
  slug,
  className = "h-6 w-6 text-ink",
  ...props
}: IndustryMarkProps) {
  const Mark =
    slug in industryMarkBySlug
      ? industryMarkBySlug[slug as IndustryMarkSlug]
      : ServiceMark;
  return <Mark className={className} {...props} />;
}

# Photography release manifest

No approved photography, founder portrait, source attribution, license, model/property release, or social-image derivative is currently supplied. Every record in `lib/images.ts` therefore remains `awaiting-approval` with `src`, `source`, and `license` set to `null`; the site intentionally renders non-photographic slots instead of generated art.

## Release requirements

Before a record can change to `released`, the owner must provide the original file outside this deployed tree and record all of the following in the image manifest:

- a real local source file at the target path below (not AI-generated or an unverified stock substitute);
- source/creator or owner attribution;
- the license or written usage authorization for web and social distribution;
- written releases for identifiable people, private property, and client work where applicable; and
- a reviewed crop, `objectPosition`, alt text, and caption.

Store release evidence with the business records, not in the public repository. A source file alone is not a release.

## Required derivatives

| Manifest record | Target path after release | Delivery specification |
| --- | --- | --- |
| `hero` | `public/photography/hero-tri-cities-operations.jpg` | Real Tri-Cities operations photography; 2400 × 1600 px minimum (3:2); approved crop must tolerate the responsive hero frame. Decorative alt remains empty. |
| `founder` | `public/photography/founder-operations.jpg` | Founder portrait; 1600 × 2133 px minimum (3:4); use the descriptive manifest alt only after release. |
| `industry-*` (six records) | `public/photography/industries/<industry-slug>.jpg` | One rights-cleared contextual photograph per industry; 1600 × 1200 px minimum (4:3); these tiles are already labelled, so their alt remains empty. |
| `og` | `public/photography/og-default.jpg` | Approved real-photography social derivative, exactly 1200 × 630 px (1.91:1), with its own source/license/release evidence. Do not add `openGraph.images` or a large Twitter card until this record is released. |

## Activation checklist

1. Add only the approved derivative at its specified target path.
2. Set `src`, `source`, `license`, and `releaseStatus: "released"` for that exact `SiteImage` record.
3. Confirm the crop and object position in the rendered route.
4. For the OG record, verify the root metadata gate adds the released 1200 × 630 source and switches to the large-image card.
5. Run the image-manifest tests, typecheck, lint, and production build.

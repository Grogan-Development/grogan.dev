import type { ComponentProps, ReactNode } from "react";
import Image from "next/image";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImagePlaceholder } from "@/components/ui/ImagePlaceholder";
import { SITE_IMAGES, type SiteImage } from "@/lib/images";

function imageProps(image: SiteImage, children?: ReactNode): ComponentProps<typeof ImagePlaceholder> {
  return { image, children } as unknown as ComponentProps<typeof ImagePlaceholder>;
}

describe("ImagePlaceholder photography release gate", () => {
  it("does not expose arbitrary children in its public API", () => {
    const hasChildren: "children" extends keyof ComponentProps<typeof ImagePlaceholder> ? true : false = false;

    expect(hasChildren).toBe(false);
  });

  it("renders an honest placeholder rather than unreleased photography", () => {
    const { container } = render(<ImagePlaceholder {...imageProps(SITE_IMAGES.hero)} />);

    expect(container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("Photography pending approval")).toBeInTheDocument();
  });

  it("does not render a child-image bypass for an unreleased manifest entry", () => {
    render(
      <ImagePlaceholder {...imageProps(SITE_IMAGES.hero)}>
        <Image src="/photography/bypass-attempt.jpg" alt="Bypass attempt" width={1} height={1} />
      </ImagePlaceholder>,
    );

    expect(screen.queryByRole("img", { name: "Bypass attempt" })).not.toBeInTheDocument();
    expect(screen.getByText("Photography pending approval")).toBeInTheDocument();
  });

  it("renders a released, rights-cleared image with its configured crop", () => {
    const releasedImage: SiteImage = {
      ...SITE_IMAGES.hero,
      src: "/photography/released-hero.jpg",
      source: "Grogan Development Group",
      license: "Owner release on file",
      releaseStatus: "released",
      objectPosition: "42% 58%",
    };
    const { container } = render(<ImagePlaceholder {...imageProps(releasedImage)} sizes="100vw" />);

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("alt", "");
    expect(image).toHaveStyle({ objectPosition: "42% 58%" });
  });

  it("does not render arbitrary child media over a released manifest image", () => {
    const releasedImage: SiteImage = {
      ...SITE_IMAGES.hero,
      src: "/photography/released-hero.jpg",
      source: "Grogan Development Group",
      license: "Owner release on file",
      releaseStatus: "released",
    };

    render(
      <ImagePlaceholder
        {...imageProps(
          releasedImage,
          <Image src="/photography/overlay-bypass.jpg" alt="Overlay bypass" width={1} height={1} />,
        )}
      />,
    );

    expect(screen.queryByRole("img", { name: "Overlay bypass" })).not.toBeInTheDocument();
  });
});

import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { AmbientField } from "@/components/decor/AmbientField";
import { Ornament, ORNAMENTS, type OrnamentName } from "@/components/decor/Ornament";
import { Scene3D, SceneLayer } from "@/components/decor/Scene3D";
import { TexturedSection } from "@/components/decor/TexturedSection";

/**
 * These lock the ACCESSIBILITY and SEMANTIC contracts of the decorative layer, which is where it
 * can do real damage. A decoration that announces itself to a screen reader, or that adds a
 * landmark or a focus stop, breaks the E2E suite's guarantees: exactly one <h1> per page, header
 * nav reachable within 15 Tab presses, and every <img>/graphic either labelled or hidden.
 *
 * The visual output is not asserted here — that is what the browser checks are for. What matters
 * is that none of this is reachable by assistive tech or the keyboard.
 */

const ORNAMENT_NAMES = Object.keys(ORNAMENTS) as OrnamentName[];

describe("Ornament", () => {
  it("renders every named glyph", () => {
    for (const name of ORNAMENT_NAMES) {
      const { container, unmount } = render(<Ornament name={name} />);
      expect(container.querySelector("svg"), name).not.toBeNull();
      unmount();
    }
  });

  it("is hidden from assistive tech and not focusable", () => {
    const { container } = render(<Ornament name="needle" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("focusable")).toBe("false");
  });

  it("inherits colour rather than hard-coding it, so one glyph works on any surface", () => {
    const { container } = render(<Ornament name="brush" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("stroke")).toBe("currentColor");
    expect(svg.getAttribute("fill")).toBe("none");
  });

  it("keeps the 24x24 viewBox at any rendered size, so glyphs stay aligned", () => {
    const { container } = render(<Ornament name="spool" size={40} strokeWidth={1.2} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("width")).toBe("40");
    expect(svg.getAttribute("stroke-width")).toBe("1.2");
  });
});

describe("TexturedSection", () => {
  it("renders a <section> by default and keeps children in an inner wrapper", () => {
    const { container } = render(
      <TexturedSection>
        <p>content</p>
      </TexturedSection>,
    );
    const section = container.querySelector("section")!;
    expect(section).not.toBeNull();
    // The child must not be a direct child of the full-bleed band — the measure lives on .inner.
    expect(section.querySelector("p")!.parentElement).not.toBe(section);
  });

  it("honours `as` so a band never invents a landmark where one is not wanted", () => {
    const { container } = render(<TexturedSection as="div">x</TexturedSection>);
    expect(container.querySelector("section")).toBeNull();
    expect(container.querySelector("div")).not.toBeNull();
  });

  it("hides the glow from assistive tech and adds no focusable node", () => {
    const { container } = render(
      <TexturedSection glow="sienna">
        <p>content</p>
      </TexturedSection>,
    );
    const glow = container.querySelector("span[aria-hidden='true']");
    expect(glow).not.toBeNull();
    expect(container.querySelectorAll("a, button, input, [tabindex]").length).toBe(0);
  });

  it("omits the glow element entirely when none is requested", () => {
    const { container } = render(<TexturedSection>x</TexturedSection>);
    expect(container.querySelector("span[aria-hidden='true']")).toBeNull();
  });
});

describe("Scene3D", () => {
  it("exposes the perspective as a custom property so the stage and useTilt can agree", () => {
    const { container } = render(<Scene3D perspective={1200}>x</Scene3D>);
    const scene = container.firstElementChild as HTMLElement;
    expect(scene.style.getPropertyValue("--scene-perspective")).toBe("1200px");
  });

  it("writes depth and rotation as custom properties, not inline transforms", () => {
    // The transform itself lives in CSS; JS only supplies the values. That is what lets a layer
    // carry its own keyframe animation without the two clobbering each other.
    const { container } = render(
      <Scene3D>
        <SceneLayer z={-60} rotate={-7}>
          art
        </SceneLayer>
      </Scene3D>,
    );
    // firstElementChild is the scene; its own first child is the layer.
    const layer = container.firstElementChild!.firstElementChild as HTMLElement;
    expect(layer.style.getPropertyValue("--layer-z")).toBe("-60px");
    expect(layer.style.getPropertyValue("--layer-rotate")).toBe("-7deg");
    expect(layer.style.transform).toBe("");
  });

  it("only blurs layers that actually recede", () => {
    // blur is opt-in AND requires z < 0: blurring a foreground layer reads as a rendering fault.
    const { container: near } = render(
      <Scene3D>
        <SceneLayer z={40} blur>
          front
        </SceneLayer>
      </Scene3D>,
    );
    const { container: far } = render(
      <Scene3D>
        <SceneLayer z={-40} blur>
          back
        </SceneLayer>
      </Scene3D>,
    );
    const nearClass = (near.firstElementChild!.firstElementChild as HTMLElement).className;
    const farClass = (far.firstElementChild!.firstElementChild as HTMLElement).className;
    expect(nearClass).not.toContain("depthBlur");
    expect(farClass).toContain("depthBlur");
  });
});

describe("AmbientField", () => {
  it("is hidden from assistive tech", () => {
    const { container } = render(<AmbientField />);
    expect((container.firstElementChild as HTMLElement).getAttribute("aria-hidden")).toBe("true");
  });

  it("renders three drift layers and no content slot", () => {
    const { container } = render(<AmbientField variant="threads" />);
    const field = container.firstElementChild as HTMLElement;
    expect(field.querySelectorAll("span").length).toBe(3);
    expect(field.textContent).toBe("");
  });

  it("clamps intensity into 0..1 so a caller cannot wash out the page", () => {
    const { container: over } = render(<AmbientField intensity={4} />);
    const { container: under } = render(<AmbientField intensity={-2} />);
    expect((over.firstElementChild as HTMLElement).style.opacity).toBe("1");
    expect((under.firstElementChild as HTMLElement).style.opacity).toBe("0");
  });
});

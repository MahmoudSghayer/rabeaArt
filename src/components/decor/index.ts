/**
 * The decorative layer — surfaces, ornament, depth and reveals.
 *
 * Import from "@/components/decor" rather than reaching into individual files, so page code
 * reads as a composition of named treatments instead of a pile of one-off divs.
 */

export { AmbientField, type AmbientFieldProps, type AmbientVariant } from "./AmbientField";
export { MaskReveal, type MaskRevealProps, type RevealDirection } from "./MaskReveal";
export { Ornament, ORNAMENTS, type OrnamentName, type OrnamentProps } from "./Ornament";
export { Scene3D, SceneLayer, type Scene3DProps, type SceneLayerProps } from "./Scene3D";
export {
  TexturedSection,
  type SectionEdge,
  type SectionGlow,
  type SectionTone,
  type TexturedSectionProps,
} from "./TexturedSection";

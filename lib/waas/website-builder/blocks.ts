export type BlockType =
  | "hero"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "columns"
  | "spacer"
  | "divider";

export interface BlockBase {
  id: string;
  type: BlockType;
}

export interface HeroBlock extends BlockBase {
  type: "hero";
  eyebrow: string;
  title: string;
  subtitle: string;
  buttonLabel: string;
  align: "left" | "center";
}

export interface HeadingBlock extends BlockBase {
  type: "heading";
  text: string;
  level: "h1" | "h2" | "h3";
  align: "left" | "center" | "right";
}

export interface TextBlock extends BlockBase {
  type: "text";
  text: string;
  align: "left" | "center" | "right";
}

export interface ImageBlock extends BlockBase {
  type: "image";
  src: string;
  alt: string;
  rounded: boolean;
}

export interface ButtonBlock extends BlockBase {
  type: "button";
  label: string;
  href: string;
  variant: "solid" | "outline";
  align: "left" | "center" | "right";
}

export interface ColumnsBlock extends BlockBase {
  type: "columns";
  left: string;
  right: string;
}

export interface SpacerBlock extends BlockBase {
  type: "spacer";
  size: "sm" | "md" | "lg";
}

export interface DividerBlock extends BlockBase {
  type: "divider";
}

export type Block =
  | HeroBlock
  | HeadingBlock
  | TextBlock
  | ImageBlock
  | ButtonBlock
  | ColumnsBlock
  | SpacerBlock
  | DividerBlock;

export interface BlockMeta {
  type: BlockType;
  label: string;
  description: string;
}

export const BLOCK_LIBRARY: BlockMeta[] = [
  {
    type: "hero",
    label: "Hero",
    description: "Eyebrow, title, subtitle & CTA",
  },
  { type: "heading", label: "Heading", description: "Section heading" },
  { type: "text", label: "Text", description: "Paragraph of body copy" },
  { type: "image", label: "Image", description: "Responsive image" },
  { type: "button", label: "Button", description: "Call-to-action link" },
  { type: "columns", label: "Two Columns", description: "Side-by-side text" },
  { type: "spacer", label: "Spacer", description: "Vertical spacing" },
  { type: "divider", label: "Divider", description: "Horizontal rule" },
];

let counter = 0;
function uid(type: string) {
  counter += 1;
  return `${type}-${Date.now().toString(36)}-${counter}`;
}

export function createBlock(type: BlockType): Block {
  switch (type) {
    case "hero":
      return {
        id: uid(type),
        type,
        eyebrow: "Introducing",
        title: "Build something people love",
        subtitle:
          "A clear, compelling subtitle that explains what your product does and why it matters.",
        buttonLabel: "Get started",
        align: "center",
      };
    case "heading":
      return {
        id: uid(type),
        type,
        text: "A section heading",
        level: "h2",
        align: "left",
      };
    case "text":
      return {
        id: uid(type),
        type,
        text: "Write a paragraph of supporting copy here. Click to edit this text and describe your product, feature, or story.",
        align: "left",
      };
    case "image":
      return {
        id: uid(type),
        type,
        src: "/placeholder.jpg",
        alt: "Placeholder image",
        rounded: true,
      };
    case "button":
      return {
        id: uid(type),
        type,
        label: "Learn more",
        href: "#",
        variant: "solid",
        align: "left",
      };
    case "columns":
      return {
        id: uid(type),
        type,
        left: "First column of content. Describe a feature or benefit here.",
        right: "Second column of content. Add a complementary point here.",
      };
    case "spacer":
      return { id: uid(type), type, size: "md" };
    case "divider":
      return { id: uid(type), type };
  }
}

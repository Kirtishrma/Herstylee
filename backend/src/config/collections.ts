export interface CollectionPageConfig {
  category: string;
  title: string;
  tag: string;
  heading: string;
  description: string;
  heroImage: string;
}

export const COLLECTION_PAGES: Record<string, CollectionPageConfig> = {
  casual: {
    category: "Casual",
    title: "Casual Collection",
    tag: "CASUAL COLLECTION 2026",
    heading: "Effortless Everyday Luxury",
    description:
      "Curated casual wear inspired by modern street style, travel moments, and everyday confidence.",
    heroImage: "casual/c.jpg",
  },
  formals: {
    category: "Formal",
    title: "Formal Collection",
    tag: "FORMAL COLLECTION 2026",
    heading: "Power Dressing Redefined",
    description:
      "Sophisticated formal wear crafted for ambitious women who value elegance and timeless style.",
    heroImage: "formals/f.jpg",
  },
  night: {
    category: "Night Wear",
    title: "Nightwear Collection",
    tag: "NIGHTWEAR COLLECTION 2026",
    heading: "Luxury Evenings. Timeless Comfort.",
    description:
      "Premium satin pajamas, cozy lounge sets, and elegant sleepwear for beautiful nights.",
    heroImage: "night/n.jpg",
  },
  party: {
    category: "Partywear",
    title: "Party Wear",
    tag: "PARTY COLLECTION 2026",
    heading: "Glamorous Party Looks",
    description: "Statement pieces for nights out, celebrations, and red-carpet moments.",
    heroImage: "party-western/p.jpg",
  },
  summer: {
    category: "Summer",
    title: "Summer Collection",
    tag: "SUMMER COLLECTION 2026",
    heading: "Sun-Ready Fashion",
    description: "Light, breathable outfits made for warm days and vacation getaways.",
    heroImage: "summer/s.jpg",
  },
  traditional: {
    category: "Traditional",
    title: "Traditional Collection",
    tag: "TRADITIONAL COLLECTION 2026",
    heading: "Heritage Elegance",
    description: "Lehengas, sarees, shararas, and festive ethnic wear for every celebration.",
    heroImage: "traditional/t.jpg",
  },
  winter: {
    category: "Winter",
    title: "Winter Collection",
    tag: "WINTER COLLECTION 2026",
    heading: "Cozy Winter Layers",
    description: "Warm, layered outfits that keep you stylish through the cold season.",
    heroImage: "winter/w.jpg",
  },
  spring: {
    category: "Spring",
    title: "Spring Collection",
    tag: "SPRING COLLECTION 2026",
    heading: "Fresh Spring Styles",
    description: "Floral tones and light layers for breezy spring days and garden outings.",
    heroImage: "spring/s.jpg",
  },
};

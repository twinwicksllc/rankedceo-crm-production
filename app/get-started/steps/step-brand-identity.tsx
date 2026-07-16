"use client";

// =============================================================================
// Step 3: Brand Identity
// Logo upload (Supabase Storage), color picker, curated industry palette system
// =============================================================================

import React, { useState, useRef, useCallback } from "react";
import {
  generateTextmarkSvg,
  svgToDataUrl,
} from "@/lib/waas/utils/generate-textmark";

interface Props {
  tenantId: string;
  businessName: string;
  primaryColor: string;
  setPrimaryColor: (c: string) => void;
  secondaryColor: string;
  setSecondaryColor: (c: string) => void;
  textColor: string;
  setTextColor: (c: string) => void;
  logoUrl: string | null;
  setLogoUrl: (u: string | null) => void;
  onNext: () => void;
  onBack: () => void;
  isLoading: boolean;
}

// =============================================================================
// Curated brand palette system — industry-relevant for home service businesses
// Each palette: primary (dominant), secondary (accent/complement), label, mood tag
// Organized into categories that match how contractors think about their brand.
// Research sources: Elevate Marketing Studios, Hook Agency, ColourLovers industry data
// =============================================================================

interface Palette {
  primary: string;
  secondary: string;
  label: string;
  mood: string;
}

interface PaletteCategory {
  id: string;
  name: string;
  icon: string;
  palettes: Palette[];
}

const PALETTE_CATEGORIES: PaletteCategory[] = [
  {
    id: "trust",
    name: "Trust & Service",
    icon: "🔵",
    palettes: [
      {
        primary: "#1B4F9C",
        secondary: "#FF7A00",
        label: "Pro Fleet",
        mood: "HVAC · Plumbing · Electric",
      },
      {
        primary: "#255FDC",
        secondary: "#F2C300",
        label: "Service Pro",
        mood: "Plumbing · HVAC · Roofing",
      },
      {
        primary: "#375A7F",
        secondary: "#2CA6A4",
        label: "Slate & Teal",
        mood: "Remodeling · Bath · Kitchen",
      },
      {
        primary: "#0A2342",
        secondary: "#C0D6F5",
        label: "Navy Command",
        mood: "Commercial · Industrial GC",
      },
      {
        primary: "#1A5276",
        secondary: "#85C1E9",
        label: "Steel Blue",
        mood: "Plumbing · Water Services",
      },
      {
        primary: "#2E86C1",
        secondary: "#1A5276",
        label: "Corporate Blue",
        mood: "Multi-trade · General Contractor",
      },
    ],
  },
  {
    id: "bold",
    name: "Bold & Energy",
    icon: "🟠",
    palettes: [
      {
        primary: "#D35400",
        secondary: "#2C3E50",
        label: "Job Site",
        mood: "General Contractor · Framing",
      },
      {
        primary: "#E74C3C",
        secondary: "#2C3E50",
        label: "Power Red",
        mood: "Roofing · Demolition · Concrete",
      },
      {
        primary: "#F39C12",
        secondary: "#1A252F",
        label: "Safety Gold",
        mood: "Exterior · Solar · Service Vans",
      },
      {
        primary: "#CB4335",
        secondary: "#922B21",
        label: "Bold Crimson",
        mood: "Emergency Service · Fire/Alarm",
      },
      {
        primary: "#BA4A00",
        secondary: "#1F618D",
        label: "Copper & Navy",
        mood: "Roofing · Metalwork · HVAC",
      },
      {
        primary: "#E67E22",
        secondary: "#154360",
        label: "High-Vis Pro",
        mood: "Construction · Traffic · Crew",
      },
    ],
  },
  {
    id: "premium",
    name: "Premium & Luxury",
    icon: "⚫",
    palettes: [
      {
        primary: "#1C1B1A",
        secondary: "#B08D57",
        label: "Warm Black & Brass",
        mood: "Custom Home · High-End Finishes",
      },
      {
        primary: "#212F3D",
        secondary: "#C9A84C",
        label: "Midnight Gold",
        mood: "Design-Build · Custom Millwork",
      },
      {
        primary: "#1A1A2E",
        secondary: "#E94560",
        label: "Urban Premium",
        mood: "Modern · Boutique · Tech-Forward",
      },
      {
        primary: "#2D2D2D",
        secondary: "#B7950B",
        label: "Charcoal & Gold",
        mood: "Architectural · Specialty Finishes",
      },
      {
        primary: "#4A235A",
        secondary: "#D4AC0D",
        label: "Eggplant & Brass",
        mood: "Design-Build · Luxury Renovation",
      },
      {
        primary: "#17202A",
        secondary: "#85929E",
        label: "Slate Prestige",
        mood: "Commercial · Steel · Precision Work",
      },
    ],
  },
  {
    id: "nature",
    name: "Nature & Craft",
    icon: "🌿",
    palettes: [
      {
        primary: "#0E2A21",
        secondary: "#C96F53",
        label: "Forest & Clay",
        mood: "Landscape · Outdoor Living",
      },
      {
        primary: "#1D4E2E",
        secondary: "#E6DDCC",
        label: "Deep Forest",
        mood: "Landscaping · Green Building",
      },
      {
        primary: "#2E7D32",
        secondary: "#F9A825",
        label: "Growth & Sun",
        mood: "Solar · Eco-Build · Sustainable",
      },
      {
        primary: "#4E342E",
        secondary: "#A5D6A7",
        label: "Walnut & Sage",
        mood: "Flooring · Custom Woodwork",
      },
      {
        primary: "#5D4037",
        secondary: "#FFCC02",
        label: "Timber & Gold",
        mood: "Framing · Stone · Custom Homes",
      },
      {
        primary: "#37474F",
        secondary: "#80CBC4",
        label: "Concrete & Teal",
        mood: "Epoxy · Tile · Modern Spaces",
      },
    ],
  },
];

// =============================================================================
// Color math helpers — HSL-based harmony, no external dependencies
// =============================================================================

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  const hNorm = ((h % 360) + 360) % 360;
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const x = c * (1 - Math.abs(((hNorm / 60) % 2) - 1));
  const m = lNorm - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (hNorm < 60) {
    r = c;
    g = x;
    b = 0;
  } else if (hNorm < 120) {
    r = x;
    g = c;
    b = 0;
  } else if (hNorm < 180) {
    r = 0;
    g = c;
    b = x;
  } else if (hNorm < 240) {
    r = 0;
    g = x;
    b = c;
  } else if (hNorm < 300) {
    r = x;
    g = 0;
    b = c;
  } else {
    r = c;
    g = 0;
    b = x;
  }
  const toHex = (v: number) =>
    Math.round((v + m) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** Generate a harmonious secondary from a primary hex using split-complementary */
function generateHarmoniousSecondary(primaryHex: string): string {
  const [h, s, l] = hexToHsl(primaryHex);
  // Split-complementary: 150° offset gives a rich but not jarring pair
  // If primary is light, make secondary darker and slightly desaturated
  const newH = (h + 150) % 360;
  const newS = Math.max(30, Math.min(80, s - 10));
  const newL = l > 55 ? Math.max(25, l - 30) : Math.min(70, l + 20);
  return hslToHex(newH, newS, newL);
}

// =============================================================================
// Logo color extraction from uploaded image (canvas-based, no dependencies)
// =============================================================================

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function colorDistance(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function quantizeChannel(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v / 16) * 16));
}

async function suggestBrandColorsFromLogo(
  file: File,
): Promise<{ primary: string; secondary: string } | null> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to read uploaded image"));
      image.src = objectUrl;
    });
    const maxSample = 64;
    const scale = Math.max(img.width / maxSample, img.height / maxSample, 1);
    const width = Math.max(1, Math.round(img.width / scale));
    const height = Math.max(1, Math.round(img.height / scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, width, height);
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const counts = new Map<string, number>();
    for (let i = 0; i < pixels.length; i += 4) {
      const r = pixels[i],
        g = pixels[i + 1],
        b = pixels[i + 2],
        a = pixels[i + 3];
      if (a < 180) continue;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < 12 || lum > 244) continue;
      const key = `${quantizeChannel(r)},${quantizeChannel(g)},${quantizeChannel(b)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (counts.size === 0) return null;
    const ranked = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([key]) => key.split(",").map(Number) as [number, number, number]);
    const primaryRgb = ranked[0];
    const secondaryRgb =
      ranked.find((rgb) => colorDistance(rgb, primaryRgb) >= 72) ??
      ranked[1] ??
      primaryRgb;
    return {
      primary: rgbToHex(primaryRgb[0], primaryRgb[1], primaryRgb[2]),
      secondary: rgbToHex(secondaryRgb[0], secondaryRgb[1], secondaryRgb[2]),
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

// =============================================================================
// Component
// =============================================================================

export function StepBrandIdentity({
  tenantId,
  businessName,
  primaryColor,
  setPrimaryColor,
  secondaryColor,
  setSecondaryColor,
  textColor,
  setTextColor,
  logoUrl,
  setLogoUrl,
  onNext,
  onBack,
  isLoading,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [useAutoLogo, setUseAutoLogo] = useState(!logoUrl);
  const [logoColorsSuggested, setLogoColorsSuggested] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>("trust");
  const fileRef = useRef<HTMLInputElement>(null);

  const svgPreview = generateTextmarkSvg(
    businessName || "My Business",
    primaryColor,
  );
  const svgDataUrl = svgToDataUrl(svgPreview);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadError("");
      const validTypes = [
        "image/jpeg",
        "image/png",
        "image/svg+xml",
        "image/webp",
      ];
      if (!validTypes.includes(file.type)) {
        setUploadError("Please upload a JPG, PNG, SVG, or WebP image.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setUploadError("File size must be under 5MB.");
        return;
      }
      setUploading(true);
      try {
        const suggestedColors = await suggestBrandColorsFromLogo(file);
        if (suggestedColors) {
          setPrimaryColor(suggestedColors.primary);
          setSecondaryColor(suggestedColors.secondary);
          setLogoColorsSuggested(true);
        }
        const formData = new FormData();
        formData.append("tenantId", tenantId);
        formData.append("file", file);
        const response = await fetch("/api/onboarding/logo-upload", {
          method: "POST",
          body: formData,
        });
        const payload = await response
          .json()
          .catch(
            () =>
              ({}) as { error?: string; publicUrl?: string; success?: boolean },
          );
        if (!response.ok || !payload.success || !payload.publicUrl)
          throw new Error(payload.error ?? "Upload failed");
        setLogoUrl(payload.publicUrl);
        setUseAutoLogo(false);
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Upload failed");
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [tenantId, setLogoUrl, setPrimaryColor, setSecondaryColor],
  );

  const handleRemoveLogo = () => {
    setLogoUrl(null);
    setUseAutoLogo(true);
    setLogoColorsSuggested(false);
  };

  const handlePaletteSelect = (p: Palette) => {
    setPrimaryColor(p.primary);
    setSecondaryColor(p.secondary);
    setLogoColorsSuggested(false);
  };

  /** When user manually picks a primary, auto-generate a harmonious secondary */
  const handlePrimaryChange = (hex: string) => {
    setPrimaryColor(hex);
    setSecondaryColor(generateHarmoniousSecondary(hex));
    setLogoColorsSuggested(false);
  };

  const currentCategory = PALETTE_CATEGORIES.find(
    (c) => c.id === activeCategory,
  )!;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 mb-4">
          <span className="text-blue-400 text-xs font-semibold uppercase tracking-wider">
            Step 3 of 4
          </span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
          Define your brand identity
        </h1>
        <p className="text-slate-500 dark:text-white/50 mt-2 text-sm sm:text-base">
          Upload your logo or we'll craft a professional text-mark
          automatically.
        </p>
      </div>

      {/* Logo Section */}
      <div className="mb-8">
        <label className="block text-sm font-medium text-slate-700 dark:text-white/70 mb-3">
          Logo
        </label>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Upload option */}
          <div
            className={`relative rounded-xl border-2 border-dashed p-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
              !useAutoLogo
                ? "border-blue-500/60 bg-blue-500/5"
                : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 bg-slate-50 dark:bg-white/[0.03]"
            }`}
            onClick={() => !uploading && fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/svg+xml,image/webp"
              onChange={handleFileSelect}
              className="sr-only"
            />
            {logoUrl && !useAutoLogo ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logoUrl}
                  alt="Uploaded logo"
                  className="max-h-16 max-w-full object-contain"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveLogo();
                  }}
                  className="text-xs text-red-400 hover:text-red-300 transition-colors"
                >
                  Remove
                </button>
              </>
            ) : (
              <>
                {uploading ? (
                  <svg
                    className="animate-spin w-8 h-8 text-blue-400"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeOpacity="0.25"
                    />
                    <path
                      d="M12 2a10 10 0 0 1 10 10"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                ) : (
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    fill="none"
                    className="text-slate-400 dark:text-white/30"
                  >
                    <path
                      d="M16 4v16M8 12l8-8 8 8"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M4 24v2a2 2 0 0 0 2 2h20a2 2 0 0 0 2-2v-2"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
                <div className="text-center">
                  <p className="text-slate-600 dark:text-white/60 text-sm font-medium">
                    {uploading ? "Uploading…" : "Upload Logo"}
                  </p>
                  <p className="text-slate-400 dark:text-white/30 text-xs mt-0.5">
                    JPG, PNG, SVG, WebP • Max 5MB
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Auto-generate option */}
          <div
            className={`relative rounded-xl border-2 p-4 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
              useAutoLogo
                ? "border-violet-500/60 bg-violet-500/5"
                : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20"
            }`}
            onClick={() => {
              setUseAutoLogo(true);
              setLogoUrl(null);
            }}
          >
            {useAutoLogo && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5l2 2 4-4"
                    stroke="white"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={svgDataUrl}
              alt="Auto-generated text-mark"
              className="max-h-10 max-w-full object-contain"
            />
            <div className="text-center">
              <p className="text-slate-600 dark:text-white/60 text-sm font-medium">
                Auto-Generate
              </p>
              <p className="text-slate-400 dark:text-white/30 text-xs mt-0.5">
                Professional text-mark
              </p>
            </div>
          </div>
        </div>

        {uploadError && (
          <p className="mt-2 text-xs text-red-400">{uploadError}</p>
        )}
      </div>

      {/* ================================================================
          Color Palette — Curated Industry System
          ================================================================ */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-slate-700 dark:text-white/70">
            Color Palette
          </label>
          <span className="text-xs text-slate-400 dark:text-white/30">
            {logoColorsSuggested
              ? "✨ Colors suggested from your logo"
              : "Pick a palette or customize below"}
          </span>
        </div>

        {/* Category tabs */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          {PALETTE_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                activeCategory === cat.id
                  ? "bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/60"
              }`}
            >
              <span className="text-sm leading-none">{cat.icon}</span>
              <span className="hidden sm:inline">{cat.name}</span>
            </button>
          ))}
        </div>

        {/* Palette grid — 2 columns of rich cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-5">
          {currentCategory.palettes.map((p) => {
            const isSelected =
              primaryColor.toUpperCase() === p.primary.toUpperCase();
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePaletteSelect(p)}
                className={`group relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                  isSelected
                    ? "border-blue-500 shadow-lg shadow-blue-500/20 scale-[1.02]"
                    : "border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/25 hover:scale-[1.01]"
                }`}
              >
                {/* Color swatch bar — split primary/secondary */}
                <div className="flex h-10">
                  <div
                    className="flex-1"
                    style={{ backgroundColor: p.primary }}
                  />
                  <div
                    className="flex-1"
                    style={{ backgroundColor: p.secondary }}
                  />
                </div>

                {/* Label area */}
                <div className="px-2.5 py-2 bg-white dark:bg-slate-900/60">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-xs font-semibold text-slate-800 dark:text-white/90 truncate">
                      {p.label}
                    </p>
                    {isSelected && (
                      <div className="shrink-0 w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                          <path
                            d="M1.5 4l1.5 1.5 3.5-3"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-white/35 truncate mt-0.5 leading-tight">
                    {p.mood}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom color pickers */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
          <p className="text-xs font-semibold text-slate-500 dark:text-white/40 uppercase tracking-wider mb-3">
            Custom Colors
          </p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">
                Primary Color
              </label>
              <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 focus-within:border-blue-500/60 transition-all">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => handlePrimaryChange(e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 outline-none p-0"
                />
                <span className="text-slate-600 dark:text-white/60 text-xs font-mono uppercase">
                  {primaryColor}
                </span>
                <span className="ml-auto text-[10px] text-slate-400 dark:text-white/25 hidden sm:block">
                  auto-pairs secondary
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">
                Secondary / Accent Color
              </label>
              <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 focus-within:border-blue-500/60 transition-all">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => {
                    setSecondaryColor(e.target.value);
                    setLogoColorsSuggested(false);
                  }}
                  className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 outline-none p-0"
                />
                <span className="text-slate-600 dark:text-white/60 text-xs font-mono uppercase">
                  {secondaryColor}
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-white/50 mb-1.5">
                Text Color
              </label>
              <div className="flex items-center gap-3 h-11 px-3 rounded-xl bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 focus-within:border-blue-500/60 transition-all">
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-7 h-7 rounded-lg cursor-pointer bg-transparent border-0 outline-none p-0"
                />
                <span className="text-slate-600 dark:text-white/60 text-xs font-mono uppercase">
                  {textColor}
                </span>
              </div>
            </div>
          </div>
          {logoColorsSuggested && (
            <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-300/90">
              ✨ These colors were extracted from your uploaded logo.
            </p>
          )}
        </div>

        {/* Live preview */}
        <div className="mt-4 p-4 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          <p className="text-slate-400 dark:text-white/30 text-xs mb-3 uppercase tracking-wider font-medium">
            Live Preview
          </p>
          <div className="space-y-2.5">
            {/* Gradient button */}
            <div
              className="h-10 w-full rounded-lg flex items-center justify-center text-white text-sm font-semibold shadow-md"
              style={{
                background: `linear-gradient(135deg, ${primaryColor}, ${secondaryColor})`,
              }}
            >
              Your Brand Button
            </div>
            {/* Flat swatches row */}
            <div className="flex items-center gap-2">
              <div
                className="h-8 flex-1 rounded-lg"
                style={{ backgroundColor: primaryColor }}
              />
              <div
                className="h-8 flex-1 rounded-lg"
                style={{ backgroundColor: secondaryColor }}
              />
              <div
                className="h-8 w-8 rounded-lg border-2 shrink-0"
                style={{
                  backgroundColor: primaryColor + "20",
                  borderColor: primaryColor,
                }}
              />
              <div className="flex-1 h-8 rounded-lg bg-slate-800 dark:bg-slate-700 flex items-center px-3">
                <span
                  className="text-xs font-semibold"
                  style={{ color: textColor }}
                >
                  {businessName || "Your Business"}
                </span>
              </div>
            </div>
            {/* Text color preview */}
            <div className="bg-white dark:bg-slate-800 rounded-lg p-3 flex items-center gap-3">
              <div
                className="w-5 h-5 rounded border-2 border-slate-300 dark:border-white/20 shrink-0"
                style={{ backgroundColor: textColor }}
              />
              <span
                className="text-sm font-medium"
                style={{ color: textColor }}
              >
                Text Preview — {businessName || "Your Business"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="h-14 px-6 rounded-xl border border-slate-300 dark:border-white/15 text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:border-slate-400 dark:hover:border-white/30 font-medium text-sm transition-all"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={isLoading || uploading}
          className="flex-1 h-14 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-semibold text-base hover:from-blue-500 hover:to-violet-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin w-5 h-5"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="white"
                  strokeWidth="3"
                  strokeOpacity="0.25"
                />
                <path
                  d="M12 2a10 10 0 0 1 10 10"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
              Saving…
            </>
          ) : (
            <>
              Continue to Integrations <span className="ml-1">→</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

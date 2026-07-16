"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const WELCOME_MODAL_KEY = "waas-builder-welcome-shown";

export function BuilderWelcomeModal({ onDismiss }: { onDismiss: () => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const hasSeenWelcome = localStorage.getItem(WELCOME_MODAL_KEY);
    if (!hasSeenWelcome) {
      setIsVisible(true);
    }
  }, [mounted]);

  const handleDismiss = () => {
    localStorage.setItem(WELCOME_MODAL_KEY, "true");
    setIsVisible(false);
    onDismiss();
  };

  const handleShowAgain = () => {
    localStorage.removeItem(WELCOME_MODAL_KEY);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        backdropFilter: "blur(4px)",
        backgroundColor: "rgba(0, 0, 0, 0.32)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleDismiss();
      }}
    >
      {/* Modal card */}
      <div
        className="relative w-full max-w-md rounded-2xl border bg-white p-8 shadow-2xl"
        style={{
          borderColor: "var(--brand-block-border)",
          backgroundColor: "var(--brand-block-bg)",
          boxShadow: "0 28px 60px rgba(0, 0, 0, 0.24)",
        }}
      >
        {/* Close button */}
        <button
          onClick={handleDismiss}
          aria-label="Close welcome modal"
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <h2
            className="text-2xl font-bold leading-tight"
            style={{
              fontFamily: "var(--brand-display-font)",
              color: "var(--foreground)",
            }}
          >
            Welcome to Your Website Builder 👋
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: "var(--brand-copy-color)" }}
          >
            It's easier than you think. Here's how to get started in 3 steps:
          </p>
        </div>

        {/* Steps */}
        <div className="space-y-4 mb-8">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold text-white"
              style={{ background: "var(--primary)" }}
            >
              1
            </div>
            <div>
              <p
                className="font-semibold text-sm mb-0.5"
                style={{ color: "var(--foreground)" }}
              >
                Browse & Drag
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--brand-copy-color)" }}>
                Pick a block from the left panel (Hero, Text, Image, Button, etc.) and drag it onto the canvas
                in the middle to add it to your page.
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold text-white"
              style={{ background: "var(--primary)" }}
            >
              2
            </div>
            <div>
              <p
                className="font-semibold text-sm mb-0.5"
                style={{ color: "var(--foreground)" }}
              >
                Click to Edit
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--brand-copy-color)" }}>
                Click any block on the canvas to select it, then use the right panel to change the text, images,
                and styling. Easy!
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-semibold text-white"
              style={{ background: "var(--primary)" }}
            >
              3
            </div>
            <div>
              <p
                className="font-semibold text-sm mb-0.5"
                style={{ color: "var(--foreground)" }}
              >
                Submit When Ready
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--brand-copy-color)" }}>
                When your page looks the way you want, click <span className="font-medium">"Submit for Admin Review"</span> at the top
                right. Our team will take it from there.
              </p>
            </div>
          </div>
        </div>

        {/* Dismiss button */}
        <button
          onClick={handleDismiss}
          className="w-full h-11 rounded-xl font-semibold text-white transition-all mb-3"
          style={{
            background: "linear-gradient(135deg, var(--primary), var(--ring))",
            boxShadow: "0 8px 16px color-mix(in srgb, var(--primary) 26%, transparent)",
          }}
        >
          Got it, let's build!
        </button>

        {/* Show again link */}
        <button
          onClick={handleShowAgain}
          className="w-full text-xs text-center transition-colors"
          style={{ color: "var(--brand-copy-color)" }}
        >
          Show this again anytime
        </button>
      </div>
    </div>
  );
}

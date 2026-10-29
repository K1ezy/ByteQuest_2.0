"use client";

import React, { useState, useRef, useCallback } from "react";
import { useSafeWindowNavigation } from "@/lib/useSafeWindowNavigation";

interface FeaturedSlide {
  id: string;
  badge: string;
  xp: number;
  track: string;
  title: string;
  description: string;
  steps: string[];
}

const FEATURED_SLIDES: FeaturedSlide[] = [
  {
    id: "01",
    badge: "QUEST 01",
    xp: 50,
    track: "PYTHON · FOUNDATIONS",
    title: "Make the loop count",
    description: "Use repetition to solve a small problem. Run your sample, then send it for grading.",
    steps: ["Read integer input n", "Iterate from 1 to n", "Compute running total"],
  },
  {
    id: "02",
    badge: "QUEST 02",
    xp: 75,
    track: "PYTHON · FUNCTIONS",
    title: "Reusable score calculator",
    description: "Define clean parameters and return values to compute student milestone bonuses.",
    steps: ["Define compute_score()", "Apply multiplier logic", "Return formatted string"],
  },
  {
    id: "03",
    badge: "CONCEPT CHECK",
    xp: 25,
    track: "PYTHON · ASSESSMENT",
    title: "Function scope & return checks",
    description: "Verify your understanding of local variables and fruitful functions in 5 quick steps.",
    steps: ["Keyword def syntax", "Input arguments vs return", "Invoking functions safely"],
  },
  {
    id: "04",
    badge: "QUEST 04",
    xp: 100,
    track: "C++ · CONTROL STRUCTURES",
    title: "Fast prime factor analyzer",
    description: "Optimize inner loops and conditional branches to factor large integers within Judge0 limits.",
    steps: ["Handle base cases (n <= 3)", "Step by 6k ± 1 primes", "Output in ascending order"],
  },
  {
    id: "05",
    badge: "QUEST 05",
    xp: 125,
    track: "JAVA · OOP ARCHITECTURE",
    title: "Inheritance & polymorphic shapes",
    description: "Design abstract classes and implement polymorphic area calculations with unit test suites.",
    steps: ["Declare abstract Shape class", "Override calculateArea()", "Pass hidden test cases"],
  },
];

export function FeaturedQuestWindow() {
  const [slideIndex, setSlideIndex] = useState(0);
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [isWindowFocused, setIsWindowFocused] = useState(false);
  const windowRef = useRef<HTMLDivElement>(null);

  const currentSlide = FEATURED_SLIDES[slideIndex];

  const nextSlide = useCallback(() => {
    setSlideIndex((prev) => (prev + 1) % FEATURED_SLIDES.length);
    setActiveStepIndex(0);
  }, []);

  const prevSlide = useCallback(() => {
    setSlideIndex((prev) => (prev - 1 + FEATURED_SLIDES.length) % FEATURED_SLIDES.length);
    setActiveStepIndex(0);
  }, []);

  const nextStep = useCallback(() => {
    setActiveStepIndex((prev) => (prev + 1) % currentSlide.steps.length);
  }, [currentSlide.steps.length]);

  const prevStep = useCallback(() => {
    setActiveStepIndex((prev) => (prev - 1 + currentSlide.steps.length) % currentSlide.steps.length);
  }, [currentSlide.steps.length]);

  // Connect safe keyboard & wheel navigation
  useSafeWindowNavigation({
    containerRef: windowRef,
    onNextSlide: nextSlide,
    onPrevSlide: prevSlide,
    onNextItem: nextStep,
    onPrevItem: prevStep,
    isEnabled: true,
  });

  return (
    <div
      ref={windowRef}
      tabIndex={0}
      role="region"
      aria-roledescription="interactive quest carousel"
      aria-label={`Featured Quest Window: ${currentSlide.title}. Slide ${slideIndex + 1} of ${FEATURED_SLIDES.length}. Use Left and Right arrow keys to change slides, Up and Down arrows to inspect steps.`}
      onClick={() => {
        setIsWindowFocused(true);
        windowRef.current?.focus();
      }}
      onFocus={() => setIsWindowFocused(true)}
      onBlur={() => setIsWindowFocused(false)}
      className={`featured-quest-window ${isWindowFocused ? "is-focused" : ""}`}
    >
      {/* Screen Reader Live Announcer */}
      <div className="sr-only" aria-live="polite">
        Showing {currentSlide.badge}: {currentSlide.title}, Step {activeStepIndex + 1}: {currentSlide.steps[activeStepIndex]}
      </div>

      {/* Top Row: Badge & XP */}
      <div className="preview-topline">
        <span className="preview-badge">{currentSlide.badge}</span>
        <span className="preview-xp">✦ {currentSlide.xp} XP</span>
      </div>

      <div className="preview-icon" aria-hidden="true" data-tooltip={currentSlide.badge.includes("CONCEPT") ? "Concept check: review what you learned." : "Code challenge: solve a programming task."}>
        {currentSlide.badge.includes("CONCEPT") ? "✓" : "</>"}
      </div>

      {/* Track & Title */}
      <p className="preview-kicker">{currentSlide.track}</p>
      <h2>{currentSlide.title}</h2>
      <p className="preview-copy">{currentSlide.description}</p>

      {/* Interactive Milestones Steps */}
      <div className="featured-steps-list" role="listbox" aria-label="Quest milestones">
        {currentSlide.steps.map((step, idx) => (
          <div
            key={step}
            role="option"
            aria-selected={idx === activeStepIndex}
            onClick={(e) => {
              e.stopPropagation();
              setActiveStepIndex(idx);
            }}
            className={`featured-step-item ${idx === activeStepIndex ? "is-active" : ""}`}
          >
            <span>
              <strong>{idx + 1}.</strong> {step}
            </span>
            {idx === activeStepIndex && (
              <span className="featured-step-pill">Active ↑↓</span>
            )}
          </div>
        ))}
      </div>

      {/* Segmented Progress Indicators */}
      <div className="featured-dots-bar">
        {FEATURED_SLIDES.map((s, idx) => (
          <button
            key={s.id}
            type="button"
            aria-label={`Go to slide ${idx + 1}`}
            data-tooltip={`Show featured quest ${idx + 1}: ${s.title}.`}
            onClick={(e) => {
              e.stopPropagation();
              setSlideIndex(idx);
              setActiveStepIndex(0);
            }}
            className={`featured-dot ${idx === slideIndex ? "active" : ""}`}
          />
        ))}
      </div>

      {/* Footer Navigation & Stepper Controls (Fitts's Law) */}
      <div className="featured-footer-row">
        <span className="featured-counter">
          0{slideIndex + 1} / 0{FEATURED_SLIDES.length}
        </span>

        <div className="featured-btn-group">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              prevSlide();
            }}
            aria-label="Previous featured quest (Left Arrow)"
            data-tooltip="Show the previous featured quest."
            className="featured-arrow-btn"
          >
            ←
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              nextSlide();
            }}
            aria-label="Next featured quest (Right Arrow)"
            data-tooltip="Show the next featured quest."
            className="featured-arrow-btn"
          >
            →
          </button>
        </div>
      </div>

      {/* Keyboard / Wheel Interactive Hint Badge */}
      <p className="featured-hint-note">
        {isWindowFocused
          ? "✦ Active: Use ←/→ for slides · ↑/↓ or Wheel for steps"
          : "Click window to enable Arrow Key & Scroll Wheel control"}
      </p>
    </div>
  );
}

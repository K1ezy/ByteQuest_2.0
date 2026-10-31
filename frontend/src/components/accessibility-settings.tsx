"use client";

import { useAccessibility, type AccessibilityPreferenceKey } from "@/components/accessibility-provider";

interface AccessibilitySettingDefinition {
  key: AccessibilityPreferenceKey;
  id: string;
  title: string;
  description: string;
}

const ACCESSIBILITY_SETTINGS: AccessibilitySettingDefinition[] = [
  {
    key: "highContrast",
    id: "a11y-high-contrast",
    title: "High Contrast (WCAG AAA)",
    description: "7:1+ contrast ratio & crisp element borders",
  },
  {
    key: "legibleFont",
    id: "a11y-legible-font",
    title: "Dyslexia / Legible Font",
    description: "Increased letter spacing & hyper-legible sans",
  },
  {
    key: "largeText",
    id: "a11y-large-text",
    title: "Large Text Zoom (112.5%)",
    description: "Scales root typography for low vision",
  },
  {
    key: "reducedMotion",
    id: "a11y-reduced-motion",
    title: "Reduce Motion",
    description: "Disables animations for vestibular comfort",
  },
];

export function AccessibilitySettings() {
  const { preferences, setPreference } = useAccessibility();

  return (
    <section
      className="qm-panel accessibility-panel"
      aria-labelledby="accessibility-settings-title"
    >
      <div className="accessibility-panel-heading">
        <div className="accessibility-panel-copy">
          <h1 id="accessibility-settings-title">Accessibility settings</h1>
          <p>
            Customize your visual display, typography, motion preferences, and
            assistive navigation controls.
          </p>
        </div>
      </div>

      <div
        className="accessibility-settings-grid"
        role="group"
        aria-label="Accessibility preferences"
      >
        {ACCESSIBILITY_SETTINGS.map((setting) => {
          const titleId = `${setting.id}-title`;
          const descriptionId = `${setting.id}-description`;

          return (
            <label
              className="a11y-setting-card"
              htmlFor={setting.id}
              key={setting.key}
              data-tooltip={`${preferences[setting.key] ? "Turn off" : "Turn on"} ${setting.title}`}
            >
              <span className="a11y-setting-copy">
                <span className="a11y-setting-title" id={titleId}>
                  {setting.title}
                </span>
                <span className="a11y-setting-desc" id={descriptionId}>
                  {setting.description}
                </span>
              </span>
              <input
                id={setting.id}
                type="checkbox"
                className="a11y-setting-checkbox"
                checked={preferences[setting.key]}
                onChange={(event) =>
                  setPreference(setting.key, event.target.checked)
                }
                aria-labelledby={titleId}
                aria-describedby={descriptionId}
              />
            </label>
          );
        })}
      </div>

      <section
        className="a11y-keyboard-reference"
        aria-labelledby="a11y-keyboard-reference-title"
      >
        <h2 id="a11y-keyboard-reference-title">Keyboard &amp; Wheel Navigation:</h2>
        <ul>
          <li>
            <span className="a11y-key-combo">
              <kbd>←</kbd>
              <kbd>→</kbd>
            </span>
            <span className="a11y-key-text">Navigate slides &amp; question cards</span>
          </li>
          <li>
            <span className="a11y-key-combo">
              <kbd>↑</kbd>
              <kbd>↓</kbd>
            </span>
            <span className="a11y-key-text">or Scroll Wheel: Step options/milestones</span>
          </li>
          <li>
            <span className="a11y-key-combo">
              <kbd>Esc</kbd>
            </span>
            <span className="a11y-key-text">Close modal or drawer</span>
          </li>
        </ul>
      </section>
    </section>
  );
}

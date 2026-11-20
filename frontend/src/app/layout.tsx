import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AppTooltips } from "@/components/app-tooltips";
import { AccessibilityProvider } from "@/components/accessibility-provider";
import { ChatProvider } from "@/components/chat/chat-provider";
import { ToastProvider } from "@/components/toast";
import "./globals.css";

const byteBounce = localFont({
  src: "./fonts/ByteBounce.ttf",
  display: "swap",
  weight: "500",
  variable: "--font-byte-bounce",
});

export const metadata: Metadata = {
  title: "ByteQuest — Learn by building",
  description: "A guided programming quest platform for students and instructors.",
};

// viewport-fit=cover lets the phone tab bar and sheets pad themselves with
// env(safe-area-inset-*) so they clear the home indicator and rounded corners.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={byteBounce.variable}>
      <body>
        <AccessibilityProvider>
          <ToastProvider>
            <ChatProvider>
              <a href="#main-content" className="skip-to-content">
                Skip to main workspace
              </a>
              {children}
              <AppTooltips />
            </ChatProvider>
          </ToastProvider>
        </AccessibilityProvider>
      </body>
    </html>
  );
}

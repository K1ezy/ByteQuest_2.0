import type { Metadata } from "next";
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

import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { ErrorBoundary } from "@/components/error-boundary";
import { UnifiedAuthProvider } from "@/lib/unified-auth";

export const metadata: Metadata = {
  title: "Settlers - Strategic Game",
  description: "Master the art of economic strategy in a living market",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <UnifiedAuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <ErrorBoundary>
              {children}
              <Toaster />
            </ErrorBoundary>
          </ThemeProvider>
        </UnifiedAuthProvider>
      </body>
    </html>
  );
}

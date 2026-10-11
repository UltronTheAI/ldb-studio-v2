import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LioranDB Studio",
  description: "Secure web management console and control plane for LioranDB deployments.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased bg-white text-[#111111]" style={{ colorScheme: "light" }} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-white text-[#333333]" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sthashta — Where Founders Meet",
  description: "Sthashta is a live founder-meetup platform with a hand-made paper-and-ink visual language.",
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

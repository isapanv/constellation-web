import type { Metadata } from "next";
import "@fontsource-variable/manrope/index.css";
import "@fontsource-variable/unbounded/index.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Созвездие",
  description: "Сборка творческих команд под проект",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}

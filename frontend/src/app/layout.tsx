import './globals.css';
import React from 'react';
import { ThemeProvider } from '../components/ThemeProvider';

export const metadata = {
  title: 'TRACE | Digital Investigation Intelligence',
  description: 'Unified Digital Investigation & Analytics Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased selection:bg-primary/30 selection:text-primary-foreground min-h-screen">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';

export const metadata: Metadata = {
  title: 'PosterAI',
  description: 'Create, generate and download premium posters.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="hi">
      <body className="font-body antialiased">
        {children}
        <Toaster />
      </body>
    </html>
  );
}

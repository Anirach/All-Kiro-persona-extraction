import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { QueryProvider } from '@/providers/QueryProvider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Evidence-Based Persona Extraction',
  description: 'Web platform for traceable, evidence-bound persona extraction using LLMs',
  keywords: ['persona', 'extraction', 'evidence', 'citation', 'AI', 'LLM'],
  authors: [{ name: 'Persona Extraction Team' }],
  viewport: 'width=device-width, initial-scale=1',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full antialiased`}>
        <QueryProvider>
          <div className="min-h-full bg-gray-50">
            <header className="bg-white shadow-sm border-b border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                  <div className="flex items-center">
                    <h1 className="text-xl font-semibold text-gray-900">
                      Evidence-Based Persona Extraction
                    </h1>
                  </div>
                  <nav className="flex space-x-4">
                    <a
                      href="/projects"
                      className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Projects
                    </a>
                    <a
                      href="/docs"
                      className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                    >
                      Documentation
                    </a>
                  </nav>
                </div>
              </div>
            </header>
            <main className="flex-1">
              {children}
            </main>
            <footer className="bg-white border-t border-gray-200">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                <p className="text-center text-sm text-gray-500">
                  © 2025 Evidence-Based Persona Extraction Platform. All rights reserved.
                </p>
              </div>
            </footer>
          </div>
        </QueryProvider>
      </body>
    </html>
  );
}

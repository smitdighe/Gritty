import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createQueryClient } from '@/lib/queryClient';
import { ThemeProvider } from './theme';
import { ErrorBoundary } from './ErrorBoundary';

// One client for the app's lifetime. Defaults (no refetchOnWindowFocus,
// retry:false) come from createQueryClient — polling is wired in phase 6.
const queryClient = createQueryClient();

/** Compose the app-wide providers: error boundary → theme → query client. */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

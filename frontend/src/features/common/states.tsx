import { Skeleton } from '@/components/ui/Skeleton';
import { GrittyApiError } from '@/api/GrittyApiError';

/** Extract a human message from an unknown query error, preferring the typed code. */
export function errorMessage(error: unknown): { code: string; message: string } {
  if (error instanceof GrittyApiError) {
    return { code: error.code, message: error.message };
  }
  if (error instanceof Error) return { code: 'JSError', message: error.message };
  return { code: 'UnknownError', message: 'An unknown error occurred.' };
}

/** Inline error surface — never blank on failure. Shows the backend code + message. */
export function ErrorNote({ error }: { error: unknown }) {
  const { code, message } = errorMessage(error);
  return (
    <div
      role="alert"
      className="rounded border border-diff-remove/40 bg-diff-remove-bg px-3 py-2 text-sm text-diff-remove"
    >
      <span className="font-semibold">{code}</span>
      <span className="text-fg-muted"> · </span>
      <span>{message}</span>
    </div>
  );
}

/** A stack of skeleton rows for list loading states. */
export function LoadingRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-6 w-full" />
      ))}
    </div>
  );
}

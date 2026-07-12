import { Component, type ErrorInfo, type ReactNode } from 'react';
import { GrittyApiError } from '@/api/GrittyApiError';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Human-readable hint per known backend error code. */
function hintForCode(code: string): string {
  switch (code) {
    case 'NotARepo':
      return 'No Gritty repository was found at the configured path.';
    case 'BadObject':
      return 'An object could not be read — it may be missing or corrupt.';
    case 'RefNotFound':
      return 'A branch, tag, or revision could not be resolved.';
    case 'UsageError':
      return 'The request was rejected as invalid.';
    case 'NetworkError':
      return 'Could not reach the Gritty API (connection refused, DNS, or CORS).';
    case 'TimeoutError':
      return 'The Gritty API did not respond in time.';
    default:
      return 'An unexpected error occurred.';
  }
}

/**
 * App-level error boundary with a typed-error-aware fallback: a GrittyApiError
 * renders its backend `code` + message + hint; any other JS error renders a
 * generic unexpected-error panel. Both use the phase-1 Panel.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface to the console; a real reporter lands in a later phase.
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isApi = error instanceof GrittyApiError;
    const code = isApi ? error.code : 'JSError';
    const title = isApi ? `Gritty error · ${code}` : 'Unexpected error';

    return (
      <div className="flex min-h-screen items-center justify-center bg-bg p-6">
        <div className="w-full max-w-lg">
          <Panel title={title}>
            <div className="flex flex-col gap-3">
              <p className="text-sm text-fg-muted">{hintForCode(code)}</p>
              <pre className="overflow-auto rounded border border-border bg-bg-inset p-2 text-xs text-diff-remove">
                {error.message}
              </pre>
              <div>
                <Button variant="default" onClick={this.reset}>
                  Try again
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      </div>
    );
  }
}

import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

/** 404 — rendered outside the app shell. */
export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-fg">
      <div className="text-center">
        <div className="font-sans text-5xl font-bold text-accent">404</div>
        <p className="mt-2 text-sm text-fg-muted">No route matches this URL.</p>
      </div>
      <Link to="/repo">
        <Button variant="default">Back to repository</Button>
      </Link>
    </div>
  );
}

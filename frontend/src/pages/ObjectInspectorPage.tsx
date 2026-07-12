import { useParams } from 'react-router-dom';
import { Panel } from '@/components/ui/Panel';
import { shortenSha } from '@/lib/format';

/** Route params for /repo/objects/:sha */
interface ObjectInspectorParams extends Record<string, string | undefined> {
  sha: string;
}

/** Single-object inspector: decoded type/size/content. Filled in a later phase. */
export default function ObjectInspectorPage() {
  const { sha } = useParams<ObjectInspectorParams>();

  return (
    <Panel title={`Object ${sha ? shortenSha(sha) : ''}`}>
      <p className="text-sm text-fg-muted">
        Decoded object view — type, size, and content (blob / tree entries / commit).
      </p>
      {sha && <p className="mt-1 text-xs text-hash">{sha}</p>}
    </Panel>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { trpc } from '../../lib/trpc';

const api = trpc as any;

type AuditEntry = {
  id: string;
  actorId: string;
  actorType: 'user' | 'agent';
  action: string;
  detail: string;
  costTokens: number;
  createdAt: string;
};

export default function Page() {
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadAudit(search?: string) {
    setLoading(true);
    setError(null);
    try {
      const result = await api.audit.list.query({
        limit: 100,
        offset: 0,
        ...(search && search.trim() ? { query: search.trim() } : {}),
      });
      setItems(result.items as AuditEntry[]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void loadAudit(query);
  }

  useEffect(() => {
    void loadAudit();
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Audit Log</h2>
      <form className="flex gap-2" onSubmit={onSearch}>
        <input
          className="w-full rounded bg-slate-900 p-2"
          placeholder="Search action, actor, detail..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Button type="submit">Search</Button>
        <Button type="button" onClick={() => void loadAudit()}>
          Refresh
        </Button>
      </form>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
      {!loading && items.length === 0 ? <p className="text-sm text-slate-400">No audit entries found.</p> : null}
      <ul className="space-y-2">
        {items.map((entry) => (
          <li key={entry.id} className="rounded border border-slate-800 p-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">{entry.action}</span>
              <span className="text-slate-400">
                {entry.actorType}:{entry.actorId}
              </span>
              <span className="text-slate-500">{new Date(entry.createdAt).toLocaleString()}</span>
              <span className="text-slate-500">cost: {entry.costTokens}</span>
            </div>
            <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2 text-xs">{entry.detail}</pre>
          </li>
        ))}
      </ul>
    </section>
  );
}

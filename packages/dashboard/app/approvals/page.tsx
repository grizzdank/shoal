'use client';

import { useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { trpc } from '../../lib/trpc';

const api = trpc as any;

type Approval = {
  id: string;
  agentId: string;
  actionType: string;
  state: 'pending' | 'approved' | 'rejected' | 'expired';
  requestedAt: string;
};

export default function Page() {
  const [items, setItems] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function loadPending() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.approvals.listPending.query({ limit: 100 });
      setItems(result.items as Approval[]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function decide(id: string, decision: 'approved' | 'rejected') {
    setDecidingId(id);
    setError(null);
    setStatus(null);
    try {
      await api.approvals.decide.mutate({ id, decision });
      setStatus(`Request ${decision}.`);
      await loadPending();
    } catch (err) {
      setError(String(err));
    } finally {
      setDecidingId(null);
    }
  }

  useEffect(() => {
    void loadPending();
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Approvals</h2>
      <p className="text-sm text-slate-400">
        Pending high-impact actions waiting for a decision.
      </p>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
      {status ? <p className="text-sm text-emerald-400">{status}</p> : null}
      {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-slate-400">No pending approvals.</p>
      ) : null}
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded border border-slate-800 p-3">
            <p className="font-medium">{item.actionType}</p>
            <p className="text-xs text-slate-400">Agent: {item.agentId}</p>
            <p className="text-xs text-slate-500">
              {new Date(item.requestedAt).toLocaleString()}
            </p>
            <div className="mt-3 flex gap-2">
              <Button
                disabled={decidingId === item.id}
                onClick={() => void decide(item.id, 'approved')}
              >
                {decidingId === item.id ? 'Saving...' : 'Approve'}
              </Button>
              <Button
                className="bg-red-200"
                disabled={decidingId === item.id}
                onClick={() => void decide(item.id, 'rejected')}
              >
                Reject
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

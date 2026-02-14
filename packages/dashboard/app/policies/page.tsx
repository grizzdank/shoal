'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { trpc } from '../../lib/trpc';

const api = trpc as any;

type Policy = {
  id: string;
  type: string;
  rulesJson: Record<string, unknown>;
  enabled: boolean;
};

export default function Page() {
  const [items, setItems] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<'content_filter' | 'tool_restriction' | 'approval_required'>(
    'content_filter',
  );
  const [enabled, setEnabled] = useState(true);
  const [rulesText, setRulesText] = useState('{\n  "blockedTerms": ["ssn"]\n}');
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadPolicies() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.policies.list.query({ limit: 50, offset: 0 });
      setItems(result.items as Policy[]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const rulesJson = JSON.parse(rulesText) as Record<string, unknown>;
      if (editingId) {
        await api.policies.update.mutate({
          id: editingId,
          data: { type, rulesJson, enabled },
        });
      } else {
        await api.policies.create.mutate({ type, rulesJson, enabled });
      }
      setEditingId(null);
      setType('content_filter');
      setEnabled(true);
      setRulesText('{\n  "blockedTerms": ["ssn"]\n}');
      await loadPolicies();
    } catch (err) {
      setError(String(err));
    }
  }

  function beginEdit(policy: Policy) {
    setEditingId(policy.id);
    setType(policy.type as typeof type);
    setEnabled(policy.enabled);
    setRulesText(JSON.stringify(policy.rulesJson, null, 2));
  }

  function cancelEdit() {
    setEditingId(null);
    setType('content_filter');
    setEnabled(true);
    setRulesText('{\n  "blockedTerms": ["ssn"]\n}');
  }

  async function removePolicy(id: string) {
    setError(null);
    try {
      await api.policies.delete.mutate({ id });
      if (editingId === id) {
        cancelEdit();
      }
      await loadPolicies();
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    void loadPolicies();
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Policies</h2>
      <form className="space-y-3 rounded border border-slate-700 p-4" onSubmit={onCreate}>
        <h3 className="text-lg font-medium">{editingId ? 'Edit Policy' : 'Create Policy'}</h3>
        <div className="grid gap-2 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Type</span>
            <select
              className="w-full rounded bg-slate-900 p-2"
              value={type}
              onChange={(e) => setType(e.target.value as typeof type)}
            >
              <option value="content_filter">content_filter</option>
              <option value="tool_restriction">tool_restriction</option>
              <option value="approval_required">approval_required</option>
            </select>
          </label>
          <label className="flex items-end gap-2">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span className="text-sm text-slate-300">Enabled</span>
          </label>
        </div>
        <label className="space-y-1 block">
          <span className="text-sm text-slate-300">Rules JSON</span>
          <textarea
            className="h-40 w-full rounded bg-slate-900 p-2 font-mono text-sm"
            value={rulesText}
            onChange={(e) => setRulesText(e.target.value)}
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit">{editingId ? 'Save Changes' : 'Create'}</Button>
          {editingId ? (
            <Button className="bg-slate-300" onClick={cancelEdit} type="button">
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Existing Policies</h3>
        {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
        {!loading && items.length === 0 ? <p className="text-sm text-slate-400">No policies yet.</p> : null}
        <ul className="space-y-2">
          {items.map((policy) => (
            <li key={policy.id} className="rounded border border-slate-800 p-3">
              <p className="text-sm">
                <span className="font-semibold">{policy.type}</span>{' '}
                <span className="text-slate-400">({policy.enabled ? 'enabled' : 'disabled'})</span>
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2 text-xs">
                {JSON.stringify(policy.rulesJson, null, 2)}
              </pre>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => beginEdit(policy)} type="button">
                  Edit
                </Button>
                <Button className="bg-red-200" onClick={() => void removePolicy(policy.id)} type="button">
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { trpc } from '../../lib/trpc';

const api = trpc as any;

type Agent = {
  id: string;
  name: string;
  systemPrompt: string;
  model: string;
  channels: string[];
  toolPermissions: Record<string, unknown>;
  status: string;
};

export default function Page() {
  const [items, setItems] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [model, setModel] = useState('gpt-4.1-mini');
  const [status, setStatus] = useState('active');
  const [channelsText, setChannelsText] = useState('["signal","discord"]');
  const [toolPermissionsText, setToolPermissionsText] = useState(
    '{\n  "allowTools": ["search"]\n}',
  );

  async function loadAgents() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.agents.list.query({ limit: 100, offset: 0 });
      setItems(result.items as Agent[]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setName('');
    setSystemPrompt('');
    setModel('gpt-4.1-mini');
    setStatus('active');
    setChannelsText('["signal","discord"]');
    setToolPermissionsText('{\n  "allowTools": ["search"]\n}');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const channels = JSON.parse(channelsText) as string[];
      const toolPermissions = JSON.parse(toolPermissionsText) as Record<
        string,
        unknown
      >;
      if (!Array.isArray(channels)) {
        throw new Error('Channels JSON must be an array of strings');
      }
      if (editingId) {
        await api.agents.update.mutate({
          id: editingId,
          data: {
            name,
            systemPrompt,
            model,
            channels,
            toolPermissions,
            status,
          },
        });
      } else {
        await api.agents.create.mutate({
          name,
          systemPrompt,
          model,
          channels,
          toolPermissions,
          status,
        });
      }
      resetForm();
      await loadAgents();
    } catch (err) {
      setError(String(err));
    }
  }

  function beginEdit(agent: Agent) {
    setEditingId(agent.id);
    setName(agent.name);
    setSystemPrompt(agent.systemPrompt);
    setModel(agent.model);
    setStatus(agent.status);
    setChannelsText(JSON.stringify(agent.channels, null, 2));
    setToolPermissionsText(JSON.stringify(agent.toolPermissions, null, 2));
  }

  async function removeAgent(id: string) {
    setError(null);
    try {
      await api.agents.delete.mutate({ id });
      if (editingId === id) {
        resetForm();
      }
      await loadAgents();
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    void loadAgents();
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Agents</h2>
      <form
        className="space-y-3 rounded border border-slate-700 p-4"
        onSubmit={onSubmit}
      >
        <h3 className="text-lg font-medium">
          {editingId ? 'Edit Agent' : 'Create Agent'}
        </h3>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Name</span>
            <input
              className="w-full rounded bg-slate-900 p-2"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Model</span>
            <input
              className="w-full rounded bg-slate-900 p-2"
              required
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-slate-300">System Prompt</span>
            <textarea
              className="h-24 w-full rounded bg-slate-900 p-2"
              required
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Status</span>
            <input
              className="w-full rounded bg-slate-900 p-2"
              required
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Channels JSON</span>
            <textarea
              className="h-24 w-full rounded bg-slate-900 p-2 font-mono text-sm"
              required
              value={channelsText}
              onChange={(e) => setChannelsText(e.target.value)}
            />
          </label>
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm text-slate-300">
              Tool Permissions JSON
            </span>
            <textarea
              className="h-32 w-full rounded bg-slate-900 p-2 font-mono text-sm"
              required
              value={toolPermissionsText}
              onChange={(e) => setToolPermissionsText(e.target.value)}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit">
            {editingId ? 'Save Changes' : 'Create Agent'}
          </Button>
          {editingId ? (
            <Button className="bg-slate-300" type="button" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Existing Agents</h3>
        {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
        {!loading && items.length === 0 ? (
          <p className="text-sm text-slate-400">No agents yet.</p>
        ) : null}
        <ul className="space-y-2">
          {items.map((agent) => (
            <li className="rounded border border-slate-800 p-3" key={agent.id}>
              <p className="font-medium">{agent.name}</p>
              <p className="text-sm text-slate-300">
                model: {agent.model} · status: {agent.status}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {agent.systemPrompt}
              </p>
              <pre className="mt-2 overflow-x-auto rounded bg-slate-900 p-2 text-xs">
                {JSON.stringify(
                  {
                    channels: agent.channels,
                    toolPermissions: agent.toolPermissions,
                  },
                  null,
                  2,
                )}
              </pre>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => beginEdit(agent)} type="button">
                  Edit
                </Button>
                <Button
                  className="bg-red-200"
                  onClick={() => void removeAgent(agent.id)}
                  type="button"
                >
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

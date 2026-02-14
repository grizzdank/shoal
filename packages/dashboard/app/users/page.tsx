'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '../../components/ui/button';
import { trpc } from '../../lib/trpc';

const api = trpc as any;

type User = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'member' | 'viewer';
  authProvider: string;
};

export default function Page() {
  const [items, setItems] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<User['role']>('member');
  const [authProvider, setAuthProvider] = useState('google');

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const result = await api.users.list.query({ limit: 100, offset: 0 });
      setItems(result.items as User[]);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setEmail('');
    setName('');
    setRole('member');
    setAuthProvider('google');
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      if (editingId) {
        await api.users.update.mutate({
          id: editingId,
          data: { email, name, role, authProvider },
        });
      } else {
        await api.users.create.mutate({ email, name, role, authProvider });
      }
      resetForm();
      await loadUsers();
    } catch (err) {
      setError(String(err));
    }
  }

  function beginEdit(user: User) {
    setEditingId(user.id);
    setEmail(user.email);
    setName(user.name);
    setRole(user.role);
    setAuthProvider(user.authProvider);
  }

  async function removeUser(id: string) {
    setError(null);
    try {
      await api.users.delete.mutate({ id });
      if (editingId === id) {
        resetForm();
      }
      await loadUsers();
    } catch (err) {
      setError(String(err));
    }
  }

  useEffect(() => {
    void loadUsers();
  }, []);

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Users</h2>
      <form className="space-y-3 rounded border border-slate-700 p-4" onSubmit={onSubmit}>
        <h3 className="text-lg font-medium">{editingId ? 'Edit User' : 'Invite User'}</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Email</span>
            <input
              className="w-full rounded bg-slate-900 p-2"
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
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
            <span className="text-sm text-slate-300">Role</span>
            <select
              className="w-full rounded bg-slate-900 p-2"
              value={role}
              onChange={(e) => setRole(e.target.value as User['role'])}
            >
              <option value="admin">admin</option>
              <option value="member">member</option>
              <option value="viewer">viewer</option>
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm text-slate-300">Auth Provider</span>
            <input
              className="w-full rounded bg-slate-900 p-2"
              required
              value={authProvider}
              onChange={(e) => setAuthProvider(e.target.value)}
            />
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit">{editingId ? 'Save Changes' : 'Create User'}</Button>
          {editingId ? (
            <Button className="bg-slate-300" type="button" onClick={resetForm}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      {error ? <p className="text-sm text-red-400">{error}</p> : null}

      <div className="space-y-2">
        <h3 className="text-lg font-medium">Existing Users</h3>
        {loading ? <p className="text-sm text-slate-400">Loading...</p> : null}
        {!loading && items.length === 0 ? <p className="text-sm text-slate-400">No users yet.</p> : null}
        <ul className="space-y-2">
          {items.map((user) => (
            <li className="rounded border border-slate-800 p-3" key={user.id}>
              <p className="font-medium">{user.name}</p>
              <p className="text-sm text-slate-300">{user.email}</p>
              <p className="text-xs text-slate-500">
                role: {user.role} · provider: {user.authProvider}
              </p>
              <div className="mt-3 flex gap-2">
                <Button onClick={() => beginEdit(user)} type="button">
                  Edit
                </Button>
                <Button className="bg-red-200" onClick={() => void removeUser(user.id)} type="button">
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

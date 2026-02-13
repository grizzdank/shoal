const nav = [
  ['Dashboard', '/'],
  ['Agents', '/agents'],
  ['Users', '/users'],
  ['Policies', '/policies'],
  ['Audit Log', '/audit-log'],
  ['Approvals', '/approvals'],
  ['Documents', '/documents'],
] as const;

export function Sidebar() {
  return (
    <aside className="w-64 border-r border-slate-800 p-4">
      <h1 className="mb-6 text-xl font-semibold">Shoal Admin</h1>
      <nav className="space-y-2">
        {nav.map(([label, href]) => (
          <a className="block rounded px-3 py-2 hover:bg-slate-800" href={href} key={href}>
            {label}
          </a>
        ))}
      </nav>
    </aside>
  );
}

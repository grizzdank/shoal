export default function Page() {
  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Documents</h2>
      <p className="max-w-2xl text-sm text-slate-300">
        Document ingestion and review workflows are coming soon. Governance and
        audit capabilities are already active for policy evaluations and tool
        calls.
      </p>
      <div className="rounded border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
        For this sprint, use the Audit Log page to verify policy activity while
        document workflows are finalized.
      </div>
    </section>
  );
}

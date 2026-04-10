type MetricCardProps = {
  label: string;
  value: string;
  detail?: string;
};

export default function MetricCard({
  label,
  value,
  detail,
}: MetricCardProps) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
      {detail ? (
        <p className="mt-2 text-sm leading-6 text-slate-600">{detail}</p>
      ) : null}
    </article>
  );
}

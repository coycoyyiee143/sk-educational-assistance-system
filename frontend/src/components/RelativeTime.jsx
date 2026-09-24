function formatRelative(date, now) {
  const seconds = Math.round((now - date) / 1000);

  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;

  const years = Math.round(months / 12);
  return `${years}y ago`;
}

// Renders a submission timestamp for verifier queue tables: the exact
// date/time is the primary, always-visible text (this is a back-office
// audit context — verifiers need to eyeball precise FCFS order without
// depending on hover, which doesn't work on tablets/touch), with the
// relative "X ago" shown underneath as a lightweight glance aid.
function RelativeTime({ value, fallback = "—", className, showSeconds = false }) {
  if (!value) return <span className={className}>{fallback}</span>;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return <span className={className}>{fallback}</span>;
  }

  const exact = date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: showSeconds ? "medium" : "short",
  });

  return (
    <span className={className}>
      {exact}
      <br />
      <small className="text-muted">{formatRelative(date, new Date())}</small>
    </span>
  );
}

export default RelativeTime;

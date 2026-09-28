const STATUSES = [
  "Collected",
  "Tested",
  "Processed",
  "Packaged",
  "Distributed",
];

function SupplyChainStats({ batches }) {
  const total = batches.length;
    const delayed = batches.filter(
    (batch) => batch.delayed === true
  ).length;
  const counts = STATUSES.reduce(
    (result, status) => {
      result[status] = batches.filter(
        (batch) => batch.status === status
      ).length;

      return result;
    },
    {}
  );

  const active =
    counts.Collected +
    counts.Tested +
    counts.Processed +
    counts.Packaged;

  const stats = [
    {
      label: "Total Batches",
      value: total,
      icon: "📊",
      className: "stat-total",
    },
    {
      label: "Collected",
      value: counts.Collected,
      icon: "🌱",
      className: "stat-collected",
    },
    {
      label: "Tested",
      value: counts.Tested,
      icon: "🔬",
      className: "stat-tested",
    },
    {
      label: "Processed",
      value: counts.Processed,
      icon: "⚙️",
      className: "stat-processed",
    },
    {
      label: "Packaged",
      value: counts.Packaged,
      icon: "📦",
      className: "stat-packaged",
    },
        {
      label: "Distributed",
      value: counts.Distributed,
      icon: "🚚",
      className: "stat-distributed",
    },
    {
      label: "Delayed Batches",
      value: delayed,
      icon: "⚠️",
      className: "stat-delayed",
    },
  ];
  

  return (
    <div className="stats-grid">
      {stats.map((stat) => (
        <div
          className={`stat-card ${stat.className}`}
          key={stat.label}
        >
          <div className="stat-icon">
            {stat.icon}
          </div>

          <div className="stat-content">
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        </div>
      ))}

      <div className="stat-card stat-active">
        <div className="stat-icon">⚡</div>

        <div className="stat-content">
          <span>Active Batches</span>
          <strong>{active}</strong>
        </div>
      </div>
    </div>
  );
}

export default SupplyChainStats;
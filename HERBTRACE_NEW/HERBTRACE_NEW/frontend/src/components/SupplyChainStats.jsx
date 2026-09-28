const STATUSES = [
  {
    key: "Collected",
    label: "Collected",
    icon: "🌱",
  },
  {
    key: "Tested",
    label: "Tested",
    icon: "🔬",
  },
  {
    key: "Processed",
    label: "Processed",
    icon: "⚙️",
  },
  {
    key: "Packaged",
    label: "Packaged",
    icon: "📦",
  },
  {
    key: "Distributed",
    label: "Distributed",
    icon: "🚚",
  },
];

function SupplyChainStats({ batches }) {
  const safeBatches = batches || [];

  const total = safeBatches.length;

  const getCount = (status) =>
    safeBatches.filter(
      (batch) => batch.status === status
    ).length;

  const delayed = safeBatches.filter(
    (batch) => batch.delayed
  ).length;

  return (
    <div className="health-overview">

      <div className="health-summary">
        <div className="health-ring">
          <div>
            <strong>{total}</strong>
            <span>Batches</span>
          </div>
        </div>

        <div className="health-copy">
          <strong>
            Supply chain visibility
          </strong>

          <span>
            {delayed > 0
              ? `${delayed} batch${
                  delayed === 1 ? "" : "es"
                } require attention`
              : "All tracked batches within monitoring range"}
          </span>

          <div className="health-status">
            <span
              className={
                delayed > 0
                  ? "health-dot warning"
                  : "health-dot"
              }
            />

            {delayed > 0
              ? "Attention required"
              : "Operating normally"}
          </div>
        </div>
      </div>

      <div className="status-mini-grid">
        {STATUSES.map((status) => {
          const count = getCount(
            status.key
          );

          return (
            <div
              className={`status-mini ${
                status.key.toLowerCase()
              }`}
              key={status.key}
            >
              <div className="status-mini-icon">
                {status.icon}
              </div>

              <div>
                <span>
                  {status.label}
                </span>

                <strong>
                  {count}
                </strong>
              </div>
            </div>
          );
        })}
      </div>

      {delayed > 0 && (
        <div className="stats-delay-alert">
          <span>⚠️</span>

          <div>
            <strong>
              {delayed} delayed batch
              {delayed === 1
                ? ""
                : "es"}
            </strong>

            <small>
              Review the batch journey for
              threshold violations.
            </small>
          </div>
        </div>
      )}

    </div>
  );
}

export default SupplyChainStats;
const STAGES = [
  {
    key: "Collected",
    label: "Collected",
    role: "Farmer",
    icon: "🌱",
  },
  {
    key: "Tested",
    label: "Tested",
    role: "Lab",
    icon: "🔬",
  },
  {
    key: "Processed",
    label: "Processed",
    role: "Processor",
    icon: "⚙️",
  },
  {
    key: "Packaged",
    label: "Packaged",
    role: "Processor",
    icon: "📦",
  },
  {
    key: "Distributed",
    label: "Distributed",
    role: "Distributor",
    icon: "🚚",
  },
];

/*
  Important:
  The smart contract allows Distributed directly after Processed.
  Therefore Distributed does NOT mean Packaged happened.

  This function tells us exactly which stages have
  actually been reached based on the current status.
*/
function isStageCompleted(batchStatus, stageKey) {
  const completedStages = {
    Collected: ["Collected"],
    Tested: ["Collected", "Tested"],
    Processed: ["Collected", "Tested", "Processed"],
    Packaged: [
      "Collected",
      "Tested",
      "Processed",
      "Packaged",
    ],
    Distributed: [
      "Collected",
      "Tested",
      "Processed",
      "Distributed",
    ],
  };

  return (
    completedStages[batchStatus]?.includes(stageKey) ||
    false
  );
}

function SupplyChainPipeline({ batches }) {
  if (!batches || batches.length === 0) {
    return (
      <div className="pipeline-empty">
        No batches available.
      </div>
    );
  }

  return (
    <div className="pipeline-container">
      {batches.map((batch) => (
        <div
          className="batch-pipeline"
          key={batch.batchId}
        >
          {/* BATCH HEADER */}

<div className="batch-pipeline-header">
  <div>
    <h3>{batch.batchId}</h3>

    <span className="batch-owner">
      Owner:{" "}
      {batch.currentOwner
        ? `${batch.currentOwner.slice(
            0,
            6
          )}...${batch.currentOwner.slice(-4)}`
        : "Unknown"}
    </span>
  </div>

  <div className="batch-status-group">
    <span className="current-status">
      {batch.status}
    </span>

    {batch.delayed && (
      <span className="delayed-badge">
        ⚠️ DELAYED
      </span>
    )}
  </div>
</div>

{/* PIPELINE */}

<div className="pipeline">
  {STAGES.map((stage, index) => {
    const completed = isStageCompleted(
      batch.status,
      stage.key
    );

    const current =
      batch.status === stage.key;

    return (
      <div
        className="pipeline-stage-wrapper"
        key={stage.key}
      >
        <div
          className={`pipeline-stage ${
            completed ? "completed" : ""
          } ${
            current ? "current" : ""
          }`}
        >
          <div className="stage-icon">
            {stage.icon}
          </div>

          <div className="stage-label">
            {stage.label}
          </div>

          <div className="stage-role">
            {stage.role}
          </div>

          <div className="stage-state">
            {completed
              ? current
                ? "CURRENT"
                : "COMPLETED"
              : "PENDING"}
          </div>
        </div>

        {index < STAGES.length - 1 && (
          <div className="pipeline-connector">
            →
          </div>
        )}
      </div>
    );
  })}
</div>

{/* LINEAGE */}

{batch.parents &&
  batch.parents.length > 0 && (
    <div className="batch-lineage">
      <span>🔗</span>

      <span>
        Parent batch:
      </span>

      <strong>
        {batch.parents.join(", ")}
      </strong>
    </div>
  )}
</div>
))}

</div>
);
}

export default SupplyChainPipeline;
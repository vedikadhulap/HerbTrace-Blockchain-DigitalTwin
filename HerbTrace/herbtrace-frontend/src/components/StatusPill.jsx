import { Circle } from "lucide-react";

function StatusPill({ status }) {
  return (
    <span className={`status-pill status-${status}`}>
      <Circle size={6} fill="currentColor" />
      {status}
    </span>
  );
}

export default StatusPill;

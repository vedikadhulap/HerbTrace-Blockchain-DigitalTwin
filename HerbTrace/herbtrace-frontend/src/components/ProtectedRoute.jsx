import { Navigate } from "react-router-dom";

const roleRoutes = {
  farmer:      "/create-batch",
  lab:         "/lab-test",
  processor:   "/process-batch",
  distributor: "/transfer",
  admin:       "/admin",
};

function ProtectedRoute({ children, requiredRole }) {
  const token = localStorage.getItem("token");
  const role  = localStorage.getItem("role");

  if (!token) return <Navigate to="/login" replace />;
  if (requiredRole && role !== requiredRole) {
    return <Navigate to={roleRoutes[role] || "/login"} replace />;
  }

  return children;
}

export default ProtectedRoute;

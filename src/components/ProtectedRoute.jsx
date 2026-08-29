import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, moduleId, allowedRoles }) {
  const { session, profile, can, loading } = useAuth();

  if (loading) {
    return <div className="p-8 text-navy-500">Chargement…</div>;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(profile?.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  if (moduleId && !can(moduleId)) {
    return (
      <div className="p-8">
        <p className="text-navy-700">
          Tu n'as pas encore accès à ce module. Demande au super admin de l'activer
          depuis la rubrique Permissions.
        </p>
      </div>
    );
  }
  return children;
}

import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { UserRole } from '@eduplatform/shared';
import { useAuthStore } from '../store/authStore';
import { authApi } from '../api/auth';

const ROLE_DASHBOARDS: Record<UserRole, string> = {
  [UserRole.ADMIN]: '/admin/dashboard',
  [UserRole.TEACHER]: '/teacher/dashboard',
  [UserRole.STUDENT]: '/student/dashboard',
};

interface PrivateRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function PrivateRoute({ children, allowedRoles }: PrivateRouteProps) {
  const { user, isLoading, setUser, setLoading } = useAuthStore();
  const location = useLocation();

  useEffect(() => {
    if (user) return;
    setLoading(true);
    authApi.me()
      .then((res) => setUser(res.data))
      .catch(() => setUser(null));
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400 text-lg">Загрузка...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_DASHBOARDS[user.role]} replace />;
  }

  return <>{children}</>;
}

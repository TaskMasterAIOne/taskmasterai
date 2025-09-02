import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface PrivateRouteProps {
  children: React.ReactNode;
}

export const PrivateRoute: React.FC<PrivateRouteProps> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-gray-100 dark:bg-[var(--bg-page-dark)] flex items-center justify-center">
      <div className="w-10 h-10 text-indigo-500 animate-spin">⏳</div>
    </div>;
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

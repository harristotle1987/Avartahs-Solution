import React from 'react';
import { Navigate } from 'react-router-dom';

// Single login architecture: All admin login flows route through the approved LoginModal via /admin/dashboard
const AdminLogin: React.FC = () => {
  return <Navigate to="/admin/dashboard" replace />;
};

export default AdminLogin;

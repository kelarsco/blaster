import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ActivityLog } from '../components/ActivityLog';

export function AppLayout() {
  const [showActivity, setShowActivity] = useState(false);
  return (
    <div className="min-h-screen flex bg-blaster-bg-app">
      <Sidebar onOpenActivity={() => setShowActivity(true)} />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      {showActivity && <ActivityLog onClose={() => setShowActivity(false)} />}
    </div>
  );
}

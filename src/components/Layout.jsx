import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext_simple';

const navItems = [
    { icon: 'queue', label: 'OPD Queue', path: '/dashboard' },
    { icon: 'bed', label: 'Bed Queue', path: '/bed-queue' },
    { icon: 'monitor_heart', label: 'ICU Queue', path: '/icu-queue' },
    { icon: 'meeting_room', label: 'Bed Scheduling', path: '/bed-management' },
    { icon: 'schedule', label: 'ICU Scheduling', path: '/icu-scheduling' },
    { icon: 'groups', label: 'Patients', path: '/patients' },
    { icon: 'calendar_today', label: 'Appointments', path: '/appointments' },
    { icon: 'psychology', label: 'AI Prediction', path: '/ai-prediction' },
];

export default function Layout({ children }) {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, userRole, signOut } = useAuth();

    const handleSignOut = async () => {
        const { error } = await signOut();
        if (!error) {
            navigate('/');
        }
    };

    const getUserInitials = () => {
        if (!user?.email) return 'U';
        return user.email.charAt(0).toUpperCase();
    };

    const getUserName = () => {
        if (!user?.email) return 'User';
        return user.email.split('@')[0];
    };

    return (
        <div className="flex h-screen w-full overflow-hidden bg-[#f6f7f8] font-sans text-slate-900 antialiased">

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-20 bg-black/40 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ── Sidebar ── */}
            <aside
                className={`fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-300
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0 lg:flex`}
            >
                {/* Logo */}
                <div className="flex h-16 items-center border-b border-slate-200 px-6">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-[#2b8cee] text-white">
                            <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
                        </div>
                        <span className="text-lg font-bold tracking-tight text-slate-900">MediFlow</span>
                    </div>
                </div>

                <div className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
                    {/* Main Nav */}
                    <nav className="flex flex-1 flex-col gap-1">
                        {navItems.map((item) => {
                            const isActive = location.pathname === item.path;
                            return (
                                <a
                                    key={item.label}
                                    href="#"
                                    onClick={(e) => { e.preventDefault(); if (item.path) navigate(item.path); }}
                                    className={`flex items-center gap-3 rounded-lg px-3 py-2 transition-colors ${isActive
                                        ? 'bg-[#2b8cee]/10 text-[#2b8cee] font-semibold'
                                        : 'text-slate-600 hover:bg-slate-100'
                                        }`}
                                >
                                    <span className="material-symbols-outlined">{item.icon}</span>
                                    <span className="font-medium">{item.label}</span>
                                </a>
                            );
                        })}
                    </nav>

                    {/* User Card */}
                    <div className="mt-auto flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-[#2b8cee] flex items-center justify-center text-white font-semibold">
                            {getUserInitials()}
                        </div>
                        <div className="flex flex-1 flex-col min-w-0">
                            <span className="text-sm font-medium text-slate-900 truncate capitalize">
                                {userRole === 'doctor' ? 'Dr. ' : ''}{getUserName()}
                            </span>
                            <span className="text-xs text-slate-500 capitalize">{userRole}</span>
                        </div>
                        <button
                            onClick={handleSignOut}
                            className="text-slate-400 hover:text-slate-600 shrink-0 transition-colors"
                            title="Sign out"
                        >
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* ── Page Content ── */}
            <div className="flex flex-1 flex-col overflow-hidden">
                {/* Mobile topbar with menu toggle */}
                <div className="flex h-12 items-center border-b border-slate-200 bg-white px-4 lg:hidden">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="text-slate-500 hover:text-[#2b8cee]"
                    >
                        <span className="material-symbols-outlined">menu</span>
                    </button>
                    <span className="ml-3 text-sm font-bold text-slate-900">MediFlow</span>
                </div>

                {children}
            </div>
        </div>
    );
}

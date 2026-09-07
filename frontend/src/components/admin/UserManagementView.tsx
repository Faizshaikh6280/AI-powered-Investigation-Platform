'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Users, UserPlus, Shield, Search, RefreshCw, Filter, 
  CheckCircle2, XCircle, MoreVertical, ShieldAlert, KeyRound, Building2, Smartphone
} from 'lucide-react';
import { apiClient, UserProfile } from '../../services/apiClient';
import InviteOfficerModal from './InviteOfficerModal';
import NFCCardsManagementView from './NFCCardsManagementView';

export default function UserManagementView() {
  const [activeTab, setActiveTab] = useState<'users' | 'nfc'>('users');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [roles, setRoles] = useState<Array<{ name: string; display_name: string }>>([]);
  const [units, setUnits] = useState<Array<{ id: string; name: string }>>([]);
  const [search, setSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [selectedUnit, setSelectedUnit] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersResp, rolesResp, unitsResp] = await Promise.all([
        apiClient.getUsers({
          search: search || undefined,
          role: selectedRole || undefined,
          unit_id: selectedUnit || undefined,
          status: selectedStatus || undefined
        }),
        apiClient.getRoles(),
        apiClient.getUnits()
      ]);
      setUsers(usersResp.users || []);
      setRoles(rolesResp.roles || []);
      setUnits(unitsResp.units || []);
    } catch (err) {
      console.warn('Could not load user directory:', err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedRole, selectedUnit, selectedStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleStatusToggle = async (userId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!window.confirm(`Are you sure you want to change account status to ${nextStatus}?`)) return;
    try {
      await apiClient.updateUserStatus(userId, nextStatus);
      await loadData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      await apiClient.updateUserRole(userId, newRole);
      await loadData();
    } catch (err: any) {
      alert(`Role update failed: ${err.message}`);
    }
  };

  const handleUnitChange = async (userId: string, newUnit: string) => {
    try {
      await apiClient.updateUserUnit(userId, newUnit);
      await loadData();
    } catch (err: any) {
      alert(`Unit update failed: ${err.message}`);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background p-6 md:p-8 max-w-7xl mx-auto w-full overflow-y-auto">
      
      {/* Title & Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-border pb-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            Personnel Directory & Access Control
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Law enforcement identity management, physical NFC smartcard tokens, RBAC roles, and session governance
          </p>
        </div>

        {activeTab === 'users' && (
          <button
            onClick={() => setIsInviteOpen(true)}
            className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 shadow-sm cursor-pointer"
          >
            <UserPlus className="w-4 h-4" /> Commission New Officer
          </button>
        )}
      </div>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Users className="w-4 h-4" />
          Personnel Directory
          <span className="ml-1.5 px-2 py-0.5 text-[10px] rounded-full bg-secondary text-foreground font-mono">
            {users.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('nfc')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
            activeTab === 'nfc'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          NFC Smartcards & Badges
          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded bg-primary/10 text-primary font-mono font-bold">
            2FA
          </span>
        </button>
      </div>

      {activeTab === 'nfc' ? (
        <NFCCardsManagementView users={users} onRefreshUsers={loadData} />
      ) : (
        <>
          {/* Metrics Header */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Commissioned Personnel</span>
              <div className="text-2xl font-bold text-foreground mt-1">{users.length}</div>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Active In Good Standing</span>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {users.filter(u => u.status === 'ACTIVE').length}
              </div>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-xs font-semibold text-muted-foreground uppercase">MFA Protected</span>
              <div className="text-2xl font-bold text-primary mt-1">
                {users.filter(u => u.mfa_enabled).length}
              </div>
            </div>
            <div className="p-4 bg-card border border-border rounded-xl">
              <span className="text-xs font-semibold text-muted-foreground uppercase">Operational Units</span>
              <div className="text-2xl font-bold text-indigo-400 mt-1">{units.length}</div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="p-4 bg-card border border-border rounded-xl mb-6 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, badge, email..."
                  className="w-full bg-secondary/50 border border-border rounded-lg pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Canonical Ranks</option>
                  {roles.map((r) => (
                    <option key={r.name} value={r.name}>{r.display_name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedUnit}
                  onChange={(e) => setSelectedUnit(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Operational Units</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full bg-secondary/50 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">All Statuses</option>
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="DISABLED">DISABLED</option>
                </select>
              </div>

            </div>
          </div>

          {/* Directory Table */}
          <div className="flex-1 bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse font-sans text-xs">
                <thead className="bg-secondary/60 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="p-3">Badge & Name</th>
                    <th className="p-3">Rank / Global Role</th>
                    <th className="p-3">Operational Unit</th>
                    <th className="p-3">2FA Status</th>
                    <th className="p-3">Account State</th>
                    <th className="p-3 text-right">Administrative Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 text-foreground">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-secondary/20 transition-colors">
                      <td className="p-3">
                        <div className="font-bold text-foreground">{u.full_name}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{u.employee_id} • {u.official_email || u.email}</div>
                      </td>

                      <td className="p-3">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className="bg-secondary border border-border rounded px-2 py-1 text-xs font-semibold text-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {roles.map((r) => (
                            <option key={r.name} value={r.name}>{r.display_name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3">
                        <select
                          value={units.find(un => un.name === u.unit)?.id || ''}
                          onChange={(e) => handleUnitChange(u.id, e.target.value)}
                          className="bg-secondary border border-border rounded px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[180px] truncate"
                        >
                          <option value="">Central HQ</option>
                          {units.map((un) => (
                            <option key={un.id} value={un.id}>{un.name}</option>
                          ))}
                        </select>
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded border ${
                          u.mfa_enabled 
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          <KeyRound className="w-3 h-3" /> {u.mfa_enabled ? 'TOTP ON' : 'OFF'}
                        </span>
                      </td>

                      <td className="p-3">
                        <button
                          onClick={() => handleStatusToggle(u.id, u.status)}
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded border transition-colors ${
                            u.status === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-destructive/10 hover:text-destructive'
                              : 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-emerald-500/10 hover:text-emerald-400'
                          }`}
                        >
                          {u.status === 'ACTIVE' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                          {u.status}
                        </button>
                      </td>

                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleStatusToggle(u.id, u.status)}
                          className="text-xs text-muted-foreground hover:text-foreground underline decoration-border cursor-pointer"
                        >
                          {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <InviteOfficerModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        onSuccess={loadData}
        roles={roles}
        units={units}
      />
    </div>
  );
}

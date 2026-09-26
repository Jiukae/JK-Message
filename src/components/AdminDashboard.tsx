import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { User, AdminLevel } from '../types';
import { getAdminLevel, getAdminRoleInfo, getAdminRoleName, RoleBadge } from '../utils/roleUtils';
import { UserAvatar } from './UserAvatar';
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Radio,
  UserX,
  UserCheck,
  Clock,
  Search,
  RefreshCw,
  X,
  AlertTriangle,
  Lock,
  ChevronDown,
  Terminal,
  Activity,
  Check,
  CheckCircle2,
  Trash2,
  Sliders,
  Send,
  Loader2,
  Crown,
} from 'lucide-react';

interface AdminDashboardUser extends User {
  isOnline: boolean;
  activeSocketCount: number;
  banInfo: {
    isBanned: boolean;
    reason?: string;
    untilStr?: string;
    bannedUntil?: number | null;
  };
}

interface AdminDashboardProps {
  currentUser: User | null;
  onClose: () => void;
  onOpenDirectChat?: (user: User) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  currentUser,
  onClose,
  onOpenDirectChat,
}) => {
  // STRICT ACCESS CONTROL: Only Level 3 (Admin), Level 4 (Head Admin), or Level 5 (Owner)
  const currentLevel = getAdminLevel(currentUser);
  if (!currentUser || currentLevel < 3) {
    return null;
  }

  const roleInfo = getAdminRoleInfo(currentLevel);

  const [users, setUsers] = useState<AdminDashboardUser[]>([]);
  const [bans, setBans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'online' | 'admins' | 'banned'>('all');

  // Action Dialog States
  const [selectedUser, setSelectedUser] = useState<AdminDashboardUser | null>(null);
  const [actionType, setActionType] = useState<'kick' | 'ban' | 'timeban' | 'set_level' | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [timebanDuration, setTimebanDuration] = useState('30m');
  const [newSelectedLevel, setNewSelectedLevel] = useState<AdminLevel>(1);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

  // Quick Broadcast state (Level 4, 5 only)
  const [broadcastText, setBroadcastText] = useState('');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);

  // Fetch Users & System Status
  const fetchAdminData = useCallback(async () => {
    try {
      setRefreshing(true);
      const res = await fetch(`/api/admin/users?adminId=${currentUser.id}`);
      if (!res.ok) {
        throw new Error('대시보드 데이터를 불러오지 못했습니다.');
      }
      const data = await res.json();
      setUsers(data.users || []);
      setBans(data.bans || []);
    } catch (err: any) {
      console.error(err);
      setActionErrorMessage(err.message || '데이터 로딩 실패');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentUser.id]);

  useEffect(() => {
    fetchAdminData();
    // Auto-refresh every 12 seconds
    const interval = setInterval(fetchAdminData, 12000);
    return () => clearInterval(interval);
  }, [fetchAdminData]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Search
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        u.username.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Filter tabs
      if (filterMode === 'online') {
        return u.isOnline;
      }
      if (filterMode === 'admins') {
        return (u.adminLevel || 1) >= 2;
      }
      if (filterMode === 'banned') {
        return u.banInfo.isBanned;
      }

      return true;
    });
  }, [users, searchQuery, filterMode]);

  // Statistics
  const stats = useMemo(() => {
    const total = users.length;
    const online = users.filter((u) => u.isOnline).length;
    const banned = users.filter((u) => u.banInfo.isBanned).length;
    const admins = users.filter((u) => (u.adminLevel || 1) >= 2).length;
    return { total, online, banned, admins };
  }, [users]);

  // Execute Management Action
  const handleExecuteAction = async () => {
    if (!selectedUser || !actionType) return;
    setSubmittingAction(true);
    setActionErrorMessage(null);

    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser.id,
          action: actionType,
          targetUserId: selectedUser.id,
          targetUsername: selectedUser.username,
          reason: actionReason.trim() || undefined,
          duration: actionType === 'timeban' ? timebanDuration : undefined,
          newLevel: actionType === 'set_level' ? newSelectedLevel : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '작업을 완료하지 못했습니다.');
      }

      setActionSuccessMessage(data.message || '작업이 성공적으로 처리되었습니다.');
      setTimeout(() => setActionSuccessMessage(null), 4000);

      // Reset modal
      setActionType(null);
      setSelectedUser(null);
      setActionReason('');

      // Refresh list
      await fetchAdminData();
    } catch (err: any) {
      setActionErrorMessage(err.message || '오류가 발생했습니다.');
    } finally {
      setSubmittingAction(false);
    }
  };

  // Direct Unban Action
  const handleDirectUnban = async (username: string) => {
    if (!confirm(`@${username} 사용자의 밴/제재를 해제하시겠습니까?`)) return;
    try {
      const res = await fetch('/api/admin/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser.id,
          action: 'unban',
          targetUsername: username,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '밴 해제 실패');
      setActionSuccessMessage(data.message);
      setTimeout(() => setActionSuccessMessage(null), 3000);
      await fetchAdminData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Send Broadcast
  const handleSendBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastText.trim()) return;
    setSendingBroadcast(true);

    try {
      const res = await fetch('/api/admin/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          command: `/broadcast ${broadcastText.trim()}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '공지 전송 실패');
      setBroadcastText('');
      setShowBroadcastModal(false);
      setActionSuccessMessage('전체 사용자에게 팝업 공지가 실시간 송출되었습니다!');
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSendingBroadcast(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-2 sm:p-4 md:p-6 animate-in fade-in duration-200">
      <div className="w-full max-w-5xl h-[94vh] flex flex-col bg-[#0d101d]/95 border border-purple-500/30 rounded-3xl shadow-[0_0_80px_rgba(139,92,246,0.25)] overflow-hidden">
        
        {/* Top Header */}
        <header className="shrink-0 px-5 sm:px-7 py-4 bg-black/40 border-b border-purple-500/20 backdrop-blur-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 border border-purple-400/40 flex items-center justify-center text-white shadow-lg shadow-purple-600/30 shrink-0">
              <Shield className="w-5 h-5 text-purple-200" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                  <span>시스템 관리자 대시보드</span>
                  <span className="text-[11px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md border border-purple-400/20">
                    ADMIN v2.0
                  </span>
                </h1>
                <span className={`px-2 py-0.5 text-xs font-bold border rounded-lg flex items-center gap-1 ${roleInfo.badgeClass}`}>
                  <span>{roleInfo.icon}</span>
                  <span>{roleInfo.title}</span>
                </span>
              </div>
              <p className="text-xs text-white/50 truncate mt-0.5">
                실시간 접속자 모니터링, 유저 강퇴(Kick), 밴(Ban), 타임밴 및 권한 계층 관리
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {currentLevel >= 4 && (
              <button
                type="button"
                onClick={() => setShowBroadcastModal(true)}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/30 text-amber-300 font-semibold text-xs transition-all shadow-sm"
                title="전체 사용자 팝업 긴급 공지"
              >
                <Radio className="w-3.5 h-3.5" />
                <span>긴급 공지</span>
              </button>
            )}

            <button
              type="button"
              onClick={fetchAdminData}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
              title="새로고침"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 text-white/70 hover:text-rose-300 transition-colors"
              title="대시보드 닫기"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Global Toast Alerts */}
        {actionSuccessMessage && (
          <div className="shrink-0 px-6 py-2.5 bg-emerald-500/20 border-b border-emerald-400/30 text-emerald-200 text-xs font-medium flex items-center justify-between gap-2 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button onClick={() => setActionSuccessMessage(null)} className="text-emerald-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {actionErrorMessage && (
          <div className="shrink-0 px-6 py-2.5 bg-rose-500/20 border-b border-rose-400/30 text-rose-200 text-xs font-medium flex items-center justify-between gap-2 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{actionErrorMessage}</span>
            </div>
            <button onClick={() => setActionErrorMessage(null)} className="text-rose-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Stat Cards Ribbon */}
        <div className="shrink-0 p-4 sm:p-5 border-b border-white/10 bg-black/20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Stat 1: Total */}
            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-400 shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-white/50 block font-medium">전체 회원수</span>
                <span className="text-lg sm:text-xl font-bold text-white">{stats.total}명</span>
              </div>
            </div>

            {/* Stat 2: Online */}
            <div className="p-3.5 rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/20 backdrop-blur-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0 relative">
                <Activity className="w-5 h-5 animate-pulse" />
                <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-emerald-400/80 block font-medium">실시간 접속자</span>
                <span className="text-lg sm:text-xl font-bold text-emerald-300">{stats.online}명</span>
              </div>
            </div>

            {/* Stat 3: Banned */}
            <div className="p-3.5 rounded-2xl bg-rose-500/[0.04] border border-rose-500/20 backdrop-blur-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-400 shrink-0">
                <UserX className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-rose-400/80 block font-medium">차단 / 제재</span>
                <span className="text-lg sm:text-xl font-bold text-rose-300">{stats.banned}명</span>
              </div>
            </div>

            {/* Stat 4: Admins */}
            <div className="p-3.5 rounded-2xl bg-amber-500/[0.04] border border-amber-500/20 backdrop-blur-md flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                <Crown className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-amber-400/80 block font-medium">관리자 계층</span>
                <span className="text-lg sm:text-xl font-bold text-amber-300">{stats.admins}명</span>
              </div>
            </div>
          </div>
        </div>

        {/* Filter & Search Toolbar */}
        <div className="shrink-0 px-5 sm:px-7 py-3 border-b border-white/10 bg-black/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                filterMode === 'all'
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30'
                  : 'bg-white/5 text-white/60 hover:text-white border-white/10'
              }`}
            >
              전체 목록 ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('online')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                filterMode === 'online'
                  ? 'bg-emerald-600 text-white border-emerald-400 shadow-md shadow-emerald-600/30'
                  : 'bg-white/5 text-white/60 hover:text-white border-white/10'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>접속 중 ({stats.online})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('admins')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                filterMode === 'admins'
                  ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                  : 'bg-white/5 text-white/60 hover:text-white border-white/10'
              }`}
            >
              <span>👑 관리자 ({stats.admins})</span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('banned')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border flex items-center gap-1.5 ${
                filterMode === 'banned'
                  ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-600/30'
                  : 'bg-white/5 text-white/60 hover:text-white border-white/10'
              }`}
            >
              <span>🚫 밴 목록 ({stats.banned})</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="유저 아이디 또는 닉네임 검색..."
              className="w-full pl-9 pr-3 py-1.5 bg-black/40 border border-white/10 rounded-xl text-xs text-white placeholder-white/40 focus:outline-none focus:border-purple-400/50"
            />
          </div>
        </div>

        {/* User Management Content List / Table */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5">
          {loading ? (
            <div className="h-64 flex flex-col items-center justify-center text-white/40 gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
              <p className="text-xs">관리자 데이터를 실시간 동기화하는 중...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-white/40 p-6 text-center">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl mb-3">
                🔍
              </div>
              <p className="font-semibold text-sm text-white/70">조건에 일치하는 사용자가 없습니다.</p>
              <p className="text-xs text-white/40 mt-1">검색어나 필터 조건을 변경해보세요.</p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const targetLvl = u.adminLevel || 1;
              const isTargetAdmin = targetLvl >= 2;
              const isSelf = u.id === currentUser.id;
              const canManage = currentLevel === 5 ? !isSelf : currentLevel > targetLvl;

              return (
                <div
                  key={u.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3.5 ${
                    u.banInfo.isBanned
                      ? 'bg-rose-950/20 border-rose-500/30'
                      : u.isOnline
                      ? 'bg-emerald-950/15 border-emerald-500/20 hover:border-emerald-400/40'
                      : 'bg-white/[0.02] border-white/10 hover:bg-white/[0.04]'
                  }`}
                >
                  {/* User Profile Details */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <UserAvatar
                      user={u}
                      size="lg"
                      shape="rounded-2xl"
                      showStatus
                      statusMode={u.status}
                    />

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white truncate">{u.name}</span>
                        <RoleBadge user={u} size="sm" />

                        {u.isOnline ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>실시간 접속 중 ({u.activeSocketCount}소켓)</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-white/40">
                            마지막 접속: {new Date(u.lastSeen).toLocaleTimeString('ko-KR')}
                          </span>
                        )}

                        {u.banInfo.isBanned && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/25 text-rose-300 border border-rose-400/40">
                            🚫 {u.banInfo.untilStr}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-white/50">
                        <span className="text-blue-400 font-mono bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-400/20">
                          @{u.username}
                        </span>
                        <span>•</span>
                        <span>가입: {new Date(u.createdAt).toLocaleDateString('ko-KR')}</span>
                        {u.customStatus && (
                          <>
                            <span>•</span>
                            <span className="truncate max-w-[200px] text-white/60">"{u.customStatus}"</span>
                          </>
                        )}
                        {u.banInfo.isBanned && u.banInfo.reason && (
                          <span className="text-rose-300 block w-full text-[11px] mt-0.5">
                            사유: {u.banInfo.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions Buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end pt-2 md:pt-0 border-t md:border-t-0 border-white/5">
                    {/* Direct 1:1 Chat button */}
                    {onOpenDirectChat && !isSelf && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenDirectChat(u);
                        }}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs border border-white/10 transition-colors"
                        title="1:1 대화방 열기"
                      >
                        대화
                      </button>
                    )}

                    {/* Unban Action Button if Banned */}
                    {u.banInfo.isBanned ? (
                      <button
                        type="button"
                        onClick={() => handleDirectUnban(u.username)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/30 transition-all flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>차단 해제 (Unban)</span>
                      </button>
                    ) : (
                      <>
                        {/* 1. Kick Button (Level 3+) */}
                        <button
                          type="button"
                          disabled={!canManage || !u.isOnline}
                          onClick={() => {
                            setSelectedUser(u);
                            setActionType('kick');
                            setActionReason('');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 transition-all ${
                            canManage && u.isOnline
                              ? 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-400/40 shadow-sm'
                              : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                          }`}
                          title={!u.isOnline ? '현재 오프라인 상태입니다' : !canManage ? '권한이 부족합니다' : '실시간 접속 강제 종료'}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>강퇴 (Kick)</span>
                        </button>

                        {/* 2. Timeban Button (Level 3+ / 4+) */}
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => {
                            setSelectedUser(u);
                            setActionType('timeban');
                            setActionReason('');
                            setTimebanDuration('30m');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 transition-all ${
                            canManage
                              ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/30'
                              : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                          }`}
                          title={!canManage ? '권한이 부족합니다' : '지정된 시간 동안 접속 차단'}
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>타임밴</span>
                        </button>

                        {/* 3. Permanent Ban Button */}
                        <button
                          type="button"
                          disabled={!canManage}
                          onClick={() => {
                            setSelectedUser(u);
                            setActionType('ban');
                            setActionReason('');
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border flex items-center gap-1 transition-all ${
                            canManage
                              ? 'bg-rose-600 hover:bg-rose-500 text-white border-rose-400/40 shadow-md shadow-rose-600/30'
                              : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                          }`}
                          title={!canManage ? '권한이 부족합니다' : '계정 영구 접속 차단'}
                        >
                          <UserX className="w-3.5 h-3.5" />
                          <span>영구 밴</span>
                        </button>

                        {/* 4. Set Level (OP) Button - Level 4, 5 only */}
                        {currentLevel >= 4 && !isSelf && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedUser(u);
                              setActionType('set_level');
                              setNewSelectedLevel((u.adminLevel || 1) as AdminLevel);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-400/30 text-xs font-semibold transition-all flex items-center gap-1"
                            title="관리자 권한 계층 변경"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>권한</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal: Action Confirmation & Reason Prompt */}
        {actionType && selectedUser && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-[#131625] border border-white/20 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl space-y-4 animate-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    actionType === 'kick' ? 'bg-amber-500/20 text-amber-300' :
                    actionType === 'set_level' ? 'bg-purple-500/20 text-purple-300' : 'bg-rose-500/20 text-rose-300'
                  }`}>
                    {actionType === 'kick' ? <Activity className="w-4 h-4" /> :
                     actionType === 'set_level' ? <Crown className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">
                      {actionType === 'kick' ? '사용자 강제 퇴장 (Kick)' :
                       actionType === 'timeban' ? '사용자 임시 차단 (Timeban)' :
                       actionType === 'ban' ? '사용자 영구 차단 (Permanent Ban)' : '관리자 등급 변경 (OP)'}
                    </h3>
                    <p className="text-[11px] text-white/50">대상: @{selectedUser.username} ({selectedUser.name})</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="p-1 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Timeban Duration Selector */}
              {actionType === 'timeban' && (
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">차단 기간 선택</label>
                  <select
                    value={timebanDuration}
                    onChange={(e) => setTimebanDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white text-xs focus:outline-none focus:border-purple-400"
                  >
                    <option value="10m">10분 (경고성)</option>
                    <option value="30m">30분 (표준)</option>
                    <option value="1h">1시간</option>
                    <option value="6h">6시간</option>
                    <option value="1d">1일 (24시간)</option>
                    <option value="7d">7일 (1주일)</option>
                  </select>
                </div>
              )}

              {/* Set Level Role Selector */}
              {actionType === 'set_level' && (
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">변경할 관리자 등급</label>
                  <select
                    value={newSelectedLevel}
                    onChange={(e) => setNewSelectedLevel(Number(e.target.value) as AdminLevel)}
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white text-xs focus:outline-none focus:border-purple-400"
                  >
                    <option value="1">Level 1 - 일반 유저 (Guest/Member)</option>
                    <option value="2">Level 2 - 모더레이터 (Moder)</option>
                    <option value="3">Level 3 - 관리자 (Admin)</option>
                    {currentLevel === 5 && (
                      <>
                        <option value="4">Level 4 - 총괄 관리자 (Head Admin)</option>
                        <option value="5">Level 5 - 최고 소유자 (Owner)</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              {/* Reason Input */}
              {actionType !== 'set_level' && (
                <div>
                  <label className="block text-xs font-semibold text-white/70 mb-1.5">제재 사유 입력</label>
                  <textarea
                    rows={2}
                    value={actionReason}
                    onChange={(e) => setActionReason(e.target.value)}
                    placeholder={
                      actionType === 'kick' ? '예: 관리자 지시 불응 및 도배' :
                      actionType === 'timeban' ? '예: 부적절한 언행으로 인한 30분 임시 제재' : '예: 악의적인 비매너 행위 및 지속적인 욕설'
                    }
                    className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white text-xs placeholder-white/30 focus:outline-none focus:border-purple-400"
                  />
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionType(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
                >
                  취소
                </button>

                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={handleExecuteAction}
                  className={`px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50 ${
                    actionType === 'kick'
                      ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/30'
                      : actionType === 'set_level'
                      ? 'bg-purple-600 hover:bg-purple-500 shadow-purple-600/30'
                      : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                  }`}
                >
                  {submittingAction && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {actionType === 'kick' ? '강퇴 실행' :
                     actionType === 'timeban' ? '타임밴 적용' :
                     actionType === 'set_level' ? '등급 변경' : '영구 차단 적용'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Quick Broadcast Announcement */}
        {showBroadcastModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-[#131625] border border-amber-400/30 rounded-3xl p-6 shadow-2xl backdrop-blur-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">전체 사용자 팝업 긴급 공지</h3>
                    <p className="text-[11px] text-amber-300/70">접속 중인 모든 사용자의 화면 상단에 즉시 노출됩니다</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBroadcastModal(false)}
                  className="p-1 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSendBroadcast} className="space-y-4">
                <textarea
                  rows={3}
                  required
                  value={broadcastText}
                  onChange={(e) => setBroadcastText(e.target.value)}
                  placeholder="송출할 공지 내용을 입력해주세요 (예: 서버 점검이 10분 후 시작됩니다.)"
                  className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-xl text-white text-xs placeholder-white/30 focus:outline-none focus:border-amber-400"
                />

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBroadcastModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={sendingBroadcast || !broadcastText.trim()}
                    className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/30 flex items-center gap-1.5 transition-all disabled:opacity-50"
                  >
                    {sendingBroadcast ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>실시간 송출</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

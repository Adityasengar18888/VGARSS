import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from './services/api';
import { useSimulation } from './hooks/useSimulation';
import { useChatWebSocket } from './hooks/useChatWebSocket';
import { useMessageLifecycle } from './hooks/useMessageLifecycle';
import { ServerSidebar } from './components/chat/ServerSidebar';
import { ChannelSidebar, SystemViewTab } from './components/chat/ChannelSidebar';
import { MainConversationPanel } from './components/chat/MainConversationPanel';
import { RightDrawer } from './components/chat/RightDrawer';
import { TaskCreationModal } from './components/chat/TaskCreationModal';
import { CreateWorkspaceModal } from './components/chat/CreateWorkspaceModal';
import { CreateChannelModal } from './components/chat/CreateChannelModal';
import { InviteMemberModal } from './components/chat/InviteMemberModal';
import { SearchModal } from './components/chat/SearchModal';
import { ProfileModal } from './components/chat/ProfileModal';
import { WorkspaceSettingsModal } from './components/chat/WorkspaceSettingsModal';
import { TaskDetailModal } from './components/chat/TaskDetailModal';
import { JoinWorkspaceModal } from './components/chat/JoinWorkspaceModal';
import { AuthScreen } from './components/chat/AuthScreen';

import { ProcessSchedulerView } from './views/ProcessSchedulerView';
import { ResourceMonitorView } from './views/ResourceMonitorView';
import { DeadlockLabView } from './views/DeadlockLabView';
import { NetworkMonitorView } from './views/NetworkMonitorView';
import { PerformanceAnalyticsView } from './views/PerformanceAnalyticsView';

import {
  Workspace,
  Channel,
  DirectConversation,
  ChatMessage,
  TaskItem,
  WorkspaceMember,
  UserProfile,
  WorkspaceResource,
} from './types/chat';
import { ResourceStatus } from './types/resources';
import { ConnectionStatus } from './types/network';
import { LoadingState, ErrorState } from './components/common/States';
import { Menu, MessageSquare, Cpu, Layers, Activity, BarChart2 } from 'lucide-react';

export default function App() {
  // Navigation & View States
  const getInitialTab = (): SystemViewTab => {
    const tab = new URLSearchParams(window.location.search).get('tab');
    if (tab && ['chat', 'scheduler', 'resources', 'deadlock', 'network', 'analytics'].includes(tab)) {
      return tab as SystemViewTab;
    }
    return 'chat';
  };
  const [activeViewTab, setActiveViewTab] = useState<SystemViewTab>(getInitialTab);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Entities & Auth
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [dms, setDms] = useState<DirectConversation[]>([]);
  const [activeDm, setActiveDm] = useState<DirectConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [resources, setResources] = useState<ResourceStatus[]>([]);
  const [workspaceResources, setWorkspaceResources] = useState<WorkspaceResource[]>([]);

  // Modals & Invitation States
  const [inviteCodeFromUrl, setInviteCodeFromUrl] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('invite');
  });
  const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskModalInitial, setTaskModalInitial] = useState<{ title?: string; messageId?: string }>({});
  const [selectedTaskForDetail, setSelectedTaskForDetail] = useState<TaskItem | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // System & Connection States
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [apiLatency, setApiLatency] = useState<number | null>(null);

  // Simulation Controls & Telemetry Hook
  const sim = useSimulation(activeWorkspace?.id || null);

  // Real-Time Chat WebSocket Hook & Neural Transmission Lifecycle
  const activeTargetId = activeChannel ? activeChannel.id : activeDm ? activeDm.id : null;
  const sendWsEventRef = useRef<((evt: any) => boolean) | null>(null);

  const messageLifecycle = useMessageLifecycle({
    currentUserId: currentUser?.id,
    onSendEvent: (evt) => (sendWsEventRef.current ? sendWsEventRef.current(evt) : false),
  });

  const chatWs = useChatWebSocket({
    token: api.token,
    workspaceId: activeWorkspace?.id || null,
    activeTargetId,
    onReceiptEvent: (receiptEvt) => {
      messageLifecycle.handleReceiptUpdate(receiptEvt);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === receiptEvt.message_id
            ? {
                ...m,
                delivery_status: receiptEvt.status === 'read' ? 'READ' : 'DELIVERED',
              }
            : m
        )
      );
    },
    onMessageReceived: (newMsg) => {
      setMessages((prev) => {
        // Prevent duplicate appending
        if (prev.some((m) => m.id === newMsg.id || (m.client_msg_id && m.client_msg_id === newMsg.client_msg_id))) {
          return prev.map((m) => (m.client_msg_id === newMsg.client_msg_id ? newMsg : m));
        }
        return [...prev, newMsg];
      });

      // Recipient auto-acknowledges receipt
      messageLifecycle.acknowledgeIncomingMessage(newMsg, activeViewTab === 'chat');
    },
    onPresenceUpdate: (userId, presenceState) => {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, presence_state: presenceState as any } : m))
      );
      setDms((prev) =>
        prev.map((d) =>
          d.recipient.id === userId
            ? { ...d, recipient: { ...d.recipient, presence_state: presenceState as any } }
            : d
        )
      );
    },
    onTaskEvent: (taskData) => {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === taskData.id);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...taskData };
          return updated;
        }
        return [taskData, ...prev];
      });
    },
  });

  useEffect(() => {
    sendWsEventRef.current = chatWs.sendEvent;
  }, [chatWs.sendEvent]);

  // Health and Latency Check
  const checkHealth = useCallback(async () => {
    const start = performance.now();
    try {
      await api.getHealth();
      setApiLatency(Math.round(performance.now() - start));
    } catch {
      setApiLatency(null);
    }
  }, []);

  // Fetch Messages for active channel or DM
  const fetchMessages = useCallback(async (targetChannelId?: string, targetDmId?: string) => {
    try {
      if (targetChannelId) {
        const page = await api.getChannelMessages(targetChannelId, 50);
        setMessages(page.messages);
        setHasMoreMessages(page.has_more);
        // Acknowledge read for unread peer messages
        if (currentUser?.id && page.messages) {
          for (const m of page.messages) {
            if (m.sender_id && m.sender_id !== currentUser.id && m.delivery_status !== 'READ') {
              sendWsEventRef.current?.({
                type: 'MESSAGE_READ',
                message_id: m.id,
                channel_id: m.channel_id,
                conversation_id: m.conversation_id,
              });
            }
          }
        }
      } else if (targetDmId) {
        const page = await api.getDmMessages(targetDmId, 50);
        setMessages(page.messages);
        setHasMoreMessages(page.has_more);
        if (currentUser?.id && page.messages) {
          for (const m of page.messages) {
            if (m.sender_id && m.sender_id !== currentUser.id && m.delivery_status !== 'READ') {
              sendWsEventRef.current?.({
                type: 'MESSAGE_READ',
                message_id: m.id,
                channel_id: m.channel_id,
                conversation_id: m.conversation_id,
              });
            }
          }
        }
      } else {
        setMessages([]);
        setHasMoreMessages(false);
      }
    } catch {
      setMessages([]);
    }
  }, [currentUser?.id]);

  // Load older messages
  const handleLoadOlder = async () => {
    if (messages.length === 0) return;
    const oldestId = messages[0].id;
    try {
      if (activeChannel) {
        const page = await api.getChannelMessages(activeChannel.id, 50, oldestId);
        setMessages((prev) => [...page.messages, ...prev]);
        setHasMoreMessages(page.has_more);
      } else if (activeDm) {
        const page = await api.getDmMessages(activeDm.id, 50, oldestId);
        setMessages((prev) => [...page.messages, ...prev]);
        setHasMoreMessages(page.has_more);
      }
    } catch {
      // ignore
    }
  };

  // Fetch Workspace details: channels, dms, members, tasks, resources
  const refreshWorkspaceData = useCallback(async (wsId: string) => {
    try {
      const [chList, dmList, memList, tskList, wsResList] = await Promise.all([
        api.listWorkspaceChannels(wsId),
        api.listDms(wsId),
        api.listWorkspaceMembers(wsId),
        api.listTasks(wsId),
        api.listWorkspaceResources(wsId).catch(() => []),
      ]);

      setChannels(chList);
      setDms(dmList);
      setMembers(memList);
      setTasks(tskList);
      setWorkspaceResources(wsResList);

      // Select general channel by default if none selected
      if (chList.length > 0) {
        const general = chList.find((c) => c.name === 'general') || chList[0];
        setActiveChannel(general);
        setActiveDm(null);
        fetchMessages(general.id);
      }
    } catch {
      // ignore
    }
  }, [fetchMessages]);

  // Initial System Bootstrap
  const bootstrap = useCallback(async () => {
    setBootstrapping(true);
    setBootstrapError(null);
    try {
      await checkHealth();

      let user: UserProfile | null = null;
      const isExplicitAuth = typeof window !== 'undefined' ? localStorage.getItem('vgarss_auth_user') : null;
      if (api.token && isExplicitAuth) {
        try {
          user = await api.getProfile();
        } catch {
          api.setToken(null);
          if (typeof window !== 'undefined') {
            localStorage.removeItem('vgarss_auth_user');
          }
        }
      } else {
        // Clear any old auto-logged-in demo tokens (e.g. legacy Alice session)
        api.setToken(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('vgarss_token');
          localStorage.removeItem('vgarss_auth_user');
        }
      }

      // If no valid session, prompt the user with the AuthScreen (Sign In / Register)
      if (!user) {
        setCurrentUser(null);
        setBootstrapping(false);
        return;
      }

      setCurrentUser(user);

      const wsList = await api.listWorkspaces();
      setWorkspaces(wsList);

      if (wsList.length > 0) {
        const primary = wsList[0];
        setActiveWorkspace(primary);
        await refreshWorkspaceData(primary.id);
      } else {
        // Create initial production workspace if empty
        const defaultWs = await api.createWorkspace({
          name: 'VGARSS Core Engineering',
          description: 'Production Systems Collaboration & Scheduling Workspace',
        });
        setWorkspaces([defaultWs]);
        setActiveWorkspace(defaultWs);
        await refreshWorkspaceData(defaultWs.id);
      }
    } catch (err: any) {
      setBootstrapError(err.message || 'Failed to initialize link to VGARSS 2.0 backend.');
    } finally {
      setBootstrapping(false);
    }
  }, [checkHealth, refreshWorkspaceData]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Switch Workspace
  const handleSelectWorkspace = async (wsId: string) => {
    const ws = workspaces.find((w) => w.id === wsId);
    if (!ws) return;
    setActiveWorkspace(ws);
    await refreshWorkspaceData(ws.id);
    setIsMobileNavOpen(false);
  };

  // Select Channel
  const handleSelectChannel = (channelId: string) => {
    const ch = channels.find((c) => c.id === channelId);
    if (!ch) return;
    setActiveChannel(ch);
    setActiveDm(null);
    fetchMessages(ch.id);
    api.markChannelRead(ch.id).catch(() => {});
    setIsMobileNavOpen(false);
  };

  // Select DM
  const handleSelectDm = (dmId: string) => {
    const dm = dms.find((d) => d.id === dmId);
    if (!dm) return;
    setActiveDm(dm);
    setActiveChannel(null);
    fetchMessages(undefined, dm.id);
    api.markDmRead(dm.id).catch(() => {});
    setIsMobileNavOpen(false);
  };

  // Send Message with Neural Transmission Lifecycle
  const handleSendMessage = async (content: string, clientMsgId?: string) => {
    const cliId = clientMsgId || `cli-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    if (activeChannel) {
      const optMsg: ChatMessage = {
        id: `opt-${Date.now()}`,
        workspace_id: activeWorkspace!.id,
        channel_id: activeChannel.id,
        sender_id: currentUser?.id,
        sender_username: currentUser?.username,
        sender_display_name: currentUser?.display_name || currentUser?.username,
        message_type: 'USER_TEXT',
        content,
        reply_count: 0,
        is_edited: false,
        is_pinned: false,
        client_msg_id: cliId,
        seq: 0,
        created_at: new Date().toISOString(),
        status: 'pending',
      };
      setMessages((prev) => [...prev, optMsg]);

      try {
        const serverMsg = await messageLifecycle.sendMessage({
          content,
          channelId: activeChannel.id,
          clientMsgId: cliId,
        });
        setMessages((prev) =>
          prev.map((m) => (m.client_msg_id === cliId ? { ...serverMsg, client_msg_id: cliId } : m))
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.client_msg_id === cliId ? { ...m, status: 'failed' } : m))
        );
      }
    } else if (activeDm) {
      const optMsg: ChatMessage = {
        id: `opt-${Date.now()}`,
        workspace_id: activeWorkspace!.id,
        conversation_id: activeDm.id,
        sender_id: currentUser?.id,
        sender_username: currentUser?.username,
        sender_display_name: currentUser?.display_name || currentUser?.username,
        message_type: 'USER_TEXT',
        content,
        reply_count: 0,
        is_edited: false,
        is_pinned: false,
        client_msg_id: cliId,
        seq: 0,
        created_at: new Date().toISOString(),
        status: 'pending',
      };
      setMessages((prev) => [...prev, optMsg]);

      try {
        const serverMsg = await messageLifecycle.sendMessage({
          content,
          conversationId: activeDm.id,
          clientMsgId: cliId,
        });
        setMessages((prev) =>
          prev.map((m) => (m.client_msg_id === cliId ? { ...serverMsg, client_msg_id: cliId } : m))
        );
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.client_msg_id === cliId ? { ...m, status: 'failed' } : m))
        );
      }
    }
  };

  // Retry sending a failed message
  const handleRetryMessage = async (clientMsgId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.client_msg_id === clientMsgId ? { ...m, status: 'pending' } : m))
    );
    try {
      const serverMsg = await messageLifecycle.retryMessage(clientMsgId);
      if (serverMsg) {
        setMessages((prev) =>
          prev.map((m) => (m.client_msg_id === clientMsgId ? { ...serverMsg, client_msg_id: clientMsgId } : m))
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.client_msg_id === clientMsgId ? { ...m, status: 'failed' } : m))
      );
    }
  };

  // Open DM with a specific user
  const handleOpenDmWithUser = async (targetUserId: string) => {
    if (!activeWorkspace) return;
    try {
      const dm = await api.openDm(activeWorkspace.id, targetUserId);
      const dmList = await api.listDms(activeWorkspace.id);
      setDms(dmList);
      setActiveDm(dm);
      setActiveChannel(null);
      setActiveViewTab('chat');
      fetchMessages(undefined, dm.id);
    } catch {
      // ignore
    }
  };

  // Switch Dev User
  const handleSwitchDevUser = async (username: string) => {
    try {
      const res = await api.devSwitchUser(username);
      setCurrentUser(res.user);
      const wsList = await api.listWorkspaces();
      setWorkspaces(wsList);
      if (wsList.length > 0) {
        const target = wsList.find((w) => w.id === activeWorkspace?.id) || wsList[0];
        setActiveWorkspace(target);
        await refreshWorkspaceData(target.id);
      }
    } catch {
      // ignore
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    try {
      await api.v2Logout();
    } catch {
      // ignore
    }
    api.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vgarss_token');
      localStorage.removeItem('vgarss_auth_user');
    }
    setCurrentUser(null);
    setActiveWorkspace(null);
    setWorkspaces([]);
    setChannels([]);
    setMessages([]);
    setTasks([]);
    setMembers([]);
    setIsProfileOpen(false);
  };

  // Update Task Status
  const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const updated = await api.updateTask(taskId, { status: newStatus });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    } catch {
      // ignore
    }
  };

  const handleOpenTaskDetailById = async (taskId: string) => {
    try {
      const detail = await api.getTaskDetails(taskId);
      setSelectedTaskForDetail(detail);
      setIsTaskDetailOpen(true);
    } catch {
      const found = tasks.find((t) => t.id === taskId);
      if (found) {
        setSelectedTaskForDetail(found);
        setIsTaskDetailOpen(true);
      }
    }
  };

  const handleUpdateTaskStatusAction = async (taskId: string, newStatus: string, action?: string) => {
    try {
      const updated = await api.updateTask(taskId, { status: newStatus, action });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setSelectedTaskForDetail(updated);
      if (activeWorkspace) {
        const wr = await api.listWorkspaceResources(activeWorkspace.id).catch(() => []);
        setWorkspaceResources(wr);
      }
    } catch (e) {
      console.error('Failed to update task:', e);
      throw e;
    }
  };

  const handleAssignUser = async (taskId: string, userId: string) => {
    try {
      const updated = await api.updateTask(taskId, { assignee_id: userId });
      setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      setSelectedTaskForDetail(updated);
    } catch (e) {
      console.error('Failed to assign user:', e);
      throw e;
    }
  };

  const handleAcquireResource = async (taskId: string, resourceId: string, mode: 'EXCLUSIVE' | 'SHARED') => {
    await api.acquireTaskResource(taskId, resourceId, mode, 1);
    const updated = await api.getTaskDetails(taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    setSelectedTaskForDetail(updated);
    if (activeWorkspace) {
      const wr = await api.listWorkspaceResources(activeWorkspace.id).catch(() => []);
      setWorkspaceResources(wr);
    }
  };

  const handleReleaseResource = async (taskId: string, resourceId: string) => {
    await api.releaseTaskResource(taskId, resourceId);
    const updated = await api.getTaskDetails(taskId);
    setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
    setSelectedTaskForDetail(updated);
    if (activeWorkspace) {
      const wr = await api.listWorkspaceResources(activeWorkspace.id).catch(() => []);
      setWorkspaceResources(wr);
    }
  };

  const handleNavigateToConversation = (channelId?: string | null) => {
    if (channelId) {
      const targetChannel = channels.find((c) => c.id === channelId);
      if (targetChannel) {
        handleSelectChannel(channelId);
      }
    }
    setActiveViewTab('chat');
  };

  const handleInvitationJoined = async (wsId: string) => {
    setInviteCodeFromUrl(null);
    window.history.replaceState({}, '', window.location.pathname);
    const wsList = await api.listWorkspaces();
    setWorkspaces(wsList);
    const target = wsList.find((w) => w.id === wsId) || wsList[0];
    if (target) {
      setActiveWorkspace(target);
      await refreshWorkspaceData(target.id);
    }
  };

  const wsStatusMapped: ConnectionStatus =
    chatWs.status === 'connecting' ? 'reconnecting' : chatWs.status;

  // Unauthenticated View
  if (!bootstrapping && !currentUser) {
    return (
      <AuthScreen
        onAuthenticated={async (user) => {
          if (typeof window !== 'undefined') {
            localStorage.setItem('vgarss_auth_user', user.username);
          }
          setCurrentUser(user);
          const wsList = await api.listWorkspaces();
          setWorkspaces(wsList);
          if (wsList.length > 0) {
            setActiveWorkspace(wsList[0]);
            await refreshWorkspaceData(wsList[0].id);
          } else {
            const defaultWs = await api.createWorkspace({
              name: `${user.display_name || user.username}'s Workspace`,
              description: 'Personal Systems Collaboration & Scheduling Workspace',
            });
            setWorkspaces([defaultWs]);
            setActiveWorkspace(defaultWs);
            await refreshWorkspaceData(defaultWs.id);
          }
        }}
        onDevSwitch={async (uname) => {
          if (typeof window !== 'undefined') {
            localStorage.setItem('vgarss_auth_user', uname);
          }
          await handleSwitchDevUser(uname);
        }}
      />
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#F5F6F8] text-[#202631] flex flex-col font-sans selection:bg-[#4055A8] selection:text-white">
      {/* Mobile Top Header */}
      <div className="md:hidden h-12 bg-white border-b border-[#E4E7EC] px-4 flex items-center justify-between z-30">
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="p-1 rounded text-[#667085] hover:text-[#202631] transition"
          aria-label="Toggle Mobile Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="font-bold text-xs text-[#202631] truncate">
          {activeWorkspace?.name || 'VGARSS 2.0'}
        </span>
        <button
          onClick={() => setIsProfileOpen(true)}
          className="w-7 h-7 rounded-full bg-[#EEF2FF] text-[#4055A8] font-bold text-xs flex items-center justify-center border border-[#C7D2FE]"
        >
          {currentUser?.username?.[0]?.toUpperCase() || 'U'}
        </button>
      </div>

      {/* Main Desktop Three-Column Layout */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Column 1: Server / Workspace Icon Rail (64px) */}
        <div className={`md:flex ${isMobileNavOpen ? 'flex absolute inset-y-0 left-0 z-40' : 'hidden md:flex'}`}>
          <ServerSidebar
            workspaces={workspaces}
            activeWorkspaceId={activeWorkspace?.id || null}
            onSelectWorkspace={handleSelectWorkspace}
            onOpenCreateWorkspace={() => setIsCreateWsOpen(true)}
            currentUser={currentUser}
            onOpenProfile={() => setIsProfileOpen(true)}
            onSwitchDevUser={handleSwitchDevUser}
            onLogout={handleLogout}
          />

          {/* Column 2: Channel & Conversation Sidebar (240px) */}
          <ChannelSidebar
            activeWorkspace={activeWorkspace}
            channels={channels}
            activeChannelId={activeChannel?.id || null}
            onSelectChannel={handleSelectChannel}
            onOpenCreateChannel={() => setIsCreateChannelOpen(true)}
            dms={dms}
            activeDmId={activeDm?.id || null}
            onSelectDm={handleSelectDm}
            activeViewTab={activeViewTab}
            onSelectViewTab={(tab) => {
              setActiveViewTab(tab);
              setIsMobileNavOpen(false);
            }}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenInviteMember={() => setIsInviteOpen(true)}
            onOpenWorkspaceSettings={() => setIsSettingsOpen(true)}
            wsStatus={chatWs.status}
            apiLatency={apiLatency}
          />
        </div>

        {/* Backdrop for Mobile Slide-over */}
        {isMobileNavOpen && (
          <div
            onClick={() => setIsMobileNavOpen(false)}
            className="md:hidden fixed inset-0 bg-black/40 z-30 backdrop-blur-xs"
          />
        )}

        {/* Column 3: Main Central Stage (Conversation or Dedicated Systems Consoles) */}
        <main className="flex-1 flex overflow-hidden bg-[#F5F6F8]">
          {bootstrapping ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <LoadingState message="Connecting to VGARSS 2.0 Real-Time Collaboration Hub..." />
            </div>
          ) : bootstrapError ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <ErrorState message={bootstrapError} onRetry={bootstrap} />
            </div>
          ) : activeViewTab === 'chat' ? (
            <div className="flex-1 flex overflow-hidden">
              <MainConversationPanel
                activeChannel={activeChannel}
                activeDm={activeDm}
                messages={messages}
                hasMoreMessages={hasMoreMessages}
                onLoadOlderMessages={handleLoadOlder}
                onSendMessage={handleSendMessage}
                onOpenCreateTaskModal={(initTitle, msgId) => {
                  setTaskModalInitial({ title: initTitle, messageId: msgId });
                  setIsTaskModalOpen(true);
                }}
                onNavigateToScheduler={() => setActiveViewTab('scheduler')}
                onToggleRightDrawer={() => setIsRightDrawerOpen(!isRightDrawerOpen)}
                isRightDrawerOpen={isRightDrawerOpen}
                activeTypers={chatWs.activeTypers}
                onSendTyping={() => activeTargetId && chatWs.sendTyping(activeTargetId, !!activeChannel)}
                tasks={tasks}
                onSelectTaskId={handleOpenTaskDetailById}
                currentUserId={currentUser?.id}
                getMessageState={messageLifecycle.getMessageState}
                onRetryMessage={handleRetryMessage}
                theme="light"
              />

              {/* Context Drawer (260px) */}
              <RightDrawer
                isOpen={isRightDrawerOpen}
                onClose={() => setIsRightDrawerOpen(false)}
                members={members}
                tasks={tasks}
                onOpenDmWithUser={handleOpenDmWithUser}
                onOpenCreateTask={() => setIsTaskModalOpen(true)}
                onUpdateTaskStatus={handleUpdateTaskStatus}
                onNavigateToScheduler={() => setActiveViewTab('scheduler')}
                onSelectTask={(task) => {
                  setSelectedTaskForDetail(task);
                  setIsTaskDetailOpen(true);
                }}
              />
            </div>
          ) : activeViewTab === 'scheduler' ? (
            <div className="flex-1 overflow-y-auto p-6 bg-[#F5F6F8]">
              <ProcessSchedulerView
                simulation={sim.simulation}
                currentTick={sim.currentTick}
                ganttHistory={sim.ganttHistory}
                processes={sim.processes}
                readyQueue={sim.readyQueue}
                waitingQueue={sim.waitingQueue}
                runningProcessId={sim.runningProcessId}
                isPlaying={sim.isPlaying}
                onStep={sim.step}
                onPlay={sim.play}
                onPause={sim.pause}
                onReset={sim.reset}
                onCreateSimulation={sim.create}
              />
            </div>
          ) : activeViewTab === 'resources' ? (
            <div className="flex-1 overflow-y-auto p-6 bg-[#F5F6F8]">
              <ResourceMonitorView
                groupId={activeWorkspace?.id || null}
                simId={sim.simulation?.id || null}
                resources={resources}
                processes={sim.processes}
                onRefreshResources={async () => {
                  if (activeWorkspace && sim.simulation) {
                    const r = await api.getResourceStatuses(activeWorkspace.id, sim.simulation.id);
                    setResources(r);
                  }
                  if (activeWorkspace) {
                    const wr = await api.listWorkspaceResources(activeWorkspace.id).catch(() => []);
                    setWorkspaceResources(wr);
                  }
                }}
              />
            </div>
          ) : activeViewTab === 'deadlock' ? (
            <div className="flex-1 overflow-y-auto p-6 bg-[#F5F6F8]">
              <DeadlockLabView
                groupId={activeWorkspace?.id || null}
                simId={sim.simulation?.id || null}
                resources={resources}
                onRefreshResources={async () => {
                  if (activeWorkspace && sim.simulation) {
                    const r = await api.getResourceStatuses(activeWorkspace.id, sim.simulation.id);
                    setResources(r);
                  }
                  if (activeWorkspace) {
                    const wr = await api.listWorkspaceResources(activeWorkspace.id).catch(() => []);
                    setWorkspaceResources(wr);
                  }
                }}
                onCreateSimulation={sim.create}
              />
            </div>
          ) : activeViewTab === 'network' ? (
            <div className="flex-1 overflow-y-auto p-6 bg-[#F5F6F8]">
              <NetworkMonitorView
                wsStatus={wsStatusMapped}
                wsLatency={chatWs.latency}
                wsEvents={[]}
                lastSeq={0}
                onSendWsPing={() => {}}
                onResyncWs={() => {}}
              />
            </div>
          ) : activeViewTab === 'analytics' ? (
            <div className="flex-1 overflow-y-auto p-6 bg-[#F5F6F8]">
              <PerformanceAnalyticsView
                currentMetrics={sim.metrics}
                currentAlgorithm={sim.simulation?.algorithm || 'ROUND_ROBIN'}
              />
            </div>
          ) : null}
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="md:hidden h-12 bg-white border-t border-[#E4E7EC] flex items-center justify-around z-20">
        <button
          onClick={() => setActiveViewTab('chat')}
          className={`flex flex-col items-center justify-center p-1 text-[10px] transition ${
            activeViewTab === 'chat' ? 'text-[#4055A8] font-bold' : 'text-[#667085]'
          }`}
        >
          <MessageSquare className="w-4 h-4 mb-0.5" />
          <span>Chat</span>
        </button>

        <button
          onClick={() => setActiveViewTab('scheduler')}
          className={`flex flex-col items-center justify-center p-1 text-[10px] transition ${
            activeViewTab === 'scheduler' ? 'text-[#4055A8] font-bold' : 'text-[#667085]'
          }`}
        >
          <Cpu className="w-4 h-4 mb-0.5" />
          <span>Scheduler</span>
        </button>

        <button
          onClick={() => setActiveViewTab('resources')}
          className={`flex flex-col items-center justify-center p-1 text-[10px] transition ${
            activeViewTab === 'resources' ? 'text-[#4055A8] font-bold' : 'text-[#667085]'
          }`}
        >
          <Layers className="w-4 h-4 mb-0.5" />
          <span>Resources</span>
        </button>

        <button
          onClick={() => setActiveViewTab('network')}
          className={`flex flex-col items-center justify-center p-1 text-[10px] transition ${
            activeViewTab === 'network' ? 'text-[#4055A8] font-bold' : 'text-[#667085]'
          }`}
        >
          <Activity className="w-4 h-4 mb-0.5" />
          <span>Network</span>
        </button>

        <button
          onClick={() => setActiveViewTab('analytics')}
          className={`flex flex-col items-center justify-center p-1 text-[10px] transition ${
            activeViewTab === 'analytics' ? 'text-[#4055A8] font-bold' : 'text-[#667085]'
          }`}
        >
          <BarChart2 className="w-4 h-4 mb-0.5" />
          <span>Analytics</span>
        </button>
      </nav>

      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={isCreateWsOpen}
        onClose={() => setIsCreateWsOpen(false)}
        onCreateWorkspace={async (p) => {
          const ws = await api.createWorkspace(p);
          setWorkspaces((prev) => [ws, ...prev]);
          setActiveWorkspace(ws);
          refreshWorkspaceData(ws.id);
        }}
      />

      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        onCreateChannel={async (p) => {
          if (!activeWorkspace) return;
          const ch = await api.createChannel(activeWorkspace.id, p);
          setChannels((prev) => [...prev, ch]);
          setActiveChannel(ch);
          fetchMessages(ch.id);
        }}
      />

      <InviteMemberModal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        workspaceId={activeWorkspace?.id}
        onAddMember={async (username, role) => {
          if (!activeWorkspace) return;
          const mem = await api.addWorkspaceMember(activeWorkspace.id, username, role);
          setMembers((prev) => [...prev, mem]);
        }}
      />

      <JoinWorkspaceModal
        inviteCode={inviteCodeFromUrl}
        onClose={() => setInviteCodeFromUrl(null)}
        onJoined={handleInvitationJoined}
      />

      <TaskCreationModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        workspaceId={activeWorkspace?.id || ''}
        channels={channels}
        members={members}
        resources={workspaceResources}
        initialTitle={taskModalInitial.title}
        initialMessageId={taskModalInitial.messageId}
        initialChannelId={activeChannel?.id}
        onCreateTask={async (payload) => {
          const t = await api.createTask(payload);
          setTasks((prev) => [t, ...prev]);
        }}
      />

      <TaskDetailModal
        isOpen={isTaskDetailOpen}
        onClose={() => setIsTaskDetailOpen(false)}
        task={selectedTaskForDetail}
        members={members}
        availableResources={workspaceResources}
        onUpdateStatus={handleUpdateTaskStatusAction}
        onAssignUser={handleAssignUser}
        onAcquireResource={handleAcquireResource}
        onReleaseResource={handleReleaseResource}
        onNavigateToConversation={handleNavigateToConversation}
        onNavigateToScheduler={() => setActiveViewTab('scheduler')}
        onNavigateToDeadlock={() => setActiveViewTab('deadlock')}
      />

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        workspaceId={activeWorkspace?.id || ''}
        onSelectResult={(res) => {
          if (res.channel_id) {
            handleSelectChannel(res.channel_id);
          }
        }}
      />

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        currentUser={currentUser}
        onUpdatePresence={async (pState, statusMsg) => {
          await api.updatePresence(pState, statusMsg);
          setCurrentUser((prev) =>
            prev ? { ...prev, presence_state: pState as any, status_message: statusMsg || prev.status_message } : prev
          );
        }}
        onSwitchUser={handleSwitchDevUser}
        onLogout={handleLogout}
      />

      <WorkspaceSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        workspace={activeWorkspace}
        members={members}
        channels={channels}
      />
    </div>
  );
}

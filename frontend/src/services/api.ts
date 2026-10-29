/**
 * Central REST API Client Service for VGARSS
 */
import { AuthSession, LoginPayload, RegisterPayload, User } from '../types/auth';
import { CreateGroupPayload, VirtualGroup, GroupMember } from '../types/groups';
import {
  SimulationCreatePayload,
  SimulationResponse,
  SimulationStepResponse,
} from '../types/simulation';
import {
  ResourceAcquirePayload,
  ResourceReleasePayload,
  ResourceStatus,
  DeadlockStatus,
} from '../types/resources';

import { getApiBaseUrl } from '../config';

import {
  Workspace,
  WorkspaceMember,
  Channel,
  DirectConversation,
  ChatMessage,
  MessagePage,
  TaskItem,
  UserProfile,
  SearchResult,
  WorkspaceSchedulerState,
  WorkspaceResource,
  DeadlockReport,
  WorkspaceInvitation,
  InvitationPreview,
  InvitationJoinResponse,
} from '../types/chat';

export class ApiClient {
  private get baseUrl(): string {
    return getApiBaseUrl();
  }

  public get token(): string | null {
    return localStorage.getItem('vgarss_token');
  }

  public setToken(token: string | null) {
    if (token) {
      localStorage.setItem('vgarss_token', token);
    } else {
      localStorage.removeItem('vgarss_token');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
      try {
        const errorJson = await response.json();
        if (errorJson.detail) {
          errorMessage = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
        }
      } catch {
        // use default error message
      }
      throw new Error(errorMessage);
    }

    return response.json();
  }

  // --- Health Check ---
  public async getHealth(): Promise<{
    status: string;
    version: string;
    timestamp: string;
    environment: string;
    ports: { rest_api: number; websocket: number; raw_tcp: number };
  }> {
    return this.request('/api/v1/health');
  }

  // --- Auth Endpoints ---
  public async register(payload: RegisterPayload): Promise<AuthSession> {
    const res = await this.request<AuthSession>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.token);
    return res;
  }

  public async login(payload: LoginPayload): Promise<AuthSession> {
    const res = await this.request<AuthSession>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.token);
    return res;
  }

  public async getMe(): Promise<User> {
    return this.request<User>('/api/v1/auth/me');
  }

  // Auto-bootstrap: logs in or registers a default developer account
  public async ensureDevSession(): Promise<string> {
    if (this.token) {
      try {
        await this.getMe();
        return this.token;
      } catch {
        this.setToken(null);
      }
    }

    // Try logging in as default alice_dev
    try {
      const session = await this.login({
        username: 'alice_dev',
        password: 'SecurePassword123!',
      });
      return session.token;
    } catch {
      // Register alice_dev
      try {
        const session = await this.register({
          username: 'alice_dev',
          email: 'alice@vgarss.org',
          password: 'SecurePassword123!',
        });
        return session.token;
      } catch {
        // Create unique dev session if duplicate
        const uniq = Math.random().toString(36).substring(7);
        const session = await this.register({
          username: `dev_${uniq}`,
          email: `dev_${uniq}@vgarss.org`,
          password: 'SecurePassword123!',
        });
        return session.token;
      }
    }
  }

  // --- Virtual Groups ---
  public async listGroups(): Promise<VirtualGroup[]> {
    return this.request<VirtualGroup[]>('/api/v1/groups');
  }

  public async createGroup(payload: CreateGroupPayload): Promise<VirtualGroup> {
    return this.request<VirtualGroup>('/api/v1/groups', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getGroup(groupId: string): Promise<VirtualGroup> {
    return this.request<VirtualGroup>(`/api/v1/groups/${groupId}`);
  }

  public async addGroupMember(
    groupId: string,
    payload: { username: string; role: 'ADMIN' | 'MEMBER' | 'VIEWER' }
  ): Promise<GroupMember> {
    return this.request<GroupMember>(`/api/v1/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Simulations ---
  public async listSimulations(groupId: string): Promise<SimulationResponse[]> {
    return this.request<SimulationResponse[]>(`/api/v1/groups/${groupId}/simulations`);
  }

  public async createSimulation(
    groupId: string,
    payload: SimulationCreatePayload
  ): Promise<SimulationResponse> {
    return this.request<SimulationResponse>(`/api/v1/groups/${groupId}/simulations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getSimulation(groupId: string, simId: string): Promise<SimulationResponse> {
    return this.request<SimulationResponse>(`/api/v1/groups/${groupId}/simulations/${simId}`);
  }

  public async stepSimulation(groupId: string, simId: string): Promise<SimulationStepResponse> {
    return this.request<SimulationStepResponse>(
      `/api/v1/groups/${groupId}/simulations/${simId}/step`,
      { method: 'POST' }
    );
  }

  public async playSimulation(groupId: string, simId: string): Promise<SimulationResponse> {
    return this.request<SimulationResponse>(
      `/api/v1/groups/${groupId}/simulations/${simId}/play`,
      { method: 'POST' }
    );
  }

  public async resetSimulation(groupId: string, simId: string): Promise<SimulationResponse> {
    return this.request<SimulationResponse>(
      `/api/v1/groups/${groupId}/simulations/${simId}/reset`,
      { method: 'POST' }
    );
  }

  public async updateSimulationPolicy(
    groupId: string,
    simId: string,
    payload: { algorithm: string; time_quantum?: number; is_preemptive?: boolean; aging_interval?: number | null }
  ): Promise<SimulationResponse> {
    return this.request<SimulationResponse>(
      `/api/v1/groups/${groupId}/simulations/${simId}/policy`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  }

  public async addProcess(
    groupId: string,
    simId: string,
    payload: { id: string; arrival_time: number; burst_time: number; priority?: number }
  ): Promise<any> {
    return this.request(
      `/api/v1/groups/${groupId}/simulations/${simId}/processes`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  // --- Raw TCP Server Demonstration ---
  public async getTcpStatus(): Promise<{ status: string; host: string; port: number; framing: string }> {
    return this.request('/api/v1/network/tcp/status');
  }

  public async testTcpPacket(payload: {
    action: string;
    client_id?: string;
    target_id?: string;
    payload?: any;
  }): Promise<any> {
    return this.request('/api/v1/network/tcp/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // --- Resources ---
  public async getResourceStatuses(groupId: string, simId: string): Promise<ResourceStatus[]> {
    return this.request<ResourceStatus[]>(
      `/api/v1/groups/${groupId}/simulations/${simId}/resources`
    );
  }

  public async acquireResource(
    groupId: string,
    simId: string,
    payload: ResourceAcquirePayload
  ): Promise<{ granted: boolean; process_id: string; resource_id: string; status: string }> {
    return this.request(
      `/api/v1/groups/${groupId}/simulations/${simId}/resources/acquire`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  public async releaseResource(
    groupId: string,
    simId: string,
    payload: ResourceReleasePayload
  ): Promise<{ released: boolean; process_id: string; resource_id: string; awakened_processes: string[] }> {
    return this.request(
      `/api/v1/groups/${groupId}/simulations/${simId}/resources/release`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  }

  public async checkDeadlock(groupId: string, simId: string): Promise<DeadlockStatus> {
    return this.request<DeadlockStatus>(
      `/api/v1/groups/${groupId}/simulations/${simId}/resources/deadlock`
    );
  }

  // ==========================================
  // V2 CHAT & WORKSPACE COLLABORATION API
  // ==========================================

  public async getProfile(): Promise<UserProfile> {
    return this.request<UserProfile>('/api/v2/auth/me');
  }

  public async updatePresence(presenceState: string, statusMessage?: string): Promise<any> {
    return this.request('/api/v2/auth/presence', {
      method: 'PATCH',
      body: JSON.stringify({ presence_state: presenceState, status_message: statusMessage }),
    });
  }

  public async devSwitchUser(username: string): Promise<{ token: string; user: any }> {
    const res = await this.request<{ token: string; user: any }>('/api/v2/auth/dev-switch', {
      method: 'POST',
      body: JSON.stringify({ username }),
    });
    this.setToken(res.token);
    return res;
  }

  public async listWorkspaces(): Promise<Workspace[]> {
    return this.request<Workspace[]>('/api/v2/workspaces');
  }

  public async createWorkspace(payload: { name: string; description?: string; icon_url?: string }): Promise<Workspace> {
    return this.request<Workspace>('/api/v2/workspaces', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    return this.request<WorkspaceMember[]>(`/api/v2/workspaces/${workspaceId}/members`);
  }

  public async addWorkspaceMember(workspaceId: string, username: string, role: string = 'MEMBER'): Promise<WorkspaceMember> {
    return this.request<WorkspaceMember>(`/api/v2/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body: JSON.stringify({ username, role }),
    });
  }

  public async listWorkspaceChannels(workspaceId: string): Promise<Channel[]> {
    return this.request<Channel[]>(`/api/v2/workspaces/${workspaceId}/channels`);
  }

  public async createChannel(workspaceId: string, payload: { name: string; topic?: string; channel_type?: string; is_private?: boolean }): Promise<Channel> {
    return this.request<Channel>(`/api/v2/workspaces/${workspaceId}/channels`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async getChannelMessages(channelId: string, limit: number = 50, beforeId?: string): Promise<MessagePage> {
    let url = `/api/v2/channels/${channelId}/messages?limit=${limit}`;
    if (beforeId) url += `&before_id=${beforeId}`;
    return this.request<MessagePage>(url);
  }

  public async postChannelMessage(
    channelId: string,
    content: string,
    clientMsgId?: string,
    messageType: string = 'USER_TEXT',
    parentId?: string,
    payloadJson?: Record<string, any>
  ): Promise<ChatMessage> {
    return this.request<ChatMessage>(`/api/v2/channels/${channelId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        client_msg_id: clientMsgId,
        message_type: messageType,
        parent_id: parentId,
        payload_json: payloadJson,
      }),
    });
  }

  public async markChannelRead(channelId: string): Promise<void> {
    await this.request(`/api/v2/channels/${channelId}/read`, { method: 'POST' });
  }

  public async listDms(workspaceId: string): Promise<DirectConversation[]> {
    return this.request<DirectConversation[]>(`/api/v2/workspaces/${workspaceId}/dms`);
  }

  public async openDm(workspaceId: string, recipientId: string): Promise<DirectConversation> {
    return this.request<DirectConversation>(`/api/v2/workspaces/${workspaceId}/dms`, {
      method: 'POST',
      body: JSON.stringify({ recipient_id: recipientId }),
    });
  }

  public async getDmMessages(conversationId: string, limit: number = 50, beforeId?: string): Promise<MessagePage> {
    let url = `/api/v2/dms/${conversationId}/messages?limit=${limit}`;
    if (beforeId) url += `&before_id=${beforeId}`;
    return this.request<MessagePage>(url);
  }

  public async postDmMessage(conversationId: string, content: string, clientMsgId?: string): Promise<ChatMessage> {
    return this.request<ChatMessage>(`/api/v2/dms/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, client_msg_id: clientMsgId }),
    });
  }

  public async markDmRead(conversationId: string): Promise<void> {
    await this.request(`/api/v2/dms/${conversationId}/read`, { method: 'POST' });
  }

  public async listTasks(workspaceId: string, status?: string): Promise<TaskItem[]> {
    let url = `/api/v2/workspaces/${workspaceId}/tasks`;
    if (status) url += `?status=${status}`;
    return this.request<TaskItem[]>(url);
  }

  public async createTask(payload: {
    workspace_id: string;
    channel_id?: string;
    source_message_id?: string;
    title: string;
    description?: string;
    assignee_id?: string;
    priority?: string;
    deadline?: string;
    estimated_burst_ticks?: number;
  }): Promise<TaskItem> {
    return this.request<TaskItem>('/api/v2/tasks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async updateTask(taskId: string, payload: { status?: string; assignee_id?: string; priority?: string; action?: string; deadline?: string }): Promise<TaskItem> {
    return this.request<TaskItem>(`/api/v2/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  public async getTaskDetails(taskId: string): Promise<TaskItem> {
    return this.request<TaskItem>(`/api/v2/tasks/${taskId}`);
  }

  public async acquireTaskResource(
    taskId: string,
    resourceId: string,
    mode: 'EXCLUSIVE' | 'SHARED' = 'EXCLUSIVE',
    units: number = 1
  ): Promise<{ granted: boolean; task_id: string; resource_id: string; status: string }> {
    return this.request(`/api/v2/tasks/${taskId}/resources/acquire`, {
      method: 'POST',
      body: JSON.stringify({ resource_id: resourceId, mode, units }),
    });
  }

  public async releaseTaskResource(
    taskId: string,
    resourceId: string,
    units?: number
  ): Promise<{ released: boolean; task_id: string; resource_id: string; awakened_tasks: string[] }> {
    return this.request(`/api/v2/tasks/${taskId}/resources/release`, {
      method: 'POST',
      body: JSON.stringify({ resource_id: resourceId, units }),
    });
  }

  public async getWorkspaceSchedulerState(workspaceId: string): Promise<WorkspaceSchedulerState> {
    return this.request<WorkspaceSchedulerState>(`/api/v2/workspaces/${workspaceId}/scheduler`);
  }

  public async stepWorkspaceScheduler(workspaceId: string): Promise<WorkspaceSchedulerState> {
    return this.request<WorkspaceSchedulerState>(`/api/v2/workspaces/${workspaceId}/scheduler/step`, {
      method: 'POST',
    });
  }

  public async updateWorkspaceSchedulerPolicy(
    workspaceId: string,
    algorithm: string,
    timeQuantum: number = 2,
    agingInterval: number = 5
  ): Promise<any> {
    return this.request(
      `/api/v2/workspaces/${workspaceId}/scheduler/policy?algorithm=${algorithm}&time_quantum=${timeQuantum}&aging_interval=${agingInterval}`,
      { method: 'POST' }
    );
  }

  public async resetWorkspaceScheduler(workspaceId: string): Promise<WorkspaceSchedulerState> {
    return this.request<WorkspaceSchedulerState>(`/api/v2/workspaces/${workspaceId}/scheduler/reset`, {
      method: 'POST',
    });
  }

  public async listWorkspaceResources(workspaceId: string): Promise<WorkspaceResource[]> {
    return this.request<WorkspaceResource[]>(`/api/v2/workspaces/${workspaceId}/resources`);
  }

  public async checkWorkspaceDeadlock(workspaceId: string): Promise<DeadlockReport> {
    return this.request<DeadlockReport>(`/api/v2/workspaces/${workspaceId}/deadlock`);
  }

  public async searchWorkspace(workspaceId: string, query: string): Promise<SearchResult[]> {
    return this.request<SearchResult[]>(`/api/v2/search?workspace_id=${workspaceId}&q=${encodeURIComponent(query)}`);
  }

  // --- Auth V2 Real User Session Endpoints ---
  public async v2Register(payload: { username: string; email: string; password: string }): Promise<{ token: string; user: UserProfile }> {
    const res = await this.request<{ token: string; user: any }>('/api/v2/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.token);
    return res;
  }

  public async v2Login(payload: { username: string; password: string }): Promise<{ token: string; user: UserProfile }> {
    const res = await this.request<{ token: string; user: any }>('/api/v2/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    this.setToken(res.token);
    return res;
  }

  public async v2Logout(): Promise<void> {
    try {
      await this.request('/api/v2/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // --- Workspace Invitations & QR Code Endpoints ---
  public async createWorkspaceInvitation(
    workspaceId: string,
    payload: { role?: string; expires_in_hours?: number; max_uses?: number }
  ): Promise<WorkspaceInvitation> {
    return this.request<WorkspaceInvitation>(`/api/v2/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async listWorkspaceInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    return this.request<WorkspaceInvitation[]>(`/api/v2/workspaces/${workspaceId}/invitations`);
  }

  public async revokeWorkspaceInvitation(workspaceId: string, invitationId: string): Promise<void> {
    await this.request(`/api/v2/workspaces/${workspaceId}/invitations/${invitationId}`, {
      method: 'DELETE',
    });
  }

  public async previewInvitation(code: string): Promise<InvitationPreview> {
    return this.request<InvitationPreview>(`/api/v2/invitations/${code}`);
  }

  public async joinWorkspaceViaInvitation(code: string): Promise<InvitationJoinResponse> {
    return this.request<InvitationJoinResponse>(`/api/v2/invitations/${code}/join`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();


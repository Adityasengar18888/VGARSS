export interface UserProfile {
  id: string;
  username: string;
  email: string;
  display_name: string;
  avatar_url?: string | null;
  bio?: string;
  status_message?: string;
  presence_state: 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';
  last_seen_at?: string;
}

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon_url?: string | null;
  owner_id: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  unread_count: number;
  created_at: string;
}

export interface WorkspaceMember {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'GUEST';
  presence_state: 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';
  status_message?: string;
  joined_at: string;
}

export interface Channel {
  id: string;
  workspace_id: string;
  name: string;
  topic: string;
  channel_type: 'TEXT' | 'SIMULATION' | 'ANNOUNCEMENT';
  is_private: boolean;
  created_by: string;
  unread_count: number;
  created_at: string;
}

export interface DirectConversation {
  id: string;
  workspace_id: string;
  is_group: boolean;
  recipient: UserProfile;
  unread_count: number;
  last_message?: any;
}

export interface ChatMessage {
  id: string;
  workspace_id: string;
  channel_id?: string | null;
  conversation_id?: string | null;
  sender_id?: string | null;
  sender_username?: string | null;
  sender_display_name?: string | null;
  sender_avatar?: string | null;
  message_type: 'USER_TEXT' | 'SYSTEM_EVENT' | 'TASK_CARD' | 'CODE_SNIPPET';
  content: string;
  parent_id?: string | null;
  reply_count: number;
  is_edited: boolean;
  is_pinned: boolean;
  payload_json?: Record<string, any>;
  client_msg_id?: string;
  seq: number;
  created_at: string;
  status?: 'queued' | 'sending' | 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'retrying';
  delivery_status?: 'SENT' | 'DELIVERED' | 'READ';
}

export interface MessagePage {
  messages: ChatMessage[];
  has_more: boolean;
  next_cursor?: string | null;
  total_count: number;
}

export interface TaskItem {
  id: string;
  workspace_id: string;
  channel_id?: string | null;
  source_message_id?: string | null;
  creator_id: string;
  creator_name: string;
  assignee_id?: string | null;
  assignee_name?: string | null;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  numeric_priority: number;
  arrival_time?: number;
  deadline?: string | null;
  estimated_burst_ticks: number;
  remaining_burst_ticks?: number;
  status: 'NEW' | 'READY' | 'RUNNING' | 'WAITING' | 'TERMINATED';
  waiting_ticks?: number;
  turnaround_ticks?: number;
  response_ticks?: number;
  required_resources?: string[];
  held_resources?: string[];
  waiting_on_resource?: string | null;
  created_at: string;
}

export interface WorkspaceSchedulerState {
  workspace_id: string;
  current_tick: number;
  algorithm: string;
  time_quantum: number;
  aging_interval?: number | null;
  is_preemptive: boolean;
  running_task_id?: string | null;
  running_task?: TaskItem | null;
  ready_queue: TaskItem[];
  waiting_queue: TaskItem[];
  terminated_tasks: TaskItem[];
  gantt_history: Array<{
    tick: number;
    process_id: string | null;
    state: string;
    task_title?: string;
  }>;
  metrics: {
    total_ticks: number;
    busy_ticks: number;
    idle_ticks: number;
    cpu_utilization: number;
    throughput: number;
    avg_waiting_time: number;
    avg_turnaround_time: number;
    avg_response_time: number;
  };
}

export interface WorkspaceResource {
  id: string;
  workspace_id: string;
  name: string;
  resource_type: 'MUTEX' | 'SEMAPHORE';
  total_capacity: number;
  available_units: number;
  exclusive_holder_task_id?: string | null;
  exclusive_holder_name?: string | null;
  shared_holders: Record<string, number>;
  wait_queue: Array<{
    task_id: string;
    task_title: string;
    requested_units: number;
    mode: string;
  }>;
  order_rank: number;
  description: string;
}

export interface DeadlockReport {
  deadlock_detected: boolean;
  cycle_tasks: string[];
  cycle_resources: string[];
  wait_for_edges?: Array<{ waiter: string; holder: string; resource: string }>;
  description: string;
  recommended_action?: string | null;
}

export interface SearchResult {
  id: string;
  type: 'message' | 'task';
  title: string;
  snippet: string;
  workspace_id: string;
  channel_id?: string | null;
  channel_name?: string | null;
  created_at: string;
}

export interface WorkspaceInvitation {
  id: string;
  workspace_id: string;
  code: string;
  role: string;
  max_uses: number;
  uses_count: number;
  expires_at?: string | null;
  revoked_at?: string | null;
  invite_url: string;
  created_at: string;
}

export interface InvitationPreview {
  code: string;
  workspace_id: string;
  workspace_name: string;
  workspace_description: string;
  icon_url?: string | null;
  member_count: number;
  role: string;
  is_valid: boolean;
  invalid_reason?: string | null;
  expires_at?: string | null;
}

export interface InvitationJoinResponse {
  workspace_id: string;
  workspace_name: string;
  role: string;
  status: string;
}



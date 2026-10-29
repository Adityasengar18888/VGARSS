import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskDetailModal } from '../components/chat/TaskDetailModal';
import { TaskCreationModal } from '../components/chat/TaskCreationModal';
import { TaskItem, WorkspaceMember, WorkspaceResource, Channel } from '../types/chat';

describe('VGARSS 2.0 Task & Scheduling Frontend Components', () => {
  const mockTask: TaskItem = {
    id: 'task-test-1',
    workspace_id: 'ws-1',
    channel_id: 'ch-os',
    source_message_id: 'msg-origin-1',
    title: 'Round Robin CPU Simulation Workload',
    description: 'Kernel preemption and context switch test',
    creator_id: 'user-alice',
    creator_name: 'alice',
    assignee_id: 'user-bob',
    assignee_name: 'bob',
    priority: 'HIGH',
    numeric_priority: 2,
    status: 'READY',
    arrival_time: 2,
    estimated_burst_ticks: 8,
    remaining_burst_ticks: 6,
    waiting_ticks: 1,
    turnaround_ticks: undefined,
    response_ticks: 0,
    required_resources: ['res-mutex-gpu'],
    held_resources: ['res-mutex-gpu'],
    waiting_on_resource: null,
    created_at: '2026-10-28T20:00:00Z',
  };

  const mockMembers: WorkspaceMember[] = [
    {
      user_id: 'user-alice',
      username: 'alice',
      display_name: 'Alice Cooper',
      role: 'ADMIN',
      presence_state: 'ONLINE',
      joined_at: '2026-10-28T00:00:00Z',
    },
    {
      user_id: 'user-bob',
      username: 'bob',
      display_name: 'Bob Smith',
      role: 'MEMBER',
      presence_state: 'ONLINE',
      joined_at: '2026-10-28T00:00:00Z',
    },
  ];

  const mockResources: WorkspaceResource[] = [
    {
      id: 'res-mutex-gpu',
      workspace_id: 'ws-1',
      name: 'GPU Cluster Mutex',
      resource_type: 'MUTEX',
      total_capacity: 1,
      available_units: 0,
      shared_holders: {},
      wait_queue: [],
      order_rank: 1,
      description: 'GPU',
    },
    {
      id: 'res-sem-io',
      workspace_id: 'ws-1',
      name: 'I/O Bus Semaphore',
      resource_type: 'SEMAPHORE',
      total_capacity: 3,
      available_units: 3,
      shared_holders: {},
      wait_queue: [],
      order_rank: 2,
      description: 'IO',
    },
  ];

  const mockChannels: Channel[] = [
    {
      id: 'ch-os',
      workspace_id: 'ws-1',
      name: 'os-scheduling-lab',
      topic: 'OS scheduling experiments',
      channel_type: 'TEXT',
      is_private: false,
      created_by: 'user-alice',
      unread_count: 0,
      created_at: '2026-10-28T00:00:00Z',
    },
  ];

  it('renders TaskDetailModal with full process lifecycle, metrics, and held resources', () => {
    const onUpdateStatus = vi.fn().mockResolvedValue(undefined);
    const onAssignUser = vi.fn().mockResolvedValue(undefined);
    const onAcquireResource = vi.fn().mockResolvedValue(undefined);
    const onReleaseResource = vi.fn().mockResolvedValue(undefined);
    const onNavigateToConversation = vi.fn();
    const onNavigateToScheduler = vi.fn();
    const onNavigateToDeadlock = vi.fn();
    const onClose = vi.fn();

    render(
      <TaskDetailModal
        isOpen={true}
        onClose={onClose}
        task={mockTask}
        members={mockMembers}
        availableResources={mockResources}
        onUpdateStatus={onUpdateStatus}
        onAssignUser={onAssignUser}
        onAcquireResource={onAcquireResource}
        onReleaseResource={onReleaseResource}
        onNavigateToConversation={onNavigateToConversation}
        onNavigateToScheduler={onNavigateToScheduler}
        onNavigateToDeadlock={onNavigateToDeadlock}
      />
    );

    // Title and status
    expect(screen.getByText('Round Robin CPU Simulation Workload')).toBeInTheDocument();
    expect(screen.getByText('READY')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();

    // Simulated OS Process Metrics
    expect(screen.getByText('Arrival Tick')).toBeInTheDocument();
    expect(screen.getByText('Burst Ticks')).toBeInTheDocument();
    expect(screen.getByText('Remaining Ticks')).toBeInTheDocument();
    expect(screen.getByText('Waiting Time')).toBeInTheDocument();
    expect(screen.getByText('1 ticks')).toBeInTheDocument(); // Waiting ticks

    // Held resource
    expect(screen.getByText('GPU Cluster Mutex')).toBeInTheDocument();

    // Go to Chat button
    const chatBtn = screen.getByText('Go to Chat');
    expect(chatBtn).toBeInTheDocument();
    fireEvent.click(chatBtn);
    expect(onNavigateToConversation).toHaveBeenCalledWith('ch-os', 'msg-origin-1');

    // Lifecycle Action Buttons
    const dispatchBtn = screen.getByText('Dispatch to CPU');
    expect(dispatchBtn).toBeInTheDocument();
    fireEvent.click(dispatchBtn);
    expect(onUpdateStatus).toHaveBeenCalledWith('task-test-1', 'RUNNING', 'DISPATCH');
  });

  it('renders TaskCreationModal with arrival, burst, deadline, and resource selection', async () => {
    const onCreateTask = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <TaskCreationModal
        isOpen={true}
        onClose={onClose}
        workspaceId="ws-1"
        channels={mockChannels}
        members={mockMembers}
        resources={mockResources}
        initialTitle="Test SJF Dispatch"
        initialMessageId="msg-origin-1"
        initialChannelId="ch-os"
        onCreateTask={onCreateTask}
      />
    );

    expect(screen.getByDisplayValue('Test SJF Dispatch')).toBeInTheDocument();
    expect(screen.getByText('GPU Cluster Mutex')).toBeInTheDocument();
    expect(screen.getByText('I/O Bus Semaphore')).toBeInTheDocument();

    // Toggle resource requirement
    const semResourceBtn = screen.getByText('I/O Bus Semaphore');
    fireEvent.click(semResourceBtn);

    // Submit form
    const submitBtn = screen.getByText('Create & Announce Task');
    fireEvent.click(submitBtn);

    expect(onCreateTask).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: 'ws-1',
        title: 'Test SJF Dispatch',
        source_message_id: 'msg-origin-1',
        required_resources: ['res-sem-io'],
      })
    );
  });
});

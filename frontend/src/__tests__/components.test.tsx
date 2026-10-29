import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Card } from '../components/common/Card';
import { LoadingState, EmptyState, ErrorState } from '../components/common/States';
import { GanttChart } from '../components/gantt/GanttChart';
import { QueueSwimlanes } from '../components/queues/QueueSwimlanes';
import { Sidebar } from '../components/common/Sidebar';
import { Header } from '../components/common/Header';
import { ProcessControlBlock } from '../types/process';
import { GanttEntry } from '../types/simulation';

describe('VGARSS Reusable Component Library', () => {
  it('renders Card with title, subtitle, badge, and children', () => {
    render(
      <Card
        title="CPU Utilization"
        subtitle="Current core load"
        badge={<span data-testid="badge">ACTIVE</span>}
      >
        <p>94.5%</p>
      </Card>
    );

    expect(screen.getByText('CPU Utilization')).toBeInTheDocument();
    expect(screen.getByText('Current core load')).toBeInTheDocument();
    expect(screen.getByTestId('badge')).toBeInTheDocument();
    expect(screen.getByText('94.5%')).toBeInTheDocument();
  });

  it('renders Loading, Empty, and Error states correctly', () => {
    const { rerender } = render(<LoadingState message="Bootstrapping kernel..." />);
    expect(screen.getByText('Bootstrapping kernel...')).toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(<ErrorState message="Connection dropped" onRetry={onRetry} />);
    expect(screen.getByText('Connection dropped')).toBeInTheDocument();
    const retryBtn = screen.getByText('Try Again');
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledTimes(1);

    rerender(<EmptyState title="No Virtual Groups" description="Create a group to start" />);
    expect(screen.getByText('No Virtual Groups')).toBeInTheDocument();
    expect(screen.getByText('Create a group to start')).toBeInTheDocument();
  });

  it('renders GanttChart with process swimlanes and ticks', () => {
    const entries: GanttEntry[] = [
      { tick: 0, process_id: 'P1', state: 'RUNNING' },
      { tick: 1, process_id: 'P1', state: 'RUNNING' },
      { tick: 2, process_id: 'P2', state: 'RUNNING' },
    ];
    const processes: ProcessControlBlock[] = [
      {
        id: 'P1',
        arrival_time: 0,
        burst_time: 2,
        remaining_time: 0,
        priority: 1,
        state: 'TERMINATED',
        start_time: 0,
        completion_time: 2,
        waiting_time: 0,
        turnaround_time: 2,
        response_time: 0,
      },
      {
        id: 'P2',
        arrival_time: 1,
        burst_time: 3,
        remaining_time: 2,
        priority: 2,
        state: 'RUNNING',
        start_time: 2,
        completion_time: null,
        waiting_time: 1,
        turnaround_time: 0,
        response_time: 1,
      },
    ];

    render(<GanttChart entries={entries} processes={processes} currentTick={3} />);

    expect(screen.getAllByText('P1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('P2').length).toBeGreaterThan(0);
    expect(screen.getByText('Running Burst')).toBeInTheDocument();
    expect(screen.getByText('Ready Wait')).toBeInTheDocument();
  });

  it('renders QueueSwimlanes with Running, Ready, and Terminated processes', () => {
    const processes: ProcessControlBlock[] = [
      {
        id: 'P1',
        arrival_time: 0,
        burst_time: 5,
        remaining_time: 3,
        priority: 1,
        state: 'RUNNING',
        waiting_time: 0,
        turnaround_time: 0,
        response_time: 0,
      },
      {
        id: 'P2',
        arrival_time: 1,
        burst_time: 4,
        remaining_time: 4,
        priority: 2,
        state: 'READY',
        waiting_time: 1,
        turnaround_time: 0,
        response_time: 0,
      },
      {
        id: 'P3',
        arrival_time: 0,
        burst_time: 2,
        remaining_time: 0,
        priority: 3,
        state: 'TERMINATED',
        waiting_time: 0,
        turnaround_time: 2,
        response_time: 0,
      },
    ];

    render(
      <QueueSwimlanes
        processes={processes}
        readyQueueIds={['P2']}
        waitingQueueIds={[]}
        runningProcessId="P1"
      />
    );

    expect(screen.getByText('CPU Dispatcher')).toBeInTheDocument();
    expect(screen.getByText('Ready Queue')).toBeInTheDocument();
    expect(screen.getByText('Blocked / Waiting')).toBeInTheDocument();
    expect(screen.getByText('Terminated Pool')).toBeInTheDocument();
    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('P2')).toBeInTheDocument();
    expect(screen.getByText('P3')).toBeInTheDocument();
  });

  it('renders Sidebar with all 8 views and handles navigation', () => {
    const onNavigate = vi.fn();
    render(
      <Sidebar
        currentView="scheduler"
        onNavigate={onNavigate}
        currentUser={{ id: 'u1', username: 'alice_dev', email: 'alice@vgarss.org', created_at: 'now' }}
        role="OWNER"
      />
    );

    expect(screen.getByText('Overview')).toBeInTheDocument();
    expect(screen.getByText('Virtual Groups')).toBeInTheDocument();
    expect(screen.getByText('Process Scheduler')).toBeInTheDocument();
    expect(screen.getByText('Resource Monitor')).toBeInTheDocument();
    expect(screen.getByText('Network & TCP')).toBeInTheDocument();
    expect(screen.getByText('Deadlock Lab')).toBeInTheDocument();
    expect(screen.getByText('Analytics')).toBeInTheDocument();
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('alice_dev')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Overview'));
    expect(onNavigate).toHaveBeenCalledWith('overview');

    fireEvent.click(screen.getByText('Deadlock Lab'));
    expect(onNavigate).toHaveBeenCalledWith('deadlock');
  });

  it('renders Header with simulation controls, clock, and connection badges', () => {
    const onStep = vi.fn();
    const onPlay = vi.fn();
    const onPause = vi.fn();
    const onReset = vi.fn();

    render(
      <Header
        groups={[{ id: 'g1', name: 'Cluster Alpha', owner_id: 'u1', created_at: 'now' }]}
        selectedGroup={{ id: 'g1', name: 'Cluster Alpha', owner_id: 'u1', created_at: 'now' }}
        onSelectGroup={vi.fn()}
        currentTick={42}
        isPlaying={false}
        onPlay={onPlay}
        onPause={onPause}
        onStep={onStep}
        onReset={onReset}
        speedMs={500}
        onSpeedChange={vi.fn()}
        simulationStatus="RUNNING"
        wsStatus="connected"
        wsLatency={15}
        apiLatency={12}
        apiStatus="connected"
      />
    );

    expect(screen.getByText('VGARSS')).toBeInTheDocument();
    expect(screen.getByText('T=0042')).toBeInTheDocument();
    expect(screen.getAllByText('Cluster Alpha').length).toBeGreaterThan(0);
    expect(screen.getByText('+1 Tick')).toBeInTheDocument();
    expect(screen.getByText('API')).toBeInTheDocument();
    expect(screen.getByText('WS')).toBeInTheDocument();
    expect(screen.getByText('TCP:9000')).toBeInTheDocument();

    fireEvent.click(screen.getByText('+1 Tick'));
    expect(onStep).toHaveBeenCalledTimes(1);
  });
});

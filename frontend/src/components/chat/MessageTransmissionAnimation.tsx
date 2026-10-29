import { useEffect, useRef, useState, useMemo } from 'react';
import { MessageLifecycleState, NeuralGraph, NeuralNode, NeuralEdge } from '../../types/messageLifecycle';
import { MessageDeliveryStatus } from './MessageDeliveryStatus';

interface MessageTransmissionAnimationProps {
  messageId: string;
  state: MessageLifecycleState;
  isOutgoing?: boolean;
  compact?: boolean;
  theme?: 'light' | 'dark';
  onRetry?: () => void;
  className?: string;
}

// Fast deterministic integer hash for consistent per-message graphs
function hashSeed(str: string): number {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pseudoRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function MessageTransmissionAnimation({
  messageId,
  state,
  isOutgoing = true,
  compact = false,
  theme = 'light',
  onRetry,
  className = '',
}: MessageTransmissionAnimationProps) {
  // We only show transmission neural animation for outgoing messages
  if (!isOutgoing) return null;

  const [settled, setSettled] = useState<boolean>(() => {
    // If message was already delivered or read before mounting (e.g. loaded from history), start settled
    return state === 'delivered' || state === 'read';
  });

  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const particleRef = useRef<SVGCircleElement>(null);
  const trailRef = useRef<SVGPolylineElement>(null);
  const destRingRef = useRef<SVGCircleElement>(null);
  const destNodeRef = useRef<SVGCircleElement>(null);
  const rafIdRef = useRef<number | null>(null);

  // Check reduced motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, []);

  // Dimensions
  const width = compact ? 84 : 144;
  const height = compact ? 22 : 30;
  const padX = compact ? 8 : 12;
  const centerY = height / 2;

  // Build deterministic neural graph based on message ID
  const graph: NeuralGraph = useMemo(() => {
    const seed = hashSeed(messageId);
    const rnd = pseudoRandom(seed);

    const nodes: NeuralNode[] = [];
    const edges: NeuralEdge[] = [];

    // 1. Origin Node (Sender)
    const originNode: NeuralNode = {
      id: 'origin',
      x: padX,
      y: centerY,
      r: compact ? 3.5 : 4.5,
      layer: 0,
      isOrigin: true,
    };
    nodes.push(originNode);

    // 2. Layer 1: Intermediate Synaptic Nodes (2 nodes)
    const layer1Count = compact ? 2 : 3;
    const layer1X = padX + (width - padX * 2) * 0.33;
    const l1Nodes: NeuralNode[] = [];
    for (let i = 0; i < layer1Count; i++) {
      const spread = (i - (layer1Count - 1) / 2) * (compact ? 7 : 9);
      const jitterY = (rnd() - 0.5) * 4;
      const n: NeuralNode = {
        id: `l1-${i}`,
        x: Math.round(layer1X + (rnd() - 0.5) * 4),
        y: Math.max(4, Math.min(height - 4, centerY + spread + jitterY)),
        r: compact ? 2.2 : 2.8,
        layer: 1,
      };
      nodes.push(n);
      l1Nodes.push(n);
      edges.push({
        id: `e-0-${n.id}`,
        fromId: originNode.id,
        toId: n.id,
        x1: originNode.x,
        y1: originNode.y,
        x2: n.x,
        y2: n.y,
        weight: 0.6 + rnd() * 0.4,
      });
    }

    // 3. Layer 2: Intermediate Router Nodes (2 nodes)
    const layer2Count = compact ? 2 : 3;
    const layer2X = padX + (width - padX * 2) * 0.67;
    const l2Nodes: NeuralNode[] = [];
    for (let i = 0; i < layer2Count; i++) {
      const spread = (i - (layer2Count - 1) / 2) * (compact ? 7 : 9);
      const jitterY = (rnd() - 0.5) * 4;
      const n: NeuralNode = {
        id: `l2-${i}`,
        x: Math.round(layer2X + (rnd() - 0.5) * 4),
        y: Math.max(4, Math.min(height - 4, centerY + spread + jitterY)),
        r: compact ? 2.2 : 2.8,
        layer: 2,
      };
      nodes.push(n);
      l2Nodes.push(n);
    }

    // Interconnect Layer 1 to Layer 2
    for (const n1 of l1Nodes) {
      for (const n2 of l2Nodes) {
        if (rnd() > 0.25) {
          edges.push({
            id: `e-${n1.id}-${n2.id}`,
            fromId: n1.id,
            toId: n2.id,
            x1: n1.x,
            y1: n1.y,
            x2: n2.x,
            y2: n2.y,
            weight: 0.4 + rnd() * 0.6,
          });
        }
      }
    }

    // 4. Destination Node (Server / Recipient)
    const destNode: NeuralNode = {
      id: 'dest',
      x: width - padX,
      y: centerY,
      r: compact ? 3.5 : 4.5,
      layer: 3,
      isDestination: true,
    };
    nodes.push(destNode);

    // Connect Layer 2 to Destination
    for (const n2 of l2Nodes) {
      edges.push({
        id: `e-${n2.id}-dest`,
        fromId: n2.id,
        toId: destNode.id,
        x1: n2.x,
        y1: n2.y,
        x2: destNode.x,
        y2: destNode.y,
        weight: 0.6 + rnd() * 0.4,
      });
    }

    // Pick deterministic active route for traveling packet
    const chosenL1 = l1Nodes[Math.floor(rnd() * l1Nodes.length)];
    const chosenL2 = l2Nodes[Math.floor(rnd() * l2Nodes.length)];
    const activeRoute = [originNode.id, chosenL1.id, chosenL2.id, destNode.id];

    // Compute total distance of active route
    let totalDist = 0;
    const routeNodes = [originNode, chosenL1, chosenL2, destNode];
    for (let i = 0; i < routeNodes.length - 1; i++) {
      const a = routeNodes[i];
      const b = routeNodes[i + 1];
      totalDist += Math.hypot(b.x - a.x, b.y - a.y);
    }

    return {
      nodes,
      edges,
      activeRoute,
      totalPathLength: totalDist,
    };
  }, [messageId, compact, width, height, padX, centerY]);

  // Transition to settled when message is delivered or read, or after brief completion delay on 'sent'
  useEffect(() => {
    if (state === 'delivered' || state === 'read') {
      const timer = setTimeout(() => setSettled(true), 800);
      return () => clearTimeout(timer);
    } else if (state === 'sent') {
      // Allow the packet to hit the destination node, celebrate with ring pulse, then settle
      const timer = setTimeout(() => setSettled(true), 1500);
      return () => clearTimeout(timer);
    } else {
      setSettled(false);
    }
  }, [state]);

  // Frame-based animation loop for the packet & energy trail
  useEffect(() => {
    if (settled || prefersReducedMotion || state === 'failed') {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      return;
    }

    const routeNodes = graph.activeRoute.map((id) => graph.nodes.find((n) => n.id === id)!);
    let startTime = performance.now();
    const duration = 1200; // ms per transit cycle

    const trailHistory: { x: number; y: number }[] = [];

    const animate = (now: number) => {
      // Pause if tab is hidden
      if (document.hidden) {
        rafIdRef.current = requestAnimationFrame(animate);
        return;
      }

      const elapsed = now - startTime;
      let progress = (elapsed % duration) / duration;

      // Easing: quadratic in-out
      const eased = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;

      // If state is 'sent', cap progress at 1.0 (destination) and pulse
      let effectiveProgress = eased;
      if (state === 'sent') {
        const sentElapsed = elapsed;
        effectiveProgress = Math.min(1.0, sentElapsed / (duration * 0.7));
      }

      // Calculate particle position along multi-segment path
      let targetDist = effectiveProgress * graph.totalPathLength;
      let currentX = routeNodes[0].x;
      let currentY = routeNodes[0].y;

      let accumulated = 0;
      for (let i = 0; i < routeNodes.length - 1; i++) {
        const p1 = routeNodes[i];
        const p2 = routeNodes[i + 1];
        const segDist = Math.hypot(p2.x - p1.x, p2.y - p1.y);

        if (targetDist <= accumulated + segDist || i === routeNodes.length - 2) {
          const segProgress = Math.max(0, Math.min(1, (targetDist - accumulated) / segDist));
          currentX = p1.x + (p2.x - p1.x) * segProgress;
          currentY = p1.y + (p2.y - p1.y) * segProgress;
          break;
        }
        accumulated += segDist;
      }

      // Update particle element via DOM ref (bypassing React re-renders for 60fps)
      if (particleRef.current) {
        particleRef.current.setAttribute('cx', currentX.toFixed(1));
        particleRef.current.setAttribute('cy', currentY.toFixed(1));
      }

      // Update energy trail
      trailHistory.push({ x: currentX, y: currentY });
      if (trailHistory.length > 5) trailHistory.shift();

      if (trailRef.current && trailHistory.length > 1) {
        const pts = trailHistory.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        trailRef.current.setAttribute('points', pts);
      }

      // Trigger destination celebration ring when reaching end or in 'sent'
      if (destRingRef.current && (effectiveProgress >= 0.95 || state === 'sent')) {
        const ringProgress = (elapsed % 800) / 800;
        const ringR = (compact ? 4 : 5) + ringProgress * (compact ? 6 : 8);
        const ringOpacity = Math.max(0, 1 - ringProgress);
        destRingRef.current.setAttribute('r', ringR.toFixed(1));
        destRingRef.current.setAttribute('opacity', ringOpacity.toFixed(2));
      }

      rafIdRef.current = requestAnimationFrame(animate);
    };

    rafIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [settled, prefersReducedMotion, state, graph, compact]);

  // Color tokens based on theme & state
  const isDark = theme === 'dark';
  const edgeColor = isDark ? '#334155' : '#D0D5DD';
  const activeEdgeColor = isDark ? '#38BDF8' : '#4055A8';
  const nodeFill = isDark ? '#0F172A' : '#FFFFFF';
  const nodeStroke = isDark ? '#64748B' : '#98A2B3';
  const particleColor = state === 'failed' ? '#C0393A' : isDark ? '#38BDF8' : '#4055A8';
  const destColor =
    state === 'failed'
      ? '#C0393A'
      : state === 'read'
      ? '#4055A8'
      : state === 'delivered' || state === 'sent'
      ? '#16805D'
      : nodeStroke;

  // Once settled or if in reduced-motion mode, show clean compact status
  if (settled || prefersReducedMotion) {
    return (
      <div className={`inline-flex items-center space-x-1 ${className}`} aria-label={`Message status: ${state}`}>
        <MessageDeliveryStatus state={state} onRetry={onRetry} showText={false} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`inline-flex items-center space-x-1.5 align-middle select-none transition-opacity duration-300 ${className}`}
      aria-label={`Transmission in progress: ${state}`}
      role="status"
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <filter id={`glow-${messageId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 1. Inactive Background Synaptic Edges */}
        {graph.edges.map((e) => (
          <line
            key={e.id}
            x1={e.x1}
            y1={e.y1}
            x2={e.x2}
            y2={e.y2}
            stroke={edgeColor}
            strokeWidth={1}
            strokeOpacity={0.7}
            strokeDasharray="2 2"
          />
        ))}

        {/* 2. Active Neural Transmission Route (Highlighted) */}
        {(() => {
          const routeNodes = graph.activeRoute.map((id) => graph.nodes.find((n) => n.id === id)!);
          const pts = routeNodes.map((n) => `${n.x},${n.y}`).join(' ');
          return (
            <polyline
              points={pts}
              fill="none"
              stroke={state === 'failed' ? '#FECDCA' : activeEdgeColor}
              strokeWidth={compact ? 1.2 : 1.6}
              strokeOpacity={0.8}
            />
          );
        })()}

        {/* 3. Neural Nodes */}
        {graph.nodes.map((n) => {
          const isDest = n.isDestination;
          const isOrigin = n.isOrigin;
          const stroke = isDest ? destColor : isOrigin ? (isDark ? '#38BDF8' : '#4055A8') : nodeStroke;

          return (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r={n.r}
                fill={nodeFill}
                stroke={stroke}
                strokeWidth={isDest || isOrigin ? 1.8 : 1.2}
              />
              {/* Core center dot for origin/destination */}
              {(isDest || isOrigin) && (
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={n.r * 0.45}
                  fill={stroke}
                  ref={isDest ? destNodeRef : undefined}
                />
              )}
            </g>
          );
        })}

        {/* 4. Energy Trail (Polyline following packet) */}
        {state !== 'failed' && (
          <polyline
            ref={trailRef}
            fill="none"
            stroke={particleColor}
            strokeWidth={compact ? 1.5 : 2}
            strokeOpacity={0.5}
            strokeLinecap="round"
          />
        )}

        {/* 5. Traveling Quantum Packet */}
        {state !== 'failed' && (
          <circle
            ref={particleRef}
            cx={padX}
            cy={centerY}
            r={compact ? 2.5 : 3.2}
            fill={particleColor}
            filter={`url(#glow-${messageId})`}
          />
        )}

        {/* 6. Destination Confirmation Glow Ring */}
        <circle
          ref={destRingRef}
          cx={width - padX}
          cy={centerY}
          r={compact ? 4 : 5}
          fill="none"
          stroke={destColor}
          strokeWidth={1.2}
          opacity={0}
        />
      </svg>

      {/* Accessible Status Label / Retry Icon */}
      <MessageDeliveryStatus state={state} onRetry={onRetry} showText={false} />
    </div>
  );
}

import { Check, CheckCheck, AlertCircle, RefreshCw, Clock } from 'lucide-react';
import { MessageLifecycleState } from '../../types/messageLifecycle';

interface MessageDeliveryStatusProps {
  state: MessageLifecycleState;
  onRetry?: () => void;
  className?: string;
  showText?: boolean;
}

export function MessageDeliveryStatus({
  state,
  onRetry,
  className = '',
  showText = false,
}: MessageDeliveryStatusProps) {
  switch (state) {
    case 'queued':
      return (
        <span
          role="status"
          className={`inline-flex items-center space-x-1 text-[10px] font-mono text-[#98A2B3] select-none ${className}`}
          title="Message queued for transmission"
          aria-label="Message queued"
        >
          <Clock className="w-3 h-3 text-[#98A2B3] animate-pulse" aria-hidden="true" />
          {showText && <span>Queued</span>}
        </span>
      );

    case 'sending':
    case 'retrying':
      return (
        <span
          role="status"
          className={`inline-flex items-center space-x-1 text-[10px] font-mono text-[#4055A8] select-none ${className}`}
          title={state === 'retrying' ? 'Retrying transmission...' : 'Transmitting via neural routing...'}
          aria-label={state === 'retrying' ? 'Retrying message' : 'Sending message'}
        >
          <RefreshCw className="w-3 h-3 text-[#4055A8] animate-spin" aria-hidden="true" />
          {showText && <span>{state === 'retrying' ? 'Retrying...' : 'Sending...'}</span>}
        </span>
      );

    case 'sent':
      return (
        <span
          role="status"
          className={`inline-flex items-center space-x-1 text-[10px] font-mono text-[#667085] select-none ${className}`}
          title="Server confirmed: Persisted to authoritative database"
          aria-label="Message sent and confirmed by server"
        >
          <Check className="w-3.5 h-3.5 text-[#667085]" aria-hidden="true" />
          {showText && <span>Sent</span>}
        </span>
      );

    case 'delivered':
      return (
        <span
          role="status"
          className={`inline-flex items-center space-x-1 text-[10px] font-mono text-[#16805D] select-none ${className}`}
          title="Delivered: Recipient client acknowledged receipt"
          aria-label="Message delivered to recipient"
        >
          <CheckCheck className="w-3.5 h-3.5 text-[#16805D]" aria-hidden="true" />
          {showText && <span className="text-[#16805D] font-semibold">Delivered</span>}
        </span>
      );

    case 'read':
      return (
        <span
          role="status"
          className={`inline-flex items-center space-x-1 text-[10px] font-mono text-[#4055A8] select-none ${className}`}
          title="Read: Recipient opened and viewed message"
          aria-label="Message read by recipient"
        >
          <CheckCheck className="w-3.5 h-3.5 text-[#4055A8] font-bold" aria-hidden="true" />
          {showText && <span className="text-[#4055A8] font-bold">Read</span>}
        </span>
      );

    case 'failed':
      return (
        <span
          role="status"
          className={`inline-flex items-center space-x-1 text-[10px] font-mono text-[#C0393A] select-none ${className}`}
          title="Transmission failed. Click to retry."
          aria-label="Message failed to send"
        >
          <AlertCircle className="w-3.5 h-3.5 text-[#C0393A]" aria-hidden="true" />
          {showText && <span className="font-semibold">Failed</span>}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="ml-1 text-[10px] underline font-bold hover:text-[#A82E2F] focus:outline-none cursor-pointer"
              aria-label="Retry sending message"
            >
              Retry
            </button>
          )}
        </span>
      );

    default:
      return null;
  }
}

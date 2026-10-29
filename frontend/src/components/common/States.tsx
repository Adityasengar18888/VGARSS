import React from 'react';
import { Loader2, AlertCircle, Inbox, RefreshCw } from 'lucide-react';

export function LoadingState({ message = 'Synchronizing real-time telemetry...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none font-mono">
      <Loader2 className="w-8 h-8 text-[#E8E8E8] animate-spin mb-3" />
      <p className="text-xs text-[#F2F2F2] font-semibold tracking-technical uppercase">{message}</p>
      <div className="mt-4 w-48 h-1 bg-[#222222] rounded-full overflow-hidden">
        <div className="w-1/2 h-full bg-[#E8E8E8] rounded-full animate-pulse" />
      </div>
    </div>
  );
}

export function EmptyState({
  title = 'No Data Available',
  description = 'There are no active records in this telemetry stream.',
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[#292929] rounded-[4px] bg-[#111111] select-none font-mono">
      <div className="w-12 h-12 rounded-[4px] bg-[#171717] border border-[#292929] flex items-center justify-center text-[#A1A1A1] mb-3">
        {icon || <Inbox className="w-6 h-6 text-[#707070]" />}
      </div>
      <h4 className="text-xs font-bold uppercase tracking-technical text-[#F2F2F2]">{title}</h4>
      <p className="text-xs text-[#A1A1A1] max-w-[65ch] mt-1 mb-4 font-sans">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  message = 'An unexpected network error occurred.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const isColdStart = message.toLowerCase().includes('fetch') || message.toLowerCase().includes('sleep');

  return (
    <div className="flex flex-col items-center justify-center py-8 px-5 text-center border border-[#441C1C] rounded-[4px] bg-[#141010] text-[#EF4444] select-none font-mono max-w-md mx-auto shadow-lg">
      <AlertCircle className="w-8 h-8 text-[#EF4444] mb-3" />
      <h4 className="text-xs font-bold uppercase tracking-technical text-[#F87171]">
        {isColdStart ? 'Connection Suspended / Cold Start' : 'Operation Failed'}
      </h4>
      <p className="text-xs text-[#D1D5DB] max-w-[55ch] mt-1.5 mb-4 font-sans leading-relaxed">
        {isColdStart
          ? 'The cloud server may be spinning up from idle state. Please wait a few seconds and retry.'
          : message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center space-x-1.5 px-4 py-2 bg-[#E8E8E8] hover:bg-white text-[#080808] rounded-[3px] text-xs font-mono font-bold uppercase tracking-wider transition active:scale-95 shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Connection</span>
        </button>
      )}
    </div>
  );
}

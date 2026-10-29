import React from 'react';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';

export function LoadingState({ message = 'Loading collaboration data...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center select-none">
      <Loader2 className="w-8 h-8 text-[#4055A8] animate-spin mb-3" />
      <p className="text-sm text-[#202631] font-semibold">{message}</p>
      <div className="mt-4 w-48 h-1.5 bg-[#E4E7EC] rounded-full overflow-hidden">
        <div className="w-1/2 h-full bg-[#4055A8] rounded-full animate-pulse" />
      </div>
    </div>
  );
}

export function EmptyState({
  title = 'No Data Available',
  description = 'There are no active records in this view.',
  action,
  icon,
}: {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-[#D0D5DD] rounded-xl bg-white select-none">
      <div className="w-12 h-12 rounded-xl bg-[#F8FAFC] border border-[#E4E7EC] flex items-center justify-center text-[#667085] mb-3">
        {icon || <Inbox className="w-6 h-6 text-[#98A2B3]" />}
      </div>
      <h4 className="text-sm font-bold text-[#202631]">{title}</h4>
      <p className="text-xs text-[#667085] max-w-[65ch] mt-1 mb-4">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({
  message = 'An unexpected error occurred.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-[#FECDCA] rounded-xl bg-[#FEF3F2] text-[#B42318] select-none">
      <AlertCircle className="w-8 h-8 text-[#B42318] mb-2" />
      <h4 className="text-sm font-bold text-[#912018]">Operation Failed</h4>
      <p className="text-xs text-[#B42318] max-w-[65ch] mt-1 mb-4 font-mono">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="min-h-[44px] min-w-[44px] px-4 py-2 bg-white hover:bg-[#FEE4E2] text-[#B42318] rounded-lg text-xs font-bold border border-[#FECDCA] active:scale-[0.97] transition shadow-2xs"
        >
          Try Again
        </button>
      )}
    </div>
  );
}

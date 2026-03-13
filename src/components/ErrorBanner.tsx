"use client";

import { useEffect } from "react";

interface ErrorBannerProps {
  message: string | null;
  onDismiss: () => void;
}

export default function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, 10000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="bg-red-900/80 border-b border-red-800 px-4 py-3 flex items-center justify-between">
      <p className="text-red-200 text-sm">{message}</p>
      <button
        onClick={onDismiss}
        className="text-red-300 hover:text-white text-sm ml-4 shrink-0"
      >
        Dismiss
      </button>
    </div>
  );
}

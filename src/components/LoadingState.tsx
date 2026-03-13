"use client";

interface LoadingStateProps {
  isLoading: boolean;
}

export default function LoadingState({ isLoading }: LoadingStateProps) {
  if (!isLoading) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm z-30 transition-opacity duration-200">
      <div className="text-center">
        <svg
          className="animate-spin mx-auto mb-4"
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
        >
          <circle cx="24" cy="24" r="20" stroke="#3b82f6" strokeOpacity="0.3" strokeWidth="4" />
          <path
            d="M44 24c0-11.046-8.954-20-20-20"
            stroke="#3b82f6"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-gray-400 text-sm">Analyzing Starknet graph...</p>
      </div>
    </div>
  );
}

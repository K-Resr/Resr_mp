import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false, message: ''};
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {hasError: true, message: error.message || '예기치 않은 오류가 발생했습니다.'};
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050914] text-[#EEF4FF] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-2xl bg-[#0B1324] border border-sky-200/12 p-6 space-y-4">
            <h1 className="text-lg font-semibold">앱을 불러오는 중 문제가 발생했습니다</h1>
            <p className="text-xs text-[#8CA1C4] break-words leading-relaxed">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-[44px] rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-sm font-medium text-white transition-colors cursor-pointer"
            >
              새로고침
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

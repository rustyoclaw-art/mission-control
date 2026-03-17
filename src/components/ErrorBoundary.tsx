'use client';

import { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  onRetry?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorTime: Date | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorTime: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorTime: new Date() };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorTime: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || 'Something went wrong';
      return (
        <div className="flex flex-col items-center justify-center p-6 bg-mc-bg-secondary border border-mc-accent-red/30 rounded-lg">
          <AlertCircle className="w-8 h-8 text-mc-accent-red mb-3" />
          <h3 className="text-sm font-medium text-mc-accent-red mb-1">{title}</h3>
          {this.state.errorTime && (
            <p className="text-xs text-mc-text-secondary mb-3">
              Last attempt: {this.state.errorTime.toLocaleTimeString()}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-mc-border hover:border-mc-accent/40 text-mc-text-secondary hover:text-mc-text transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Functional wrapper for async data loading errors
interface AsyncErrorBoundaryProps {
  error: string | null;
  title?: string;
  onRetry?: () => void;
  children: ReactNode;
  lastSuccessTime?: Date | null;
}

export function AsyncErrorBoundary({
  error,
  title = 'Unable to load',
  onRetry,
  children,
  lastSuccessTime,
}: AsyncErrorBoundaryProps) {
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-mc-bg-secondary border border-mc-accent-red/30 rounded-lg">
        <AlertCircle className="w-8 h-8 text-mc-accent-red mb-3" />
        <h3 className="text-sm font-medium text-mc-accent-red mb-1">{title}</h3>
        <p className="text-xs text-mc-text-secondary mb-2">{error}</p>
        {lastSuccessTime && (
          <p className="text-xs text-mc-text-secondary/60 mb-3">
            Last successful load: {lastSuccessTime.toLocaleTimeString()}
          </p>
        )}
        {onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-3 py-1.5 text-xs rounded border border-mc-border hover:border-mc-accent/40 text-mc-text-secondary hover:text-mc-text transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Retry
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

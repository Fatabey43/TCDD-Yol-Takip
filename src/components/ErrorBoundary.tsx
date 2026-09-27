import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary yakaladı:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 bg-slate-900 border border-red-800/80 rounded-2xl text-white shadow-xl flex flex-col items-center justify-center text-center max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-red-950/80 border border-red-700 flex items-center justify-center text-red-400 mb-3">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-red-200 mb-1">
            {this.props.fallbackTitle || 'Görünüm Yüklenirken Bir Sorun Oluştu'}
          </h3>
          <p className="text-xs text-slate-400 mb-4 max-w-sm">
            Nokta verileri güvenli şekilde korunuyor. Görünümü sıfırlamak için aşağıdaki butona tıklayın.
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition-all active:scale-[0.98] cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Görünümü Yenile</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

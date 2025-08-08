import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg m-6">
          <h1 className="text-xl font-bold text-red-800">Something went wrong.</h1>
          <p className="mt-2 text-red-700">
            We're sorry, but an unexpected error occurred. Please try refreshing the page.
          </p>
          {this.state.error && (
            <pre className="mt-4 p-2 bg-red-100 text-red-900 text-xs rounded overflow-auto">
              {this.state.error.toString()}
              <br />
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

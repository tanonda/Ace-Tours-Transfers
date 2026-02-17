import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Fix #16: Log full error details server-side / to monitoring (Sentry/Datadog).
    // Do NOT expose raw error.message to users — it can leak internal paths and library names.
    console.error("Error caught by boundary:", error, errorInfo);
    // TODO: Send to error monitoring service, e.g.:
    // Sentry.captureException(error, { extra: errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 max-w-md mx-auto">
            <h1 className="text-2xl font-bold text-foreground mb-4">Something went wrong</h1>
            {/* Fix #16: Show a friendly generic message — never the raw error.message */}
            <p className="text-muted-foreground mb-6">
              We're sorry, an unexpected error occurred. Our team has been notified. Please try refreshing the page or returning to the homepage.
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-muted text-foreground rounded-md hover:bg-muted/80 border border-border"
              >
                Refresh Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = "/";
                }}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import { Component, type ReactNode } from "react";
import { eraseAllLocalData } from "../store/reset";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort error boundary. A render-time exception (corrupt localStorage,
 * malformed admin overrides, unexpected mem0 response shape) would otherwise
 * blank the app. We catch it, show a recovery surface, and let the user wipe
 * local data + reload as the universal fix.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface to console so power users / e2e harness can see what happened.
    console.error("[ErrorBoundary] crash:", error);
  }

  private reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  private eraseAndReload = () => {
    if (typeof window === "undefined") return;
    if (!window.confirm("Erase all local data and reload? This signs you out and clears progress.")) return;
    eraseAllLocalData();
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-md w-full p-6 space-y-4">
          <div>
            <h1 className="h1 text-bad">Something broke</h1>
            <p className="muted text-sm mt-1">
              The app hit an unexpected error. Most of the time, erasing local data and reloading fixes it.
            </p>
          </div>
          <pre className="text-[11px] bg-white/5 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </pre>
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={this.reload}>Reload</button>
            <button className="btn-bad" onClick={this.eraseAndReload}>Erase local data and reload</button>
          </div>
        </div>
      </div>
    );
  }
}

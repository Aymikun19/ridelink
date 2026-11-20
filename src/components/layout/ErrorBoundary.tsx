import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

interface State {
  error: Error | null;
}

/** Catches rendering errors so users see a way out instead of a blank page. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ui] crashed", error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    // A new deployment can remove old code chunks; a reload fetches the new ones.
    const stale = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(this.state.error.message);
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="font-display text-2xl font-bold">{stale ? "A new version is available" : "Something went wrong"}</p>
        <p className="max-w-sm text-muted">
          {stale ? "Reload to get the latest version of RideLink." : "Reload the page to try again. If it keeps happening, sign out and back in."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-6 text-sm font-semibold text-bg hover:opacity-90"
        >
          <RefreshCw className="h-4 w-4" /> Reload
        </button>
      </div>
    );
  }
}

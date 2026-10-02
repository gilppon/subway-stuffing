import { Component, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  gameName: string;
  accent: string;
  saveKeys: string[];
  onCrash?: () => void;
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Root crash guard: a render error anywhere below shows a fallback screen
 * instead of a blank page. Plain reload covers transient crashes;
 * "erase save & reload" covers corrupted-save crashes.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error) {
    try {
      this.props.onCrash?.();
    } catch {
      /* crash handling must never crash */
    }
    try {
      console.error(`[${this.props.gameName}] crashed:`, error.message);
    } catch {
      /* ignore */
    }
  }

  private reload = () => {
    window.location.reload();
  };

  private eraseAndReload = () => {
    for (const key of this.props.saveKeys) {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* storage may be blocked – ignore */
      }
    }
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    const { gameName, accent } = this.props;
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99999,
          display: 'grid',
          placeItems: 'center',
          padding: 20,
          background: '#0b0d12',
          color: '#f4f4f5',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            background: '#14161c',
            border: '1px solid #2a2e38',
            borderRadius: 16,
            padding: '28px 24px',
          }}
        >
          <div style={{ fontSize: 40, lineHeight: 1 }}>⚠️</div>
          <h1 style={{ margin: '12px 0 4px', fontSize: 22 }}>{gameName} crashed</h1>
          <p style={{ margin: '0 0 20px', fontSize: 14, color: '#a1a1aa', lineHeight: 1.5 }}>
            Something unexpected broke the game. Reloading usually fixes it — your progress is kept
            unless you erase the save below.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={this.reload}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: 'none',
                background: accent,
                color: '#0b0d12',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⟳ Reload game
            </button>
            <button
              type="button"
              onClick={this.eraseAndReload}
              style={{
                padding: '12px 16px',
                borderRadius: 10,
                border: '1px solid #52525b',
                background: 'transparent',
                color: '#d4d4d8',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Erase save &amp; reload
            </button>
          </div>
          <details style={{ marginTop: 16, fontSize: 12, color: '#71717a', textAlign: 'left' }}>
            <summary style={{ cursor: 'pointer' }}>Error detail</summary>
            <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {this.state.error.message}
            </pre>
          </details>
        </div>
      </div>
    );
  }
}

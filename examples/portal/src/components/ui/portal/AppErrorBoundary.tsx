"use client";
import React from "react";

/**
 * Keeps an error inside one Marketplace app frame: the app shows what went wrong with "Try again"
 * (renders it anew) and "Reload", instead of Next's global error page taking the whole frame.
 */
export class AppErrorBoundary extends React.Component<{ name: string; children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[${this.props.name}]`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" style={{ font: "14px/1.5 system-ui, sans-serif", padding: 24, color: "#1b2328", maxWidth: 640 }}>
        <p style={{ margin: "0 0 6px", fontWeight: 600 }}>{this.props.name} ran into a problem.</p>
        <p style={{ margin: "0 0 14px", color: "#5c6b74", overflowWrap: "anywhere" }}>{this.state.error.message || String(this.state.error)}</p>
        <button type="button" onClick={() => this.setState({ error: null })} style={{ font: "inherit", padding: "6px 14px", marginInlineEnd: 8, borderRadius: 8, border: "1px solid #5548d9", background: "#5548d9", color: "#fff", cursor: "pointer" }}>Try again</button>
        <button type="button" onClick={() => window.location.reload()} style={{ font: "inherit", padding: "6px 14px", borderRadius: 8, border: "1px solid #e3e7ea", background: "#fff", cursor: "pointer" }}>Reload</button>
      </div>
    );
  }
}

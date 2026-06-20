"use client";

import { Component, type ReactNode } from "react";

/**
 * [30] レンダリング時の例外で白画面になるのを防ぐエラーバウンダリ。
 * 各タブを包み、タブ単位でフォールバック表示する。
 */
interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
          <p className="font-semibold">
            ⚠️ 表示エラー{this.props.label ? `（${this.props.label}）` : ""}
          </p>
          <p className="mt-1 text-red-200/90">
            このタブの描画に失敗しました。データ形式が想定外の可能性があります。
          </p>
          <p className="mt-1 text-xs text-red-400/70">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-3 rounded-md border border-red-500/40 px-3 py-1 text-xs text-red-200 hover:bg-red-500/10"
          >
            再試行
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

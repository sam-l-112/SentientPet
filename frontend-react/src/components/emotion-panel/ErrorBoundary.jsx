// ErrorBoundary — 分頁內容出錯時只顯示提示，不影響另一個分頁和聊天畫面。

import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error(`[EmotionPanel] 「${this.props.label}」分頁發生錯誤:`, error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="ep-error" role="alert">
          「{this.props.label}」分頁發生錯誤，請重新整理頁面。
        </div>
      );
    }
    return this.props.children;
  }
}

import { useState } from 'react';
import type { CaptureRequest } from '../types/capture';

interface CaptureConfirmProps {
  imageData: string;
  onSubmit: (request: CaptureRequest) => void;
  onCancel: () => void;
  onRecapture: () => void;
}

function CaptureConfirm({ imageData, onSubmit, onCancel, onRecapture }: CaptureConfirmProps) {
  const [question, setQuestion] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    const request: CaptureRequest = {
      imageData,
      textQuestion: question.trim() || undefined,
      timestamp: new Date().toISOString(),
    };
    onSubmit(request);
    setSubmitted(true);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  if (submitted) {
    return (
      <div className="confirm-card">
        <div className="confirm-success">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="2" />
            <path d="M8 12L11 15L16 9" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>截图已提交，等待 AI 老师回答…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="confirm-card">
      <div className="confirm-preview">
        <img
          className="confirm-thumb"
          src={`data:image/png;base64,${imageData}`}
          alt="截图预览"
        />
      </div>

      <textarea
        className="confirm-input"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入你的问题（可选）"
        rows={2}
      />

      <div className="confirm-actions">
        <button className="confirm-btn confirm-btn-secondary" onClick={onCancel}>
          取消
        </button>
        <button className="confirm-btn confirm-btn-secondary" onClick={onRecapture}>
          重截
        </button>
        <button className="confirm-btn confirm-btn-primary" onClick={handleSubmit}>
          提交
        </button>
      </div>
    </div>
  );
}

export default CaptureConfirm;

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

  function handleSubmit() {
    const request: CaptureRequest = {
      imageData,
      textQuestion: question.trim() || undefined,
      timestamp: new Date().toISOString(),
    };
    onSubmit(request);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
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

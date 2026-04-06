import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import SidebarApp from './components/SidebarApp';
import CaptureOverlay from './components/CaptureOverlay';
import './App.css';

const label = getCurrentWebviewWindow().label;

function App() {
  if (label === 'capture-overlay') {
    return <CaptureOverlay />;
  }
  return <SidebarApp />;
}

export default App;

import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import SidebarApp from './components/SidebarApp';
import './App.css';

function App() {
  const [windowLabel, setWindowLabel] = useState<string>('');

  useEffect(() => {
    setWindowLabel(getCurrentWebviewWindow().label);
  }, []);

  if (windowLabel === 'sidebar') {
    return <SidebarApp />;
  }

  return null;
}

export default App;

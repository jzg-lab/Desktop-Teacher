import { useEffect, useState } from 'react';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import SidebarApp from './components/SidebarApp';
import './App.css';

function App() {
  return <SidebarApp />;
}

export default App;

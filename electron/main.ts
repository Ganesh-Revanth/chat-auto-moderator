import { app, BrowserWindow, shell } from 'electron';
import path from 'path';
import { startServer } from '../server.ts';

process.env.MODSTUDIO_EMBEDDED = '1';
process.env.NODE_ENV = 'production';

let mainWindow: BrowserWindow | null = null;

async function createDesktopWindow(): Promise<void> {
  // Store .discord_session.json next to the portable .exe or in OS userData
  const portableDir = process.env.PORTABLE_EXECUTABLE_DIR || app.getPath('userData');
  process.env.MODSTUDIO_SESSION_PATH = path.join(portableDir, '.discord_session.json');
  process.env.MODSTUDIO_DIST_PATH = path.join(__dirname, '..', 'dist');

  let boundPort = 3000;
  try {
    boundPort = await startServer(3000);
  } catch {
    boundPort = await startServer(0);
  }

  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#000000',
    title: 'Moderation Studio',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  await mainWindow.loadURL(`http://127.0.0.1:${boundPort}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(createDesktopWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

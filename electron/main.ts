import { app, BrowserWindow, shell } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverProcess: ChildProcess | null = null;
const PORT = 3000;

function waitForServer(url: string, timeoutMs = 15000): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const check = () => {
      http
        .get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) {
            resolve();
          } else {
            retry();
          }
        })
        .on('error', retry);
    };

    const retry = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error('Timed out waiting for local Moderation Studio server'));
      } else {
        setTimeout(check, 250);
      }
    };

    check();
  });
}

async function startLocalBackend(): Promise<void> {
  const serverScript = path.join(__dirname, '..', 'server.ts');
  serverProcess = spawn('npx', ['tsx', serverScript], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    shell: true,
    stdio: 'ignore',
  });
  await waitForServer(`http://127.0.0.1:${PORT}/api/v1/punishments`);
}

async function createDesktopWindow(): Promise<void> {
  await startLocalBackend();

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

  await mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

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
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
});

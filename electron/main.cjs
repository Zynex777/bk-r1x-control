// Processo principal da versão desktop (Electron).
// Responsável por: janela, permissões WebHID, bandeja, atalhos globais e
// identidade dinâmica (nome + ícone nos atalhos do Windows).

const { app, BrowserWindow, Tray, Menu, dialog, globalShortcut, ipcMain, nativeImage, session, shell } = require('electron');
const { execFile } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const APP_ID = 'io.github.bkr1x.control';
const PRODUCT_NAME = 'BK-R1X Control';
const REG_KEY = `HKCU\\Software\\${PRODUCT_NAME}`;
const VENDOR_IDS = new Set([0xa8a4, 0xa8a5]);
const PRODUCT_ID = 0x2255;
const START_HIDDEN = process.argv.includes('--hidden');

let win = null;
let tray = null;
let quitting = false;
let trayHintShown = false;
let identity = { name: 'BK-R1X', iconPath: null };

// Testes: pasta de dados separada e sem acesso ao mouse, para não interferir no app instalado.
if (process.env.BKR1X_USER_DATA) app.setPath('userData', process.env.BKR1X_USER_DATA);
const HID_DISABLED = !!process.env.BKR1X_NO_HID;

// -------------------------------------------------------------------------
// Instância única: abrir de novo só traz a janela existente para frente.
// -------------------------------------------------------------------------

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.setAppUserModelId(APP_ID);
  app.whenReady().then(start);
}

app.on('before-quit', () => {
  quitting = true;
});
app.on('will-quit', () => globalShortcut.unregisterAll());
// Com a bandeja, fechar todas as janelas não encerra o app.
app.on('window-all-closed', () => {});

// -------------------------------------------------------------------------

function userFile(name) {
  return path.join(app.getPath('userData'), name);
}

function loadIdentity() {
  try {
    const saved = JSON.parse(fs.readFileSync(userFile('identity.json'), 'utf8'));
    if (saved && typeof saved.name === 'string') identity = { ...identity, ...saved };
  } catch {
    // Primeira execução.
  }
}

function saveIdentity() {
  fs.writeFileSync(userFile('identity.json'), JSON.stringify(identity));
}

function currentIcon() {
  if (identity.iconPath && fs.existsSync(identity.iconPath)) return nativeImage.createFromPath(identity.iconPath);
  return nativeImage.createFromPath(path.join(__dirname, 'icon.png'));
}

function start() {
  loadIdentity();
  setupHid();
  createWindow();
  createTray();
  registerIpc();
  setInterval(() => void pollProcesses(), PROCESS_POLL_MS);
  if (app.isPackaged) syncShortcuts().catch((err) => console.error('atalhos do Windows:', err));
}

// -------------------------------------------------------------------------
// WebHID: o Electron não tem o seletor do navegador, então escolhemos aqui.
// -------------------------------------------------------------------------

function isOurDevice(d) {
  return !HID_DISABLED && VENDOR_IDS.has(d.vendorId) && d.productId === PRODUCT_ID;
}

function setupHid() {
  const ses = session.defaultSession;
  ses.on('select-hid-device', (event, details, callback) => {
    event.preventDefault();
    const device = details.deviceList.find(isOurDevice);
    callback(device ? device.deviceId : '');
  });
  ses.setPermissionCheckHandler((_wc, permission) => permission === 'hid');
  ses.setDevicePermissionHandler((details) => details.deviceType === 'hid' && isOurDevice(details.device));
}

// -------------------------------------------------------------------------
// Janela e bandeja
// -------------------------------------------------------------------------

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#07050b',
    autoHideMenuBar: true,
    title: identity.name,
    icon: currentIcon(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // Os atalhos e a bateria precisam continuar rodando com a janela escondida.
      backgroundThrottling: false,
    },
  });
  win.removeMenu();

  if (process.env.ELECTRON_START_URL) win.loadURL(process.env.ELECTRON_START_URL);
  else win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));

  win.once('ready-to-show', () => {
    if (!START_HIDDEN) win.show();
  });

  // Links externos abrem no navegador, nunca dentro do app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  win.on('close', (event) => {
    if (quitting) return;
    event.preventDefault();
    win.hide();
    if (!trayHintShown && tray) {
      trayHintShown = true;
      tray.displayBalloon({
        title: identity.name,
        content: 'Continua rodando aqui na bandeja para os atalhos funcionarem. Clique com o botão direito para sair.',
        iconType: 'info',
      });
    }
  });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

function createTray() {
  tray = new Tray(currentIcon().resize({ width: 16, height: 16 }));
  tray.on('click', showWindow);
  updateTray();
}

function updateTray() {
  if (!tray) return;
  tray.setToolTip(identity.name);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Abrir ${identity.name}`, click: showWindow },
      { type: 'separator' },
      {
        label: 'Sair',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

// -------------------------------------------------------------------------
// IPC com a interface
// -------------------------------------------------------------------------

const hotkeyIds = new Map(); // accelerator -> id
let hotkeysSuspended = false;
let desiredHotkeys = [];

function applyHotkeys() {
  globalShortcut.unregisterAll();
  hotkeyIds.clear();
  const results = [];
  for (const { id, accelerator } of desiredHotkeys) {
    if (hotkeysSuspended) {
      results.push({ id, ok: true });
      continue;
    }
    let ok = false;
    try {
      ok = !hotkeyIds.has(accelerator) && globalShortcut.register(accelerator, () => win && win.webContents.send('hotkey', id));
    } catch {
      ok = false;
    }
    if (ok) hotkeyIds.set(accelerator, id);
    results.push({ id, ok });
  }
  return results;
}

let identityTimer = null;

function registerIpc() {
  ipcMain.handle('hotkeys:set', (_e, list) => {
    desiredHotkeys = Array.isArray(list)
      ? list.filter((h) => h && typeof h.id === 'string' && typeof h.accelerator === 'string')
      : [];
    return applyHotkeys();
  });

  ipcMain.handle('hotkeys:suspend', (_e, suspended) => {
    hotkeysSuspended = !!suspended;
    applyHotkeys();
  });

  ipcMain.handle('identity:set', async (_e, payload) => {
    const name = sanitizeName(payload && payload.name) || 'BK-R1X';
    const png = payload && typeof payload.png === 'string' ? payload.png : null;
    const image = png ? nativeImage.createFromDataURL(png) : null;

    if (image && !image.isEmpty()) {
      win.setIcon(image);
      tray.setImage(image.resize({ width: 16, height: 16, quality: 'best' }));
    }
    identity.name = name;
    updateTray();

    // Arquivos e atalhos do Windows: espera a pessoa parar de digitar.
    clearTimeout(identityTimer);
    identityTimer = setTimeout(() => {
      try {
        if (image && !image.isEmpty()) identity.iconPath = writeIcon(image);
        saveIdentity();
        if (app.isPackaged) syncShortcuts().catch((err) => console.error('atalhos do Windows:', err));
      } catch (err) {
        console.error('identidade:', err);
      }
    }, 1200);
  });

  ipcMain.handle('processes:watch', (_e, names) => {
    watchedProcesses = new Set(
      (Array.isArray(names) ? names : []).filter((n) => typeof n === 'string').map((n) => n.toLowerCase()),
    );
    lastRunningKey = null; // força avisar a interface na próxima leitura
    pollProcesses();
  });

  ipcMain.handle('processes:list', async () => {
    const names = await runningProcesses();
    return [...names].filter((n) => !SYSTEM_PROCESSES.has(n)).sort();
  });

  ipcMain.handle('processes:pick', async () => {
    const result = await dialog.showOpenDialog(win, {
      title: 'Escolha o programa ou jogo',
      filters: [{ name: 'Programas', extensions: ['exe'] }],
      properties: ['openFile'],
    });
    return result.canceled || !result.filePaths[0] ? null : path.basename(result.filePaths[0]).toLowerCase();
  });

  ipcMain.handle('autostart:get', () => app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin);
  ipcMain.handle('autostart:set', (_e, enabled) => {
    app.setLoginItemSettings({ openAtLogin: !!enabled, args: ['--hidden'] });
    return app.getLoginItemSettings({ args: ['--hidden'] }).openAtLogin;
  });
}

// -------------------------------------------------------------------------
// Perfis por programa: avisa a interface quando programas vigiados abrem/fecham
// -------------------------------------------------------------------------

const PROCESS_POLL_MS = 2500;
// Processos do Windows que não fazem sentido na lista "programas abertos".
const SYSTEM_PROCESSES = new Set([
  'system', 'system idle process', 'registry', 'smss.exe', 'csrss.exe', 'wininit.exe', 'services.exe', 'lsass.exe',
  'svchost.exe', 'winlogon.exe', 'fontdrvhost.exe', 'dwm.exe', 'conhost.exe', 'sihost.exe', 'taskhostw.exe',
  'runtimebroker.exe', 'dllhost.exe', 'ctfmon.exe', 'searchhost.exe', 'startmenuexperiencehost.exe',
  'shellexperiencehost.exe', 'textinputhost.exe', 'smartscreen.exe', 'securityhealthservice.exe', 'spoolsv.exe',
  'wmiprvse.exe', 'audiodg.exe', 'memory compression', 'msmpeng.exe', 'nissrv.exe', 'tasklist.exe', 'secure system',
  'lsaiso.exe', 'wudfhost.exe', 'searchindexer.exe', 'sgrmbroker.exe', 'unsecapp.exe', 'wlanext.exe',
]);

let watchedProcesses = new Set();
let lastRunningKey = null;

function runningProcesses() {
  return new Promise((resolve) => {
    execFile('tasklist', ['/fo', 'csv', '/nh'], { windowsHide: true, maxBuffer: 16 * 1024 * 1024 }, (err, out) => {
      const names = new Set();
      if (!err) {
        for (const line of out.split(/\r?\n/)) {
          const m = /^"([^"]+)"/.exec(line);
          if (m) names.add(m[1].toLowerCase());
        }
      }
      resolve(names);
    });
  });
}

let polling = false;
async function pollProcesses() {
  if (polling || watchedProcesses.size === 0 || !win) return;
  polling = true;
  try {
    const names = await runningProcesses();
    const running = [...watchedProcesses].filter((n) => names.has(n)).sort();
    const key = running.join('|');
    if (key !== lastRunningKey) {
      lastRunningKey = key;
      win.webContents.send('processes', running);
    }
  } finally {
    polling = false;
  }
}


// -------------------------------------------------------------------------
// Ícone .ico (PNG embutido, aceito pelo Windows Vista em diante)
// -------------------------------------------------------------------------

const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

/** Quadro BMP 32 bits (BGRA, de baixo para cima) + máscara AND vazia, formato clássico de .ico. */
function dibFrame(image, size) {
  const bgra = image.resize({ width: size, height: size, quality: 'best' }).toBitmap();
  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0);
  header.writeInt32LE(size, 4);
  header.writeInt32LE(size * 2, 8); // altura dobrada: cor + máscara
  header.writeUInt16LE(1, 12);
  header.writeUInt16LE(32, 14);
  header.writeUInt32LE(size * size * 4, 20);
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) bgra.copy(pixels, (size - 1 - y) * size * 4, y * size * 4, (y + 1) * size * 4);
  const maskRow = Math.ceil(size / 32) * 4;
  return Buffer.concat([header, pixels, Buffer.alloc(maskRow * size)]);
}

function writeIcon(image) {
  // PNG só no 256 (padrão do Windows); os menores em BMP, que todo leitor de .ico entende.
  const pngs = ICO_SIZES.map((size) =>
    size >= 256 ? image.resize({ width: size, height: size, quality: 'best' }).toPNG() : dibFrame(image, size),
  );
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  pngs.forEach((png, i) => {
    const size = ICO_SIZES[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(entry);
  });
  const ico = Buffer.concat([header, ...entries, ...pngs]);

  // Nome novo a cada mudança: o Windows guarda ícones em cache pelo caminho.
  const dir = userFile('icons');
  fs.mkdirSync(dir, { recursive: true });
  const hash = crypto.createHash('sha1').update(ico).digest('hex').slice(0, 10);
  const file = path.join(dir, `icon-${hash}.ico`);
  if (!fs.existsSync(file)) fs.writeFileSync(file, ico);
  // Também em PNG, para a janela e a bandeja na próxima abertura.
  const pngFile = path.join(dir, `icon-${hash}.png`);
  if (!fs.existsSync(pngFile)) fs.writeFileSync(pngFile, pngs[pngs.length - 1]);
  for (const old of fs.readdirSync(dir)) {
    if (!old.includes(hash)) fs.rmSync(path.join(dir, old), { force: true });
  }
  return pngFile;
}

// -------------------------------------------------------------------------
// Atalhos do Windows (.lnk): renomeia e troca o ícone dos que apontam para este .exe
// -------------------------------------------------------------------------

function sanitizeName(name) {
  return typeof name === 'string' ? name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '').trim().slice(0, 40) : '';
}

function shortcutDirs() {
  // Testes: pastas falsas no lugar de Área de Trabalho / Menu Iniciar / barra de tarefas.
  if (process.env.BKR1X_SHORTCUT_DIRS) return JSON.parse(process.env.BKR1X_SHORTCUT_DIRS);
  const appData = app.getPath('appData');
  return [
    { dir: app.getPath('desktop'), rename: true },
    { dir: path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'), rename: true },
    // Fixado na barra de tarefas: só troca o ícone; renomear desfaz a fixação.
    { dir: path.join(appData, 'Microsoft', 'Internet Explorer', 'Quick Launch', 'User Pinned', 'TaskBar'), rename: false },
  ];
}

function ourShortcuts(dir) {
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.toLowerCase().endsWith('.lnk'));
  } catch {
    return [];
  }
  const exe = process.execPath.toLowerCase();
  return files
    .map((f) => path.join(dir, f))
    .filter((file) => {
      try {
        return path.resolve(shell.readShortcutLink(file).target).toLowerCase() === exe;
      } catch {
        return false;
      }
    });
}

async function syncShortcuts() {
  const icoPath = identity.iconPath ? identity.iconPath.replace(/\.png$/, '.ico') : null;
  const name = sanitizeName(identity.name) || 'BK-R1X';
  let renamed = false;

  for (const { dir, rename } of shortcutDirs()) {
    const links = ourShortcuts(dir);
    if (links.length === 0) continue; // a pessoa apagou o atalho: respeita.

    let [keep, ...extras] = links;
    // Uma atualização do instalador recria o atalho com o nome original: remove duplicatas.
    if (rename) {
      for (const extra of extras) fs.rmSync(extra, { force: true });
      extras = [];
      const target = path.join(dir, `${name}.lnk`);
      if (keep.toLowerCase() !== target.toLowerCase() && !fs.existsSync(target)) {
        fs.renameSync(keep, target);
        keep = target;
        renamed = true;
      }
    }
    for (const link of [keep, ...extras]) {
      if (icoPath && fs.existsSync(icoPath)) {
        shell.writeShortcutLink(link, 'update', { icon: icoPath, iconIndex: 0 });
      } else {
        shell.writeShortcutLink(link, 'update', { icon: process.execPath, iconIndex: 0 });
      }
    }
  }

  // O desinstalador lê este valor para apagar atalhos renomeados.
  if ((renamed || name !== PRODUCT_NAME) && !process.env.BKR1X_SHORTCUT_DIRS) {
    await new Promise((resolve) =>
      execFile('reg', ['add', REG_KEY, '/v', 'ShortcutName', '/t', 'REG_SZ', '/d', name, '/f'], { windowsHide: true }, () => resolve()),
    );
  }
}

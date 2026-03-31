const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');

// Uygulama hazır olunca çalışır
app.whenReady().then(() => {
    // Supabase CORS izni — file:// protokolünden HTTPS isteklerine izin ver
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['Origin'] = 'https://filo-erp.app';
        callback({ requestHeaders: details.requestHeaders });
    });

    const win = new BrowserWindow({
        width: 1440,
        height: 900,
        minWidth: 1024,
        minHeight: 600,
        title: 'IDEOL — Filo Yönetim Merkezi',
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: false,          // file:// → HTTPS fetch izni
            allowRunningInsecureContent: false
        },
        frame: true,
        show: false,
        backgroundColor: '#0d0f11'
    });

    // CORS için ekstra krom anahtarları
    app.commandLine.appendSwitch('disable-features', 'OutOfBlinkCors');
    app.commandLine.appendSwitch('disable-site-isolation-trials');

    // HTML dosyasını yükle
    win.loadFile('filoyonetim.html');

    // Hata ayıklama konsolunu aç - Geliştirici Modu
    win.webContents.openDevTools();

    // Pencere hazır olunca göster (beyaz flash olmadan)
    win.once('ready-to-show', () => {
        win.show();
        win.focus();
    });

    // Dış linkleri tarayıcıda aç
    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
});

// Tüm pencereler kapanınca uygulamayı sonlandır (macOS hariç)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

const { app, BrowserWindow, Menu, net, protocol, session, shell } = require('electron')
const { mkdirSync } = require('node:fs')
const { join, extname } = require('node:path')
const { pathToFileURL } = require('node:url')
const { readDesktopIdentity } = require('./identity.cjs')
const { assetPathForUrl, externalUrl, contentSecurityPolicy } = require('./routes.cjs')

const distDir = join(__dirname, '../dist')
const identity = readDesktopIdentity(distDir)
app.setName(identity.productName)
const userData = join(app.getPath('appData'), identity.storageName)
mkdirSync(userData, { recursive: true })
app.setPath('userData', userData)
app.setAppUserModelId(identity.appId)
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }])

let mainWindow
const openExternal = url => {
  const safe = externalUrl(url)
  if (safe) void shell.openExternal(safe).catch(error => console.error('Could not open link:', error.message))
}

function createWindow() {
  mainWindow = new BrowserWindow({
    title: identity.productName, width: 1440, height: 950, minWidth: 360, minHeight: 500,
    backgroundColor: '#000000', show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  })
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' } })
  mainWindow.webContents.on('will-navigate', (event, url) => { event.preventDefault(); openExternal(url) })
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault())
  mainWindow.once('ready-to-show', () => mainWindow.show())
  mainWindow.on('closed', () => { mainWindow = null })
  void mainWindow.loadURL('app://local/index.html').catch(error => { console.error(error); app.quit() })
}

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (mainWindow) { if (mainWindow.isMinimized()) mainWindow.restore(); mainWindow.show(); mainWindow.focus() } })
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    protocol.handle('app', async request => {
      const path = assetPathForUrl(request.url, distDir)
      if (!path) return new Response('Not found', { status: 404 })
      try {
        const response = await net.fetch(pathToFileURL(path).href)
        const headers = new Headers(response.headers)
        if (extname(path) === '.html') headers.set('Content-Security-Policy', contentSecurityPolicy)
        return new Response(response.body, { status: response.status, headers })
      } catch { return new Response('Not found', { status: 404 }) }
    })
    const menu = []
    if (process.platform === 'darwin') menu.push({ role: 'appMenu' })
    menu.push({ role: 'fileMenu' }, { role: 'editMenu' }, { role: 'viewMenu' }, { role: 'windowMenu' })
    Menu.setApplicationMenu(Menu.buildFromTemplate(menu))
    createWindow()
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else mainWindow?.show() })
  }).catch(error => { console.error(error); app.quit() })
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
}

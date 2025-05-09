const {app, BrowserWindow, ipcMain, dialog, Menu} = require('electron')
const path = require("node:path")
const fs = require("fs")

let mainWindow;
const initialize = () => {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 500,
        webPreferences: {
            preload: path.join(__dirname, "preload.js")
        }
    })

    mainWindow.loadFile("./index.html")
}

const isMac = process.platform === 'darwin'

const template = [
  // { role: 'appMenu' }
  ...(isMac
    ? [{
        label: app.name,
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      }]
    : []),
  // { role: 'fileMenu' }
  {
    label: 'File',
    submenu: [
      {
        label: "Select File",
        click: async () => {
            const file = await select_file()
            mainWindow.webContents.send('event-from-main-process', file)
        }
      },
      {
        label: "Delete File",
        click: () => {
            mainWindow.webContents.send('attempt-delete-file')
        }
      },
    ]
  },
  {
    label: 'Window',
    submenu: [
        { 
            role: 'minimize', 
            click: () => {
                mainWindow.minimize()
            } 
        },

        {
            role: "reload"
        },

        {
            role: "toggleDevTools"
        },
    ]
  },
  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More',
        click: async () => {
          const { shell } = require('electron')
          await shell.openExternal('https://electronjs.org')
        }
      }
    ]
  }
]

const menu = Menu.buildFromTemplate(template)
Menu.setApplicationMenu(menu)

const select_file = async () => {
    const file = await dialog.showOpenDialog(mainWindow, {
        properties: ["openFile", /** "multiSelections" */],
        filters: [{extensions: ["jpg", "png", "jpeg", "gif", "tif"]}]
    })
    if (!file.canceled) {
        return file.filePaths[0]
    }

    return null
}

const delete_file = (filename) => {
  let filePath;

  try {
    // Convert file:// URI to local path
    const fileUrl = new URL(filename);
    filePath = fileUrl.pathname;

    // On Windows, remove leading slash from /C:/...
    if (process.platform === "win32") {
      filePath = filePath.slice(1); // Remove leading slash
    }

    // Decode in case of spaces or special characters
    filePath = decodeURIComponent(filePath);

  } catch (err) {
    console.error("Invalid file URL:", filename);
    return;
  }

  fs.unlink(filePath, (err) => {
    // console.log("unlink error:", err);
    if (!err) {
      mainWindow.webContents.send("file-deleted");
    }
  });
};

app.whenReady().then(() => {
    ipcMain.handle("open-file", () => {
        return select_file()
    })

    ipcMain.on("open-contextmenu", (event, data) => {
        const template = [
            {
                label: 'Select File',
                click: async () => { 
                    const file = await select_file()
                    event.sender.send('event-from-main-process', file)
                }
            },
            { type: 'separator' },
            { 
                label: 'Delete File',
                click: () => {
                    if (data.filename == "") return;
                    // delete_file(data.filename)
                    mainWindow.webContents.send('attempt-delete-file')
                }
            }
        ]
        const menu = Menu.buildFromTemplate(template)
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender) })

    })

    ipcMain.on("delete-file", (event, data) => {
        // console.log("data", data);
        delete_file(data.filename)
    })


    initialize()

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") { //win32 | linux | darwin
            app.quit()
        }
    })

    // process.platform == "win32" // windows

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            initialize()
        }
    })
})
const { app, BrowserWindow } = require("electron");

app.setPath("userData", process.argv[2]);
app.on("window-all-closed", () => {});
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { backgroundThrottling: false } });
  await window.loadURL(process.argv[3]);
  for (let attempt = 0; attempt < 200; attempt++) {
    const output = await window.webContents.executeJavaScript("document.getElementById('fixture-result')?.outerHTML");
    if (output) { console.log(output); app.exit(0); return; }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error("Side chat fixture did not complete");
}).catch(error => { console.error(error); app.exit(1); });

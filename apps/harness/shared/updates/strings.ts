const languages = ["en", "id", "es", "ja", "zh"];
const messages = {
  title: ["App updates", "Pembaruan aplikasi", "Actualizaciones", "アプリの更新", "应用更新"],
  installed: ["Installed version", "Versi terpasang", "Versión instalada", "インストール済み", "已安装版本"],
  check: ["Check for updates", "Periksa pembaruan", "Buscar actualizaciones", "更新を確認", "检查更新"],
  checking: ["Checking for updates…", "Memeriksa pembaruan…", "Buscando actualizaciones…", "更新を確認中…", "正在检查更新…"],
  current: ["You're up to date", "Aplikasi sudah terbaru", "Estás al día", "最新の状態です", "已是最新版本"],
  available: ["Update available", "Pembaruan tersedia", "Actualización disponible", "更新があります", "有可用更新"],
  downloading: ["Downloading update…", "Mengunduh pembaruan…", "Descargando actualización…", "更新をダウンロード中…", "正在下载更新…"],
  ready: ["Ready to install", "Siap dipasang", "Lista para instalar", "インストールできます", "可以安装"],
  download: ["Download update", "Unduh pembaruan", "Descargar actualización", "更新をダウンロード", "下载更新"],
  installWindows: ["Install & restart", "Pasang & mulai ulang", "Instalar y reiniciar", "インストールして再起動", "安装并重启"],
  installAndroid: ["Install update", "Pasang pembaruan", "Instalar actualización", "更新をインストール", "安装更新"],
  installing: ["Opening installer…", "Membuka installer…", "Abriendo instalador…", "インストーラーを開いています…", "正在打开安装程序…"],
  installation: ["Couldn't open the system installer. Try again.", "Gagal membuka installer sistem. Coba lagi.", "No se pudo abrir el instalador del sistema. Inténtalo de nuevo.", "システムのインストーラーを開けませんでした。再試行してください。", "无法打开系统安装程序，请重试。"],
  releaseNotes: ["Release notes", "Catatan rilis", "Notas de la versión", "リリースノート", "发行说明"],
  notesLanguage: ["Release notes are provided in English.", "Catatan rilis disediakan dalam bahasa Inggris.", "Las notas de la versión están en inglés.", "リリースノートは英語で提供されます。", "发行说明以英语提供。"],
  noNotes: ["No release notes provided.", "Catatan rilis belum tersedia.", "No hay notas de la versión.", "リリースノートはありません。", "暂无发行说明。"],
  later: ["Later", "Nanti", "Más tarde", "後で", "稍后"],
  error: ["Couldn't check for updates. Try again.", "Gagal memeriksa pembaruan. Coba lagi.", "No se pudieron buscar actualizaciones. Inténtalo de nuevo.", "更新を確認できませんでした。再試行してください。", "无法检查更新，请重试。"],
  downloadError: ["Download failed. You can retry.", "Unduhan gagal. Kamu bisa mencoba lagi.", "Error de descarga. Puedes reintentar.", "ダウンロードに失敗しました。再試行できます。", "下载失败，可以重试。"],
  verification: ["The downloaded file couldn't be verified. Download it again.", "Berkas unduhan gagal diverifikasi. Unduh ulang.", "No se pudo verificar el archivo. Descárgalo de nuevo.", "ファイルを検証できませんでした。再度ダウンロードしてください。", "无法验证下载文件，请重新下载。"],
  busy: ["Finish running tasks before installing this update.", "Selesaikan task yang berjalan sebelum memasang pembaruan.", "Finaliza las tareas en curso antes de instalar.", "実行中のタスクが完了してからインストールしてください。", "请在运行中的任务结束后安装更新。"],
  permission: ["Allow installation from this app in Android Settings, then tap Install update again.", "Izinkan pemasangan dari aplikasi ini di Pengaturan Android, lalu tekan Pasang pembaruan lagi.", "Permite instalar desde esta app en Ajustes de Android y pulsa Instalar de nuevo.", "Androidの設定でこのアプリからのインストールを許可し、再度インストールを押してください。", "请在 Android 设置中允许此应用安装软件，然后再次点击安装更新。"],
  autoCheck: ["Check automatically", "Periksa otomatis", "Buscar automáticamente", "自動で確認", "自动检查"],
  autoDownload: ["Download automatically", "Unduh otomatis", "Descargar automáticamente", "自動ダウンロード", "自动下载"],
  close: ["Close", "Tutup", "Cerrar", "閉じる", "关闭"],
  manual: ["This build uses the system download and installer.", "Build ini menggunakan unduhan dan installer sistem.", "Esta compilación usa la descarga y el instalador del sistema.", "このビルドはシステムのダウンロードとインストーラーを使用します。", "此版本使用系统下载与安装程序。"],
  unsupported: ["No compatible installer is attached to this release.", "Installer yang cocok belum dilampirkan pada rilis ini.", "Esta versión no incluye un instalador compatible.", "対応するインストーラーがありません。", "此发行版本未附带兼容的安装程序。"],
} as const;
export type UpdateStrings = { [K in keyof typeof messages]: string };
export function updateStrings(language: string): UpdateStrings {
  const index = Math.max(0, languages.indexOf(language));
  return Object.fromEntries(Object.entries(messages).map(([key, values]) => [key, values[index]])) as UpdateStrings;
}

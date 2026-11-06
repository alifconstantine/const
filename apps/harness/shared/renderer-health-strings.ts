const strings = {
  en: { title: "The display stopped responding", detail: "Agent work can continue in the background. Reload the display to reconnect, or wait. Reloading does not start the task again.", reload: "Reload display", wait: "Wait" },
  id: { title: "Tampilan berhenti merespons", detail: "Pekerjaan agent dapat tetap berjalan di latar belakang. Muat ulang tampilan untuk menyambung kembali, atau tunggu. Memuat ulang tidak memulai tugas dari awal.", reload: "Muat ulang tampilan", wait: "Tunggu" },
  ja: { title: "画面が応答しなくなりました", detail: "エージェントの処理はバックグラウンドで続いている可能性があります。画面を再読み込みして再接続するか、そのまま待ってください。再読み込みでタスクが最初から実行されることはありません。", reload: "画面を再読み込み", wait: "待つ" },
  zh: { title: "界面已停止响应", detail: "智能体任务可能仍在后台运行。重新加载界面以重新连接，或继续等待。重新加载不会从头启动任务。", reload: "重新加载界面", wait: "等待" },
  es: { title: "La interfaz dejó de responder", detail: "El agente puede seguir trabajando en segundo plano. Recarga la interfaz para volver a conectarte o espera. La recarga no inicia la tarea de nuevo.", reload: "Recargar interfaz", wait: "Esperar" },
};
export function rendererHealthStrings(language: string) { return strings[language as keyof typeof strings] ?? strings.en; }

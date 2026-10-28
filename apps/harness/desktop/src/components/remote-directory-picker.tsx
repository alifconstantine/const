import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  Button,
} from "@const/ui";
import { FilePreviewTab } from "./right-pane/file-preview-tab";
import { useTranslation } from "../lib/i18n";
import { remoteCopy } from "@const/remote/copy";

export function RemoteDirectoryPicker({
  initialPath,
  select,
  close,
}: {
  initialPath: string;
  select: (path: string) => Promise<void>;
  close: () => void;
}) {
  const { t, language } = useTranslation();
  const copy = remoteCopy(language);
  const [path, setPath] = useState(initialPath);
  const [error, setError] = useState(false);
  const [address, setAddress] = useState(initialPath);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="w-[720px] h-[70dvh] flex flex-col border-0 rounded-2xl bg-white dark:bg-[#161616]">
        <DialogTitle>{copy("project")}</DialogTitle>
        <DialogDescription>{copy("title")}</DialogDescription>
        <input
          aria-label={copy("project")}
          className="rounded-xl bg-black/5 dark:bg-white/5 px-3 py-2 text-sm outline-none"
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          onBlur={() => setPath(address)}
          onKeyDown={(event) => {
            if (event.key === "Enter") setPath(address);
          }}
        />
        <div className="flex-1 min-h-0">
          <FilePreviewTab
            key={path}
            tab={{
              id: "remote-directory",
              type: "directory",
              title: path,
              filePath: path,
              isDirectory: true,
            }}
            workspacePath={path}
            onOpenFilePreview={(next) => {
              setPath(next);
              setAddress(next);
            }}
          />
        </div>
        {error && (
          <p role="alert" className="text-xs text-muted-foreground">
            {t("remoteControl.actionError")}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => {
              setError(false);
              void select(address).catch(() => setError(true));
            }}
          >
            {t("common.confirm")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

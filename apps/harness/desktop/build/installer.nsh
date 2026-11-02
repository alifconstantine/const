!macro customInstall
  ; Updates may keep existing shortcuts. Refresh the shell icon cache on every
  ; install, including reinstalling the same version over an old Electron icon.
  ; Notify Explorer through the supported API without deleting its cache files.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0x1000, p 0, p 0)'
!macroend

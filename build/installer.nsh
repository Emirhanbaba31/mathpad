; Install: extra Start Menu shortcut so the uninstaller is easy to find.
!macro customInstall
  CreateShortCut "$SMPROGRAMS\MathPad'i Kaldır.lnk" "$INSTDIR\Uninstall MathPad.exe"
!macroend

; Uninstall: ask whether to also delete the user's data (%APPDATA%\MathPad). Skipped during updates.
!macro customUnInstall
  Delete "$SMPROGRAMS\MathPad'i Kaldır.lnk"
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "MathPad verilerin (dersler, sorular, çizimler, istatistikler) de silinsin mi?$\r$\n$\r$\nHayır dersen verilerin bilgisayarda kalır; MathPad'i tekrar kurduğunda kaldığın yerden devam edersin." /SD IDNO IDNO mathpad_keep
      RMDir /r "$APPDATA\MathPad"
    mathpad_keep:
  ${endIf}
!macroend

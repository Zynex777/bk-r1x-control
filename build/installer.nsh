; Trechos extras do instalador NSIS (incluídos pelo electron-builder).

; O app renomeia os atalhos com o nome que a pessoa deu ao mouse e guarda esse nome
; no registro. O desinstalador padrão só conhece o nome original, então apagamos aqui
; os atalhos renomeados.
!macro customUnInstall
  ReadRegStr $0 HKCU "Software\BK-R1X Control" "ShortcutName"
  StrCmp $0 "" +3
    Delete "$DESKTOP\$0.lnk"
    Delete "$SMPROGRAMS\$0.lnk"
  DeleteRegKey HKCU "Software\BK-R1X Control"
!macroend

; «المجالس»: تثبيت متطلّبات التشغيل ضمن المثبّت نفسه
!macro customInstall
  ; محرّك البثّ (OBS) يحتاج مكتبات Visual C++ 2015-2022 (x64). تُثبَّت تلقائيّاً لو لم تكن موجودة.
  ; تُشغَّل بنافذة تقدّم ظاهرة (لا مخفيّة) وبلا انتظار مفتوح: يراقب المثبّت وصول المكتبات في السجلّ حتى 4 دقائق ثمّ يُكمل مهما كان،
  ; فلا يعلق التثبيت لو لم يوافق المستخدم على طلب الصلاحيّات أو كان ويندوز مشغولاً بتحديث.
  SetRegView 64
  ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
  ReadRegDWORD $1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Bld"
  SetRegView lastused
  ${If} $0 != 1
  ${OrIf} $1 < 31000
    DetailPrint "Installing Microsoft Visual C++ Runtime (accept the Windows permission prompt)..."
    ExecShell "runas" "$INSTDIR\resources\vc_redist.x64.exe" "/install /passive /norestart" SW_SHOWNORMAL
    StrCpy $2 0
    majalis_vc_wait:
      Sleep 2000
      IntOp $2 $2 + 1
      SetRegView 64
      ReadRegDWORD $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Installed"
      ReadRegDWORD $1 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Bld"
      SetRegView lastused
      ${If} $0 == 1
      ${AndIf} $1 >= 31000
        Goto majalis_vc_done
      ${EndIf}
      ${If} $2 < 120
        Goto majalis_vc_wait
      ${EndIf}
    majalis_vc_done:
  ${EndIf}
  ClearErrors
  Delete "$INSTDIR\resources\vc_redist.x64.exe"
  ClearErrors
!macroend

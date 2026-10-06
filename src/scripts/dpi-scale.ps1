# 모니터 배율(DPI) 읽기·바꾸기 — 고배율 검증용(desktop-dpi.mjs). Windows 설정 > 디스플레이 > 배율과 같은 값을 바꾼다.
#   powershell -File scripts\dpi-scale.ps1 list
#   powershell -File scripts\dpi-scale.ps1 set <\\.\DISPLAYn> <100|125|150|175|200>
# DisplayConfigSetDeviceInfo 의 비공개 형식(-3 읽기 / -4 쓰기, 값 = 권장 배율에서 몇 칸 떨어졌나).
# 설정 앱이 쓰는 것과 같은 경로라 바뀐 값은 로그아웃 뒤에도 남는다 — 쓰고 나면 반드시 되돌린다.
param([string]$cmd = "list", [string]$device = "", [int]$percent = 100)
$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public static class Dpi {
  [StructLayout(LayoutKind.Sequential)] public struct LUID { public uint Low; public int High; }
  [StructLayout(LayoutKind.Sequential)] public struct Header { public int type; public int size; public LUID adapterId; public uint id; }
  [StructLayout(LayoutKind.Sequential)] public struct GetScale { public Header h; public int min; public int cur; public int max; }
  [StructLayout(LayoutKind.Sequential)] public struct SetScale { public Header h; public int rel; }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)] public struct SourceName { public Header h; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string name; }
  [StructLayout(LayoutKind.Sequential)] public struct PathSource { public LUID adapterId; public uint id; public uint modeIdx; public uint flags; }
  [StructLayout(LayoutKind.Sequential)] public struct PathTarget { public LUID adapterId; public uint id; public uint modeIdx; public int tech; public int rot; public int scaling; public uint rn; public uint rd; public int scan; [MarshalAs(UnmanagedType.Bool)] public bool avail; public uint status; }
  [StructLayout(LayoutKind.Sequential)] public struct Path { public PathSource src; public PathTarget tgt; public uint flags; }
  [StructLayout(LayoutKind.Sequential)] public struct Mode { public int infoType; public uint id; public LUID adapterId; [MarshalAs(UnmanagedType.ByValArray, SizeConst = 48)] public byte[] data; }
  [DllImport("user32.dll")] static extern int GetDisplayConfigBufferSizes(uint f, out uint np, out uint nm);
  [DllImport("user32.dll")] static extern int QueryDisplayConfig(uint f, ref uint np, [Out] Path[] p, ref uint nm, [Out] Mode[] m, IntPtr t);
  [DllImport("user32.dll")] static extern int DisplayConfigGetDeviceInfo(ref GetScale g);
  [DllImport("user32.dll")] static extern int DisplayConfigGetDeviceInfo(ref SourceName g);
  [DllImport("user32.dll")] static extern int DisplayConfigSetDeviceInfo(ref SetScale s);
  public static readonly int[] Steps = { 100, 125, 150, 175, 200, 225, 250, 300, 350, 400, 450, 500 };

  static Path[] Paths() {
    uint np, nm; GetDisplayConfigBufferSizes(2, out np, out nm); // QDC_ONLY_ACTIVE_PATHS
    var p = new Path[np]; var m = new Mode[nm];
    int r = QueryDisplayConfig(2, ref np, p, ref nm, m, IntPtr.Zero);
    if (r != 0) throw new Exception("QueryDisplayConfig " + r);
    Array.Resize(ref p, (int)np); return p;
  }
  static string Name(Path p) {
    var s = new SourceName(); s.h.type = 1; s.h.size = Marshal.SizeOf(typeof(SourceName)); s.h.adapterId = p.src.adapterId; s.h.id = p.src.id;
    DisplayConfigGetDeviceInfo(ref s); return s.name;
  }
  static GetScale Get(Path p) {
    var g = new GetScale(); g.h.type = -3; g.h.size = Marshal.SizeOf(typeof(GetScale)); g.h.adapterId = p.src.adapterId; g.h.id = p.src.id;
    int r = DisplayConfigGetDeviceInfo(ref g); if (r != 0) throw new Exception("get dpi " + r); return g;
  }
  public static List<string> List() {
    var o = new List<string>();
    foreach (var p in Paths()) { var g = Get(p); int rec = Math.Abs(g.min); o.Add(Name(p) + " " + Steps[rec + g.cur] + " (recommended " + Steps[rec] + ")"); }
    return o;
  }
  public static void Set(string device, int percent) {
    foreach (var p in Paths()) {
      if (!string.Equals(Name(p), device, StringComparison.OrdinalIgnoreCase)) continue;
      var g = Get(p); int rec = Math.Abs(g.min);
      int idx = Array.IndexOf(Steps, percent); if (idx < 0) throw new Exception("배율 값 아님: " + percent);
      int rel = idx - rec; if (rel < g.min || rel > g.max) throw new Exception("이 모니터에서 고를 수 없는 배율: " + percent);
      var s = new SetScale(); s.h.type = -4; s.h.size = Marshal.SizeOf(typeof(SetScale)); s.h.adapterId = p.src.adapterId; s.h.id = p.src.id; s.rel = rel;
      int r = DisplayConfigSetDeviceInfo(ref s); if (r != 0) throw new Exception("set dpi " + r);
      return;
    }
    throw new Exception("모니터 없음: " + device);
  }
}
'@

if ($cmd -eq "list") { [Dpi]::List() }
elseif ($cmd -eq "set") { [Dpi]::Set($device, $percent); Start-Sleep -Milliseconds 1500; [Dpi]::List() }
else { throw "usage: list | set <device> <percent>" }

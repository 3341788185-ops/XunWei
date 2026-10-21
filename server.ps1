# 寻味小站本地服务器：静态文件 + AI 接口代理（解决浏览器跨域限制，Key 不暴露在网页中）
$root = (Get-Location).Path
$AI_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
$AI_KEY = "6296ca9db6bc42cbacf979f3e59ad2a9.vYIWMZzCaGMv0Xlv"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8123/")
try {
  $listener.Start()
} catch {
  # 先确认端口上是否真的已有本站在运行，避免把启动失败误判成"已运行"
  $running = $false
  try {
    $c = New-Object Net.Sockets.TcpClient
    $c.Connect("127.0.0.1", 8123)
    $c.Close()
    $running = $true
  } catch {}
  if ($running) {
    Write-Host "检测到网站服务已在运行，正在打开浏览器..."
    Start-Process "http://localhost:8123/index.html"
    Start-Sleep -Milliseconds 800
    exit 0
  }
  Write-Host "启动失败：" $_.Exception.Message -ForegroundColor Red
  Write-Host "可能原因：端口 8123 被其他程序占用。" -ForegroundColor Yellow
  exit 1
}

Write-Host ""
Write-Host "  ============================================" -ForegroundColor Green
Write-Host "   寻味小站已启动：http://localhost:8123" -ForegroundColor Green
Write-Host "   AI 助手可直接使用，无需任何配置" -ForegroundColor Green
Write-Host "   关闭本窗口即停止服务" -ForegroundColor Yellow
Write-Host "  ============================================" -ForegroundColor Green
Write-Host ""

# 服务就绪后自动打开浏览器
Start-Process "http://localhost:8123/index.html"

$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".jpg"="image/jpeg"; ".png"="image/png"; ".svg"="image/svg+xml"; ".ico"="image/x-icon" }

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $p = $ctx.Request.Url.LocalPath

    if ($p -eq "/api/ping") {
      # 健康检查：供直接打开 html 文件时探测本地服务是否已启动
      $out = [Text.Encoding]::UTF8.GetBytes('{"ok":true}')
      $ctx.Response.Headers.Add("Access-Control-Allow-Origin", "*")
      $ctx.Response.ContentType = "application/json; charset=utf-8"
      $ctx.Response.ContentLength64 = $out.Length
      $ctx.Response.OutputStream.Write($out, 0, $out.Length)
      $ctx.Response.OutputStream.Close()
      continue
    }

    if ($p -eq "/api/ai" -and $ctx.Request.HttpMethod -eq "POST") {
      # AI 代理：把请求原样转发给智谱 GLM，Key 在服务端追加
      $ms = New-Object IO.MemoryStream
      $ctx.Request.InputStream.CopyTo($ms)
      $bytes = $ms.ToArray()
      $req = [Net.HttpWebRequest]::Create($AI_URL)
      $req.Method = "POST"
      $req.ContentType = "application/json; charset=utf-8"
      $req.Headers.Add("Authorization", "Bearer " + $AI_KEY)
      $req.ContentLength = $bytes.Length
      $req.Timeout = 120000
      $rs = $req.GetRequestStream(); $rs.Write($bytes, 0, $bytes.Length); $rs.Close()
      try { $resp = $req.GetResponse() } catch [Net.WebException] { $resp = $_.Exception.Response }
      $sr = New-Object IO.StreamReader($resp.GetResponseStream(), [Text.Encoding]::UTF8)
      $text = $sr.ReadToEnd()
      $sr.Close(); $resp.Close()
      $out = [Text.Encoding]::UTF8.GetBytes($text)
      $ctx.Response.StatusCode = [int]$resp.StatusCode
      $ctx.Response.ContentType = "application/json; charset=utf-8"
      $ctx.Response.ContentLength64 = $out.Length
      $ctx.Response.OutputStream.Write($out, 0, $out.Length)
      $ctx.Response.OutputStream.Close()
      continue
    }

    # 静态文件
    if ($p -eq "/") { $p = "/index.html" }
    $file = Join-Path $root ($p.TrimStart("/") -replace "/", "\")
    if (Test-Path $file -PathType Leaf) {
      $fbytes = [IO.File]::ReadAllBytes($file)
      $ext = [IO.Path]::GetExtension($file).ToLower()
      $ctx.Response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
      $ctx.Response.Headers.Add("Cache-Control", "no-store")
      $ctx.Response.ContentLength64 = $fbytes.Length
      $ctx.Response.OutputStream.Write($fbytes, 0, $fbytes.Length)
    } else { $ctx.Response.StatusCode = 404 }
    $ctx.Response.OutputStream.Close()
  } catch { try { $ctx.Response.StatusCode = 500; $ctx.Response.OutputStream.Close() } catch {} }
}

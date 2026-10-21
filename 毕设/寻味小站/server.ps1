# 寻味小站本地服务器：静态文件 + AI 接口代理（解决浏览器跨域限制，Key 不暴露在网页中）
$root = (Get-Location).Path
$AI_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions"
$AI_KEY = "6296ca9db6bc42cbacf979f3e59ad2a9.vYIWMZzCaGMv0Xlv"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:8123/")
$listener.Start()
Write-Output "寻味小站已启动：http://localhost:8123"
Write-Output "按 Ctrl+C 停止服务"

$mime = @{ ".html"="text/html; charset=utf-8"; ".js"="application/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8"; ".jpg"="image/jpeg"; ".png"="image/png"; ".svg"="image/svg+xml"; ".ico"="image/x-icon" }

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $p = $ctx.Request.Url.LocalPath

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

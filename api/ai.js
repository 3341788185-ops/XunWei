// Vercel Serverless Function：AI 对话代理
// 作用与本地 server.ps1 的 /api/ai 相同：在服务端持有 API Key，避免浏览器跨域限制
// 部署前需在 Vercel 项目设置的 Environment Variables 中添加：ZHIPU_API_KEY
module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: { message: "仅支持 POST 请求" } });
    return;
  }

  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: { message: "服务端未配置 ZHIPU_API_KEY 环境变量" } });
    return;
  }

  try {
    const upstream = await fetch("https://open.bigmodel.cn/api/paas/v4/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + apiKey
      },
      body: typeof req.body === "string" ? req.body : JSON.stringify(req.body)
    });
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.send(text);
  } catch (err) {
    res.status(502).json({ error: { message: "AI 接口请求失败：" + err.message } });
  }
};

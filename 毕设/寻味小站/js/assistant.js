/**
 * assistant.js —— AI 助手页逻辑
 * 包含三个标签页：AI 对话、热量计算器、减肥助手
 * AI 对话支持 OpenAI 兼容接口（DeepSeek / 通义千问 / Moonshot / OpenAI / 自定义），
 * 未配置 API Key 时使用本地规则兜底回复（离线模式）
 */

/* ======================= 标签页切换 ======================= */

// 点击标签按钮切换对应面板
document.querySelectorAll(".ast-tab").forEach(function (btn) {
  btn.addEventListener("click", function () {
    document.querySelectorAll(".ast-tab").forEach(function (b) { b.classList.remove("active"); });
    document.querySelectorAll(".ast-panel").forEach(function (p) { p.classList.remove("active"); });
    btn.classList.add("active");
    document.getElementById("panel-" + btn.getAttribute("data-tab")).classList.add("active");
  });
});

/* ======================= 管理员开关 ======================= */

// 只有网站管理者能配置 API：访问 assistant.html?admin=1 开启（本机记住），?admin=0 退出
var ADMIN_KEY = "xw_ai_admin";
(function initAdminFlag() {
  const m = location.search.match(/[?&]admin=([01])/);
  if (m) {
    if (m[1] === "1") localStorage.setItem(ADMIN_KEY, "1");
    else localStorage.removeItem(ADMIN_KEY);
  }
})();
function isAdmin() { return localStorage.getItem(ADMIN_KEY) === "1"; }

// 离线回答的尾注：仅管理员提示去配置 API Key，普通访客不显示
function offlineNote() {
  return isAdmin() ? "" + offlineNote() + "" : "";
}

/* ======================= AI 配置（存 localStorage） ======================= */

// 服务商预设：接口地址 + 默认模型（均为 OpenAI 兼容接口）
var AI_PROVIDERS = {
  zhipu:    { baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-flash" },
  deepseek: { baseUrl: "https://api.deepseek.com/v1", model: "deepseek-chat" },
  qwen:     { baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  moonshot: { baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  openai:   { baseUrl: "https://api.openai.com/v1", model: "gpt-4o-mini" },
  custom:   { baseUrl: "", model: "" }
};

// 内置默认配置：localStorage 没有保存过时使用（部署到公网时建议清空，避免 Key 泄露）
var AI_DEFAULT_SETTINGS = {
  v: 2,
  provider: "zhipu",
  baseUrl: "https://open.bigmodel.cn/api/paas/v4",
  apiKey: "6296ca9db6bc42cbacf979f3e59ad2a9.vYIWMZzCaGMv0Xlv",
  model: "glm-4-flash"
};

// 读取已保存的 AI 配置；没有保存过或版本过旧时返回内置默认配置
function getAiSettings() {
  const s = JSON.parse(localStorage.getItem("xw_ai_settings") || "null");
  return s && s.v === 2 ? s : AI_DEFAULT_SETTINGS;
}

// 保存 AI 配置并刷新配置区提示文案
function saveAiSettings(settings) {
  settings.v = 2; // 配置版本标记，便于升级内置默认配置时覆盖旧缓存
  localStorage.setItem("xw_ai_settings", JSON.stringify(settings));
  updateConfigState();
}

// 更新配置区头部的状态提示（已配置 / 未配置）
function updateConfigState() {
  const s = getAiSettings();
  const stateEl = document.getElementById("aiConfigState");
  stateEl.textContent = s && s.apiKey
    ? "（已配置 API Key，点击可修改）"
    : "（未配置 API Key，当前为离线模式，点击展开配置）";
}

// 页面加载时回填配置
function loadAiSettings() {
  const s = getAiSettings();
  if (!s) { updateConfigState(); return; }
  document.getElementById("aiProvider").value = s.provider || "deepseek";
  document.getElementById("aiBaseUrl").value = s.baseUrl || "";
  document.getElementById("aiApiKey").value = s.apiKey || "";
  document.getElementById("aiModel").value = s.model || "";
  updateConfigState();
}

// 配置区折叠 / 展开
document.getElementById("aiConfigToggle").addEventListener("click", function () {
  const form = document.getElementById("aiConfigForm");
  form.style.display = form.style.display === "none" ? "block" : "none";
});

// 切换服务商时自动填充对应的接口地址与模型（自定义服务商除外）
document.getElementById("aiProvider").addEventListener("change", function () {
  const p = AI_PROVIDERS[this.value];
  if (this.value !== "custom") {
    document.getElementById("aiBaseUrl").value = p.baseUrl;
    document.getElementById("aiModel").value = p.model;
  }
});

// 保存配置按钮
document.getElementById("aiSaveBtn").addEventListener("click", function () {
  saveAiSettings({
    provider: document.getElementById("aiProvider").value,
    baseUrl: document.getElementById("aiBaseUrl").value.trim(),
    apiKey: document.getElementById("aiApiKey").value.trim(),
    model: document.getElementById("aiModel").value.trim()
  });
  showToast("API 配置已保存 ✅");
});

/* ======================= AI 对话 ======================= */

// 对话历史（含 system 消息），随每次请求一起发送
var chatMessages = [];

// 从站内菜品数据生成摘要，供 system prompt 使用，让 AI 能结合站内数据回答
function buildDishSummary() {
  return DISHES.map(function (d) {
    return d.name + "（" + d.tags.join("/") + "，约" + d.cal + "千卡/份）";
  }).join("；");
}

// 初始化对话：system prompt 携带站内菜品数据摘要
function initChat() {
  chatMessages = [{
    role: "system",
    content: "你是“寻味小站”美食网站的 AI 美食助手，语气亲切、回答简洁实用。" +
      "你可以推荐菜品、计算热量、给出减肥饮食建议。" +
      "本站共有 " + DISHES.length + " 道菜，数据如下（菜名（口味标签，热量））：" +
      buildDishSummary() +
      "。推荐菜品时优先从以上菜品中挑选，并注明热量。"
  }];
}

// 往聊天区追加一条消息气泡，返回气泡元素（便于 loading 后替换内容）
function appendChatMsg(role, html) {
  const list = document.getElementById("chatList");
  const wrap = document.createElement("div");
  wrap.className = "chat-msg " + role;
  wrap.innerHTML = '<div class="chat-bubble">' + html + "</div>";
  list.appendChild(wrap);
  list.scrollTop = list.scrollHeight; // 滚动到底部
  return wrap;
}

// 本地规则兜底回复（未配置 API Key 时的离线模式）
function localReply(text) {
  // 问热量：查找消息中出现的菜名，返回对应热量
  if (text.indexOf("热量") !== -1) {
    const hit = DISHES.filter(function (d) { return text.indexOf(d.name) !== -1; });
    if (hit.length) {
      return "我找到了这些菜的热量 🔥：<br>" + hit.map(function (d) {
        return "· <b>" + d.name + "</b>：约 " + d.cal + " 千卡/份";
      }).join("<br>") + "" + offlineNote() + "";
    }
    return "本站每道菜都标注了热量（千卡/份），你可以直接问我某道菜，比如“红烧肉热量多少？”～<br>" +
      "<small>（离线回答，配置 API Key 可获得更完整的解答）</small>";
  }

  // 问减肥：推荐低热量菜品（≤250 千卡）并附小贴士
  if (text.indexOf("减肥") !== -1 || text.indexOf("减脂") !== -1) {
    const light = DISHES.filter(function (d) { return d.cal <= 250; }).slice(0, 6);
    return "减肥期间可以试试这些低热量菜品（≤250 千卡/份）🥗：<br>" + light.map(function (d) {
      return "· <b>" + d.name + "</b>：约 " + d.cal + " 千卡";
    }).join("<br>") +
      "<br><br>💡 小贴士：优先选择清蒸、白灼、炖煮的做法；每餐先吃蔬菜和蛋白质；每天保持约 500 千卡的热量缺口即可健康减重。" +
      "" + offlineNote() + "";
  }

  // 问推荐：随机推荐 3 道菜
  if (text.indexOf("推荐") !== -1 || text.indexOf("吃什么") !== -1) {
    const pool = DISHES.slice();
    const picked = [];
    while (picked.length < 3 && pool.length) {
      picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    }
    return "为你随机推荐 3 道菜 🍽：<br>" + picked.map(function (d) {
      return '· <a href="detail.html?id=' + d.id + '"><b>' + d.name + "</b></a>（" +
        d.tags.join("/") + "，约 " + d.cal + " 千卡）";
    }).join("<br>") + "" + offlineNote() + "";
  }

  // 其他问题：提示（仅管理员提示配置 API Key）
  return isAdmin()
    ? "我目前是离线模式，只能回答热量、减肥、菜品推荐类问题～<br>点击上方「⚙️ API 配置」填入 API Key 后，我就能调用大模型完整回答你的任何问题啦！"
    : "我目前只能回答热量、减肥、菜品推荐类问题～更多智能问答能力正在升级中，敬请期待！";
}

// 解析 OpenAI 兼容接口的响应，失败时抛出带具体原因的错误
function parseAiResponse(res) {
  return res.json().catch(function () { return null; }).then(function (body) {
    if (!res.ok) {
      const detail = body && body.error && body.error.message ? "：" + body.error.message : "";
      throw new Error("接口返回 " + res.status + detail);
    }
    const reply = body && body.choices && body.choices[0] && body.choices[0].message
      ? body.choices[0].message.content : "";
    if (!reply) throw new Error("接口没有返回有效内容");
    return reply;
  });
}

// 在聊天区展示 AI 回复 / 错误
function showAiReply(loadingEl, reply) {
  chatMessages.push({ role: "assistant", content: reply });
  loadingEl.querySelector(".chat-bubble").innerHTML = escapeHtml(reply).replace(/\n/g, "<br>");
}
function showAiError(loadingEl, err) {
  loadingEl.querySelector(".chat-bubble").innerHTML =
    "⚠️ 调用失败：" + escapeHtml(err.message || "网络异常") +
    "<br><small>请用项目根目录的「启动网站.bat」打开网站（AI 需要本地代理服务支持），或检查网络后重试。</small>";
}

// 调用 AI：优先走本站同源代理 /api/ai（server.ps1 提供，无跨域问题、Key 不暴露在浏览器）；
// 代理不可用时（如直接双击 html 打开）回退为浏览器直连服务商接口
function requestAiReply(loadingEl) {
  const s = getAiSettings();
  const payload = JSON.stringify({ model: s.model, messages: chatMessages });

  fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload })
    .then(parseAiResponse)
    .then(function (reply) { showAiReply(loadingEl, reply); })
    .catch(function (proxyErr) {
      // 代理不可用，回退直连（需要服务商允许浏览器跨域，且本地已配置 Key）
      if (!s.apiKey || !s.baseUrl) { showAiError(loadingEl, proxyErr); return; }
      const url = s.baseUrl.replace(/\/+$/, "") + "/chat/completions";
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + s.apiKey },
        body: payload
      })
        .then(parseAiResponse)
        .then(function (reply) { showAiReply(loadingEl, reply); })
        .catch(function (err) { showAiError(loadingEl, err); });
    });
}

// 发送消息
function sendChat() {
  const input = document.getElementById("chatInput");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  // 用户气泡
  appendChatMsg("user", escapeHtml(text));
  chatMessages.push({ role: "user", content: text });

  // loading 气泡：正在思考…
  const loadingEl = appendChatMsg("ai", "正在思考…");

  // 直接读取配置输入框的当前值（没点“保存配置”也能用），并顺手保存到 localStorage
  const s = {
    provider: document.getElementById("aiProvider").value,
    baseUrl: document.getElementById("aiBaseUrl").value.trim(),
    apiKey: document.getElementById("aiApiKey").value.trim(),
    model: document.getElementById("aiModel").value.trim()
  };
  saveAiSettings(s);
  if (!s.apiKey || !s.baseUrl || !s.model) {
    // 未配置 API Key：本地规则兜底，稍作延迟模拟思考
    setTimeout(function () {
      loadingEl.querySelector(".chat-bubble").innerHTML = localReply(text);
      document.getElementById("chatList").scrollTop = document.getElementById("chatList").scrollHeight;
    }, 400);
  } else {
    requestAiReply(loadingEl);
  }
}

document.getElementById("chatSendBtn").addEventListener("click", sendChat);
// Enter 键发送
document.getElementById("chatInput").addEventListener("keydown", function (e) {
  if (e.key === "Enter") sendChat();
});

/* ======================= 热量计算器 ======================= */

// 已选菜品：{ 菜品id: 份数 }
var calSelected = {};

// 渲染菜品勾选列表（支持按菜名搜索过滤）
function renderCalList() {
  const kw = document.getElementById("calSearch").value.trim();
  const list = document.getElementById("calList");

  const dishes = DISHES.filter(function (d) { return !kw || d.name.indexOf(kw) !== -1; });
  if (!dishes.length) {
    list.innerHTML = '<div class="empty"><div class="empty-icon">🔍</div><p>没有找到相关菜品～</p></div>';
    return;
  }

  list.innerHTML = dishes.map(function (d) {
    const qty = calSelected[d.id] || 0;
    return (
      '<div class="cal-row' + (qty > 0 ? " checked" : "") + '" data-id="' + d.id + '">' +
        '<label class="cal-check">' +
          '<input type="checkbox" class="cal-checkbox" data-id="' + d.id + '"' + (qty > 0 ? " checked" : "") + ">" +
          '<span class="cal-name">' + d.name + "</span>" +
        "</label>" +
        '<span class="cal-unit">' + d.cal + " 千卡/份</span>" +
        '<span class="cal-stepper">' +
          '<button class="cal-step-btn" data-id="' + d.id + '" data-delta="-1">−</button>' +
          '<span class="cal-qty" id="calQty' + d.id + '">' + (qty || 1) + "</span>" +
          '<button class="cal-step-btn" data-id="' + d.id + '" data-delta="1">＋</button>' +
        "</span>" +
        '<span class="cal-subtotal" id="calSub' + d.id + '">' + (qty > 0 ? qty * d.cal + " 千卡" : "") + "</span>" +
      "</div>"
    );
  }).join("");
}

// 更新汇总：已选数量、合计热量、占每日 2000 千卡的比例与进度条
function updateCalSummary() {
  let count = 0, total = 0;
  DISHES.forEach(function (d) {
    const qty = calSelected[d.id] || 0;
    if (qty > 0) { count++; total += d.cal * qty; }
  });
  const percent = Math.round(total / 2000 * 100);
  document.getElementById("calCount").textContent = count;
  document.getElementById("calTotal").textContent = total;
  document.getElementById("calPercent").textContent = percent + "%";
  // 进度条宽度封顶 100%，超过 100% 时变红色警示
  const bar = document.getElementById("calBar");
  bar.style.width = Math.min(percent, 100) + "%";
  bar.classList.toggle("over", percent > 100);
}

// 列表内事件委托：复选框勾选 / 份数加减
document.getElementById("calList").addEventListener("click", function (e) {
  const id = Number(e.target.getAttribute("data-id"));
  if (!id) return;
  const dish = DISHES.find(function (d) { return d.id === id; });

  if (e.target.classList.contains("cal-checkbox")) {
    // 勾选默认 1 份，取消勾选移除
    calSelected[id] = e.target.checked ? 1 : 0;
  } else if (e.target.classList.contains("cal-step-btn")) {
    const delta = Number(e.target.getAttribute("data-delta"));
    const cur = calSelected[id] || 1;
    const next = Math.min(10, Math.max(1, cur + delta)); // 份数限制 1-10
    calSelected[id] = next;
    // 点加减视为选中该菜
    const row = e.target.closest(".cal-row");
    row.querySelector(".cal-checkbox").checked = true;
  } else {
    return;
  }

  // 就地更新行内份数与小计，避免整表重绘导致滚动跳动
  const qty = calSelected[id] || 0;
  const row = document.querySelector('.cal-row[data-id="' + id + '"]');
  row.classList.toggle("checked", qty > 0);
  document.getElementById("calQty" + id).textContent = qty || 1;
  document.getElementById("calSub" + id).textContent = qty > 0 ? qty * dish.cal + " 千卡" : "";
  updateCalSummary();
});

// 搜索框输入时重新过滤列表
document.getElementById("calSearch").addEventListener("input", renderCalList);

/* ======================= 减肥助手 ======================= */

// 点击“开始计算”：Mifflin-St Jeor 公式计算 BMR / TDEE / 减脂目标摄入
document.getElementById("dietCalcBtn").addEventListener("click", function () {
  const gender = document.getElementById("dietGender").value;
  const age = Number(document.getElementById("dietAge").value);
  const height = Number(document.getElementById("dietHeight").value);
  const weight = Number(document.getElementById("dietWeight").value);
  const activity = Number(document.getElementById("dietActivity").value) || 1.2; // 取不到有效系数时按“久坐”处理，避免 TDEE 变 0

  if (!age || !height || !weight) {
    showToast("请完整填写年龄、身高、体重～");
    return;
  }

  // Mifflin-St Jeor 公式：男性 +5，女性 -161
  const bmr = Math.round(10 * weight + 6.25 * height - 5 * age + (gender === "male" ? 5 : -161));
  const tdee = Math.round(bmr * activity);
  // 减脂目标：每日制造约 500 千卡缺口，且不低于 1200 千卡的安全线
  const target = Math.max(tdee - 500, 1200);
  const meal = Math.round(target / 3); // 按一日三餐均分

  document.getElementById("dietBmr").textContent = bmr;
  document.getElementById("dietTdee").textContent = tdee;
  document.getElementById("dietTarget").textContent = target;
  document.getElementById("dietMeal").textContent = meal;
  document.getElementById("dietResult").style.display = "grid";
  document.getElementById("dietTips").style.display = "block";

  // 筛选站内热量不超过每餐预算的菜，按热量升序排列
  const fit = DISHES.filter(function (d) { return d.cal <= meal; })
    .sort(function (a, b) { return a.cal - b.cal; });

  document.getElementById("dietDishes").style.display = "block";
  document.getElementById("dietDishCount").textContent =
    "共 " + fit.length + " 道菜 ≤ " + meal + " 千卡/份";
  document.getElementById("dietGrid").innerHTML = fit.length
    ? fit.map(function (d) { return renderDishCard(d, { fav: true }); }).join("")
    : '<p class="section-sub">暂无符合预算的菜品，可适当放宽预算或增加运动量～</p>';
});

/* ======================= 页面初始化 ======================= */

document.addEventListener("DOMContentLoaded", function () {
  // 管理员身份：显示 API 配置区等管理员专属内容
  if (isAdmin()) {
    document.querySelectorAll(".admin-only").forEach(function (el) { el.style.display = ""; });
  }
  initChat();       // 初始化对话（system prompt 携带菜品摘要）
  loadAiSettings(); // 回填 API 配置
  renderCalList();  // 渲染热量计算器列表
  updateCalSummary();
});

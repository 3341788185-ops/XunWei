/**
 * main.js —— 全站公共脚本
 * 包含：用户管理（用户表）、收藏管理（收藏表）、导航渲染、菜品卡片渲染、消息提示
 * 所有用户数据存储在浏览器 localStorage 中，刷新/关闭浏览器后依然保留
 */

/* ======================= 用户管理（模拟用户表） ======================= */

// 读取全部注册用户：[{ id, username, password, nickname }]
function getUsers() {
  return JSON.parse(localStorage.getItem("xw_users") || "[]");
}

function saveUsers(users) {
  localStorage.setItem("xw_users", JSON.stringify(users));
}

// 注册：成功返回新用户对象，失败返回 null
function registerUser(username, password, nickname) {
  const users = getUsers();
  const exists = users.some(function (u) { return u.username === username; });
  if (exists) return null;
  const user = {
    id: "u" + Date.now(),
    username: username,
    password: password,
    nickname: nickname || username
  };
  users.push(user);
  saveUsers(users);
  return user;
}

// 登录：成功返回用户对象，失败返回 null
function loginUser(username, password) {
  const users = getUsers();
  const user = users.find(function (u) {
    return u.username === username && u.password === password;
  });
  return user || null;
}

/* ======================= 当前登录状态 ======================= */

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("xw_currentUser") || "null");
}

function setCurrentUser(user) {
  if (user) {
    localStorage.setItem("xw_currentUser", JSON.stringify(user));
  } else {
    localStorage.removeItem("xw_currentUser");
  }
  renderHeader(); // 状态变化后刷新导航栏
}

/* ======================= 收藏管理（模拟收藏表） ======================= */
// 收藏表：{ 用户标识: [菜品ID, ...] }，游客也有独立收藏空间

function getFavKey() {
  const user = getCurrentUser();
  return user ? "xw_fav_" + user.id : "xw_fav_guest";
}

function getFavorites() {
  return JSON.parse(localStorage.getItem(getFavKey()) || "[]");
}

function isFavorite(dishId) {
  return getFavorites().indexOf(dishId) !== -1;
}

// 收藏 / 取消收藏，返回操作后的收藏状态
function toggleFavorite(dishId) {
  const favs = getFavorites();
  const index = favs.indexOf(dishId);
  if (index === -1) {
    favs.push(dishId);
  } else {
    favs.splice(index, 1);
  }
  localStorage.setItem(getFavKey(), JSON.stringify(favs));
  return index === -1;
}

/* ======================= 导航栏渲染 ======================= */

function renderHeader() {
  const box = document.getElementById("navUser");
  if (!box) return;
  const user = getCurrentUser();
  if (user) {
    box.innerHTML =
      '<a href="user.html" class="nav-user-name">👤 ' + escapeHtml(user.nickname) + "</a>" +
      '<a href="javascript:void(0)" onclick="logout()" class="nav-link">退出</a>';
  } else {
    box.innerHTML = '<a href="login.html" class="nav-link">登录 / 注册</a>';
  }
}

function logout() {
  setCurrentUser(null);
  showToast("已退出登录");
  setTimeout(function () { location.href = "index.html"; }, 600);
}

/* ======================= 菜品卡片渲染 ======================= */

/**
 * 生成一张菜品卡片 HTML
 * @param {object} dish 菜品对象
 * @param {object} opts 可选：{ showScore: 匹配度, showFav: 是否显示收藏按钮 }
 */
function renderDishCard(dish, opts) {
  opts = opts || {};
  const tagsHtml = dish.tags.map(function (t) {
    return '<a class="tag" href="list.html?tag=' + encodeURIComponent(t) + '">' + t + "</a>";
  }).join("");

  const scoreHtml = opts.score
    ? '<span class="dish-score">匹配度 ' + Math.round(opts.score * 20) + "%</span>"
    : "";

  const favHtml = opts.fav
    ? '<button class="fav-btn' + (isFavorite(dish.id) ? " active" : "") +
      '" onclick="onCardFavClick(event,' + dish.id + ')">' +
      (isFavorite(dish.id) ? "♥ 已收藏" : "♡ 收藏") + "</button>"
    : "";

  return (
    '<div class="dish-card">' +
      '<a href="detail.html?id=' + dish.id + '" class="dish-img-wrap">' +
        '<img class="dish-img" src="' + dish.img + '" alt="' + dish.name + '" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'images/placeholder.svg\'">' +
      "</a>" +
      '<div class="dish-body">' +
        '<div class="dish-title-row">' +
          '<a class="dish-name" href="detail.html?id=' + dish.id + '">' + dish.name + "</a>" +
          scoreHtml +
        "</div>" +
        '<div class="dish-tags">' + tagsHtml + "</div>" +
        '<p class="dish-intro">' + dish.intro + "</p>" +
        '<div class="dish-foot">' +
          '<span class="dish-meta">⏱ ' + dish.time + " · " + dish.level + ' · 🔥 ' + dish.cal + '千卡</span>' +
          favHtml +
        "</div>" +
      "</div>" +
    "</div>"
  );
}

// 卡片上的收藏按钮点击（游客则引导登录）
function onCardFavClick(e, dishId) {
  e.preventDefault();
  e.stopPropagation();
  if (!getCurrentUser()) {
    showToast("登录后即可收藏菜品～");
    setTimeout(function () { location.href = "login.html"; }, 800);
    return;
  }
  const fav = toggleFavorite(dishId);
  showToast(fav ? "已加入收藏 ❤" : "已取消收藏");
  // 刷新当前页面所有卡片按钮状态
  document.querySelectorAll(".fav-btn").forEach(function (btn) {
    const m = btn.getAttribute("onclick").match(/onCardFavClick\(event,(\d+)\)/);
    if (m) {
      const id = Number(m[1]);
      btn.classList.toggle("active", isFavorite(id));
      btn.innerHTML = isFavorite(id) ? "♥ 已收藏" : "♡ 收藏";
    }
  });
}

/* ======================= 互动社区（模拟帖子表） ======================= */

// 读取全部帖子：[{ id, userId, nickname, content, time, likes }]
function getPosts() {
  return JSON.parse(localStorage.getItem("xw_forum") || "[]");
}

function savePosts(posts) {
  localStorage.setItem("xw_forum", JSON.stringify(posts));
}

// 发布帖子：游客也可以发，昵称未登录时用“游客”
function addPost(content) {
  const posts = getPosts();
  const user = getCurrentUser();
  const post = {
    id: "p" + Date.now(),
    userId: user ? user.id : "guest",
    nickname: user ? user.nickname : "游客",
    content: content.trim(),
    time: new Date().toLocaleString("zh-CN", { hour12: false }),
    likes: 0
  };
  posts.unshift(post); // 新帖排在最前
  savePosts(posts);
  return post;
}

// 点赞帖子
function likePost(postId) {
  const posts = getPosts();
  const post = posts.find(function (p) { return p.id === postId; });
  if (!post) return null;
  post.likes += 1;
  savePosts(posts);
  return post.likes;
}

/* ======================= 工具函数 ======================= */

// HTML 转义，防止昵称等内容破坏页面结构
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// 轻量消息提示条
function showToast(msg) {
  let box = document.getElementById("toast");
  if (!box) {
    box = document.createElement("div");
    box.id = "toast";
    document.body.appendChild(box);
  }
  box.textContent = msg;
  box.className = "toast show";
  clearTimeout(box._timer);
  box._timer = setTimeout(function () { box.className = "toast"; }, 1800);
}

// 页面加载后统一初始化导航栏
document.addEventListener("DOMContentLoaded", renderHeader);

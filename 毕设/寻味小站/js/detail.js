/**
 * detail.js —— 菜品详情页逻辑
 * 功能：菜品详情展示、收藏/取消收藏、相似口味推荐
 */

// 当前菜品
let dish = null;

// 渲染菜品详情
function renderDetail() {
  const wrap = document.getElementById("detailWrap");

  // 从 URL 读取菜品 id：detail.html?id=1
  const params = new URLSearchParams(location.search);
  const id = Number(params.get("id"));
  dish = DISHES.find(function (d) { return d.id === id; });

  if (!dish) {
    wrap.innerHTML =
      '<div class="empty">' +
        '<div class="empty-icon">🥲</div>' +
        "<p>没有找到这道菜，可能链接有误～</p>" +
        '<a class="section-link" href="list.html">返回全部菜品</a>' +
      "</div>";
    document.title = "菜品不存在 - 寻味小站";
    return;
  }

  document.title = dish.name + " - 寻味小站";

  const tagsHtml = dish.tags.map(function (t) {
    return '<a class="tag" href="list.html?tag=' + encodeURIComponent(t) + '">' + t + "</a>";
  }).join("");

  const ingHtml = dish.ingredients.map(function (x) { return "<li>" + x + "</li>"; }).join("");
  const stepHtml = dish.steps.map(function (s, i) {
    return "<li><span class='step-num'>" + (i + 1) + "</span>" + s + "</li>";
  }).join("");

  const fav = isFavorite(dish.id);

  // 推荐店铺 / 品牌
  const shops = DISH_SHOPS[dish.id] || [];
  const shopHtml = shops.length
    ? '<div class="detail-panel shop-panel"><h3>🏪 去哪吃 · 推荐店铺</h3>' +
      '<div class="shop-chips">' +
      shops.map(function (s) { return '<span class="shop-chip">' + s + "</span>"; }).join("") +
      "</div></div>"
    : "";

  wrap.innerHTML =
    '<img class="detail-img" src="' + dish.img + '" alt="' + dish.name + '" onerror="this.onerror=null;this.src=\'images/placeholder.svg\'">' +
    '<div class="detail-body">' +
      '<div class="detail-title-row">' +
        "<div>" +
          '<h1 class="detail-name">' + dish.name + "</h1>" +
          '<p class="detail-meta">⏱ 烹饪时间：' + dish.time + " ｜ 难度：" + dish.level + ' ｜ 🔥 约' + dish.cal + '千卡/份</p>' +
        "</div>" +
        '<div class="detail-actions">' +
          '<button id="detailFavBtn" class="fav-btn big' + (fav ? " active" : "") +
            '" onclick="onDetailFavClick()">' + (fav ? "♥ 已收藏" : "♡ 收藏这道菜") + "</button>" +
        "</div>" +
      "</div>" +
      '<div class="detail-tags">' + tagsHtml + "</div>" +
      '<p class="detail-desc">' + dish.desc + "</p>" +
      '<div class="detail-columns">' +
        '<div class="detail-panel"><h3>🧂 食材清单</h3><ul>' + ingHtml + "</ul></div>" +
        '<div class="detail-panel"><h3>👨‍🍳 做法步骤</h3><ul>' + stepHtml + "</ul></div>" +
      "</div>" +
      '<div style="margin-top: 22px;">' + shopHtml + "</div>" +
    "</div>";

  renderRelated();
}

// 详情页收藏按钮
function onDetailFavClick() {
  if (!getCurrentUser()) {
    showToast("登录后即可收藏菜品～");
    setTimeout(function () { location.href = "login.html"; }, 800);
    return;
  }
  const fav = toggleFavorite(dish.id);
  const btn = document.getElementById("detailFavBtn");
  btn.classList.toggle("active", fav);
  btn.innerHTML = fav ? "♥ 已收藏" : "♡ 收藏这道菜";
  showToast(fav ? "已加入收藏 ❤" : "已取消收藏");
}

// 相似口味推荐：与当前菜品存在共同标签的其他菜品
function renderRelated() {
  const grid = document.getElementById("relatedGrid");
  if (!dish) { grid.innerHTML = ""; return; }

  const related = DISHES.filter(function (d) {
    if (d.id === dish.id) return false;
    return d.tags.some(function (t) { return dish.tags.indexOf(t) !== -1; });
  }).slice(0, 4);

  grid.innerHTML = related
    .map(function (d) { return renderDishCard(d, { fav: true }); })
    .join("") || '<p class="section-sub">暂无相似口味菜品</p>';
}

// 页面初始化
document.addEventListener("DOMContentLoaded", renderDetail);

/**
 * list.js —— 菜品列表页逻辑
 * 功能：口味标签筛选、全部菜品浏览
 * 支持从 URL 参数进入时自动选中标签：list.html?tag=麻辣
 */

// 当前选中的筛选标签，null 表示"全部"
let currentTag = null;

// 渲染筛选栏
function renderFilterBar() {
  const bar = document.getElementById("filterBar");
  let html = '<span class="filter-label">口味筛选：</span>';

  // "全部"按钮
  html += '<button class="filter-tag' + (currentTag === null ? " active" : "") +
    '" onclick="setFilter(null)">全部</button>';

  // 遍历全部口味标签
  ALL_TAGS.forEach(function (tag) {
    html += '<button class="filter-tag' + (currentTag === tag ? " active" : "") +
      '" onclick="setFilter(\'' + tag + '\')">' + tag + "</button>";
  });

  bar.innerHTML = html;
}

// 切换筛选标签
function setFilter(tag) {
  currentTag = tag;
  renderFilterBar();
  renderList();
}

// 渲染菜品列表
function renderList() {
  const grid = document.getElementById("dishGrid");
  const count = document.getElementById("resultCount");

  const list = currentTag === null
    ? DISHES
    : DISHES.filter(function (d) { return d.tags.indexOf(currentTag) !== -1; });

  count.innerHTML = currentTag === null
    ? "共 <b>" + list.length + "</b> 道菜品"
    : "口味「<b>" + currentTag + "</b>」共 <b>" + list.length + "</b> 道菜品";

  if (!list.length) {
    grid.innerHTML =
      '<div class="empty" style="grid-column: 1 / -1;">' +
        '<div class="empty-icon">🍽️</div>' +
        "<p>该口味下暂无菜品，看看其他口味吧～</p>" +
      "</div>";
    return;
  }

  grid.innerHTML = list.map(function (d) { return renderDishCard(d, { fav: true }); }).join("");
}

// 页面初始化
document.addEventListener("DOMContentLoaded", function () {
  // 读取 URL 中的标签参数（从卡片上的标签点击跳转过来）
  const params = new URLSearchParams(location.search);
  const tag = params.get("tag");
  if (tag && ALL_TAGS.indexOf(tag) !== -1) {
    currentTag = tag;
  }
  renderFilterBar();
  renderList();
});

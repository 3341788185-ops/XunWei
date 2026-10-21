/**
 * index.js —— 首页逻辑
 * 功能：热门口味标签渲染、口味关键词智能推荐、推荐结果展示
 */

// 渲染热门口味标签（点击即按标签推荐）
function renderHotTags() {
  const box = document.getElementById("hotTags");
  const label = box.querySelector(".hot-tag-label");
  box.innerHTML = "";
  box.appendChild(label);
  ALL_TAGS.slice(0, 8).forEach(function (tag) {
    const a = document.createElement("a");
    a.className = "hot-tag";
    a.href = "javascript:void(0)";
    a.textContent = tag;
    a.onclick = function () {
      document.getElementById("searchInput").value = tag;
      doSearch();
    };
    box.appendChild(a);
  });
}

// 渲染菜品列表
function renderDishes(list, title, emptyTip) {
  const grid = document.getElementById("dishGrid");
  const count = document.getElementById("resultCount");
  document.getElementById("resultTitle").textContent = title;

  if (!list.length) {
    count.textContent = "";
    grid.innerHTML =
      '<div class="empty" style="grid-column: 1 / -1;">' +
        '<div class="empty-icon">🤔</div>' +
        "<p>" + (emptyTip || "没有找到匹配的菜品，换个口味关键词试试吧～") + "</p>" +
        '<a class="section-link" href="index.html">看看热门推荐</a>' +
      "</div>";
    return;
  }

  count.textContent = list.length ? "共为你找到 " + list.length + " 道菜品" : "";
  grid.innerHTML = list
    .map(function (item) {
      // 智能推荐结果带匹配度；普通展示不带
      return item.score
        ? renderDishCard(item.dish, { score: item.score, fav: true })
        : renderDishCard(item.dish ? item.dish : item, { fav: true });
    })
    .join("");
}

// 执行口味关键词智能推荐
function doSearch() {
  const kw = document.getElementById("searchInput").value.trim();
  if (!kw) {
    showToast("请先输入口味关键词哦～");
    return;
  }
  const result = recommendByKeyword(kw, 12);
  if (result.length) {
    renderDishes(result, "“" + kw + "”的智能推荐");
  } else {
    // 兜底策略：无匹配时展示热门推荐
    renderDishes(getHotDishes(), "“" + kw + "”暂时没匹配到，为你推荐热门菜品");
  }
}

// 页面初始化
document.addEventListener("DOMContentLoaded", function () {
  renderHotTags();
  document.getElementById("searchBtn").onclick = doSearch;
  document.getElementById("searchInput").addEventListener("keydown", function (e) {
    if (e.key === "Enter") doSearch();
  });

  // 默认展示热门推荐
  renderDishes(getHotDishes(), "为你推荐");
});

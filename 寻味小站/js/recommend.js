/**
 * recommend.js —— 口味智能推荐检索模块（核心算法）
 *
 * 推荐原理：基于标签相似度匹配
 * 1. 建立"同义词词典"，把用户的自然口味描述（如"想吃点辣的""不辣""甜口"）
 *    映射到菜品口味标签（如 麻辣、酸辣、清淡、香甜……）
 * 2. 对每一道菜计算匹配得分：
 *      - 关键词直接命中口味标签        权重最高（+3）
 *      - 同义词映射命中标签            权重次之（+2）
 *      - 菜品名称包含关键词            +2
 *      - 简介文本包含关键词            +1
 *      - 关键词单字命中标签            +0.5
 * 3. 按得分从高到低排序，得分高者优先展示，即为"匹配度高优先展示"
 */

// 同义词词典：用户口语描述 -> 口味标签
const SYNONYMS = {
  "辣": ["麻辣", "酸辣"],
  "麻": ["麻辣"],
  "川菜": ["麻辣", "下饭"],
  "酸": ["酸辣"],
  "开胃": ["酸辣", "爽口"],
  "没胃口": ["酸辣", "爽口"],
  "甜": ["香甜"],
  "糖": ["香甜"],
  "甜口": ["香甜"],
  "咸": ["咸鲜"],
  "鲜": ["咸鲜"],
  "海鲜": ["咸鲜"],
  "淡": ["清淡"],
  "清爽": ["清淡", "爽口"],
  "不辣": ["清淡"],
  "清汤": ["清淡"],
  "粥": ["清淡"],
  "养胃": ["清淡"],
  "减肥": ["清淡", "爽口"],
  "低脂": ["清淡", "爽口"],
  "健康": ["清淡", "爽口"],
  "浓": ["浓郁"],
  "厚": ["浓郁"],
  "芝士": ["浓郁"],
  "奶": ["浓郁", "香甜"],
  "西餐": ["浓郁"],
  "脆": ["酥脆"],
  "香": ["咸鲜", "酥脆", "香甜"],
  "酥": ["酥脆"],
  "炸": ["酥脆"],
  "软": ["软糯"],
  "糯": ["软糯"],
  "米": ["软糯"],
  "饭": ["下饭"],
  "下饭": ["下饭"],
  "硬菜": ["下饭", "浓郁"],
  "肉": ["下饭", "咸鲜"]
};

/**
 * 计算一道菜与关键词的匹配得分
 * @param {string} keyword 用户输入的口味关键词（整段小写去空格）
 * @param {object} dish 菜品对象
 * @returns {number} 匹配得分
 */
function scoreDish(keyword, dish) {
  let score = 0;
  const text = dish.name + dish.intro + dish.desc;

  // 1) 关键词直接命中口味标签（双向包含即算命中）
  dish.tags.forEach(function (tag) {
    if (keyword.indexOf(tag) !== -1) {
      score += 3;
    }
  });

  // 2) 同义词映射命中：关键词里出现词典中的口语词，且对应标签属于该菜
  for (let word in SYNONYMS) {
    if (keyword.indexOf(word) !== -1) {
      SYNONYMS[word].forEach(function (tag) {
        if (dish.tags.indexOf(tag) !== -1) {
          score += 2;
        }
      });
    }
  }

  // 3) 菜品名称包含关键词
  if (dish.name.indexOf(keyword) !== -1) {
    score += 2;
  }

  // 4) 简介包含关键词
  if (text.indexOf(keyword) !== -1) {
    score += 1;
  }

  // 5) 关键词逐字命中标签（处理"我想吃酸"这类单字输入）
  if (keyword.length <= 4) {
    let charHit = 0;
    for (let i = 0; i < keyword.length; i++) {
      const ch = keyword.charAt(i);
      dish.tags.forEach(function (tag) {
        if (tag.indexOf(ch) !== -1) {
          charHit += 0.5;
        }
      });
    }
    score += charHit;
  }

  return score;
}

/**
 * 口味关键词智能推荐主函数
 * @param {string} keyword 用户输入的口味描述
 * @param {number} limit 最多返回条数，默认 12
 * @returns {Array<{dish: object, score: number}>} 按匹配度降序的推荐结果
 */
function recommendByKeyword(keyword, limit) {
  limit = limit || 12;
  const kw = (keyword || "").trim().toLowerCase().replace(/\s+/g, "");
  if (!kw) {
    return [];
  }

  // 给每道菜打分，只保留得分 > 0 的候选
  const scored = [];
  DISHES.forEach(function (dish) {
    const s = scoreDish(kw, dish);
    if (s > 0) {
      scored.push({ dish: dish, score: s });
    }
  });

  // 按匹配度从高到低排序（得分相同按 id 稳定排序）
  scored.sort(function (a, b) {
    if (b.score !== a.score) return b.score - a.score;
    return a.dish.id - b.dish.id;
  });

  return scored.slice(0, limit);
}

/**
 * 兜底策略：没有匹配到菜品时，返回热门推荐
 */
function getHotDishes() {
  return DISHES.filter(function (d) { return d.hot; });
}

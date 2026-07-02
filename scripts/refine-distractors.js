// 手工精修一批辨析题的干扰项：保留已核验正确的答案，替换掉“跨考点填充”干扰项，
// 让四个选项都围绕该题的辨析点。改动直接写回 index.html 的 genBank。
// 注意：这是对生成结果的人工润色；若重跑 generate-practice.js 会覆盖这些改动。
const fs = require("fs");
const path = require("path").join(__dirname, "..", "index.html");
let html = fs.readFileSync(path, "utf8");
const re = /(<script id="geo-data" type="application\/json">)([\s\S]*?)(<\/script>)/;
const m = html.match(re);
const D = JSON.parse(m[2]);

// 确定性洗牌（与站内一致的做法），让答案位置分散、跟着正确项走
function hashStr(s){let h=2166136261>>>0;for(let i=0;i<String(s).length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)>>>0;}return h>>>0;}
function shuffleWithAnswer(opts, correctIdx, seed){
  const arr=opts.map((o,i)=>({o,c:i===correctIdx}));
  let s=seed>>>0; const r=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return {options:arr.map(x=>x.o), answer:arr.findIndex(x=>x.c)};
}

// id -> 三个新的干扰项（都是关于该辨析点、看似合理但错误的说法）
const FIX = {
  "gen-b1u1-c1": ["陨石在太空中飞行时是天体，落到地面后仍然是天体。","流星体和陨石是同一种东西，只是大小不同。","流星现象就是陨石落到地面后燃烧发出的光。"],
  "gen-b1u1-c2": ["极光是太阳辐射（光和热）直接造成的。","太阳辐射和太阳活动是同一现象的两种叫法。","黑子、耀斑是太阳辐射稳定输出的正常组成部分。"],
  "gen-b1u1-c3": ["岩石圈就是地壳，两者完全相同。","岩石圈比地壳薄，只是地壳最上面的一层。","岩石圈 = 地壳 + 整个地幔。"],
  "gen-b1u1-c4": ["恐龙繁盛在古生代，蕨类大造煤发生在中生代。","中生代是三叶虫等海洋无脊椎动物最繁盛的时代。","古生代和中生代都不造煤，煤主要形成于新生代。"],

  "gen-b1u2-c1": ["V形谷是冰川刨蚀形成的，U形谷是流水下切形成的。","V形谷谷底宽平，U形谷两壁尖窄。","两者都是流水下切侵蚀形成的，只是深浅不同。"],
  "gen-b1u2-c2": ["冲积扇位于河流入海口，三角洲位于河流出山口。","冲积扇和三角洲都由风力堆积形成。","冲积扇和三角洲都只出现在河流上游河段。"],
  "gen-b1u2-c3": ["风化作用一定要有风参与，是被风吹造成的。","风力侵蚀是岩石在原地不移动地被破坏。","风化作用和风力侵蚀是同一个过程的两种叫法。"],
  "gen-b1u2-c4": ["钟乳石从洞底往上长，石笋从洞顶往下挂。","石笋和钟乳石都由流水下切侵蚀形成。","两者都发育在地表，而不是地下溶洞里。"],

  "gen-b1u3-c1": ["高空高压区的气压值，一定大于近地面低压区。","在垂直方向上，越往高处气压越高。","高压和低压可以跨不同高度直接比较大小。"],
  "gen-b1u3-c2": ["大气逆辐射是指射向宇宙空间的那部分辐射。","大气吸热后只射向地面，不向宇宙空间散失。","大气辐射只在白天发生，大气逆辐射只在夜晚发生。"],
  "gen-b1u3-c3": ["高空风受摩擦力影响，风向与等压线斜交。","近地面风没有摩擦力，风向与等压线平行。","无论高空还是近地面，风都垂直穿过等压线吹。"],
  "gen-b1u3-c4": ["白天吹山风，夜晚吹谷风。","谷风和山风都从山谷吹向山顶，方向相同。","山谷风由气压带季节移动造成，与昼夜冷热无关。"],

  "gen-b1u4-c1": ["海陆间循环的水量在三种循环中最大。","海上内循环能不断为陆地补充淡水。","陆地内循环是水量最大的水循环。"],
  "gen-b1u4-c2": ["海啸是由台风等强风引起的，属于气象灾害。","风暴潮由海底地震引起，属于地质灾害。","风暴潮和海啸都是由月球引力（潮汐）造成的。"],
  "gen-b1u4-c3": ["潮汐是风吹动海面形成的表面起伏。","洋流是海水每天有规律的涨落。","波浪是月球和太阳的引力吸引形成的。"],
  "gen-b1u4-c4": ["冰川融水在春季补给河流，季节性积雪融水在夏季。","季节性积雪融水主要补给西北的塔里木河。","冰川融水量的多少与气温高低无关。"],

  "gen-b1u5-c1": ["常绿阔叶林分布在温带北方，落叶阔叶林分布在亚热带南方。","落叶阔叶林一年四季常绿，从不落叶。","浙江的地带性植被是落叶阔叶林。"],
  "gen-b1u5-c2": ["土壤肥力主要由土层厚度决定，与有机质多少无关。","土层越厚，土壤就一定越肥沃。","有机质越少的土壤越肥沃。"],
  "gen-b1u5-c3": ["成土母质本身就含有大量有机质，肥力很高。","岩石碎裂成碎屑后就直接是土壤。","土壤和成土母质完全相同，没有区别。"],
  "gen-b1u5-c4": ["海拔越高，树木长得越高越好，没有上限。","林线是指山上森林分布的最低界线。","超过林线后气候更温暖，树木长得更茂密。"],

  "gen-x1u1-c1": ["地球离太阳越近就越热，近日点（1月）是北半球的夏天。","远日点在1月、近日点在7月。","地球公转速度在近日点最慢、远日点最快。"],
  "gen-x1u1-c2": ["北京时间就是北京（116°E）当地的地方时。","同一时刻，东八区内各城市的区时互不相同。","北京本地的地方时比“北京时间”早16分钟。"],
  "gen-x1u1-c3": ["极昼的最低纬度与太阳直射点纬度相等。","极昼最低纬度 + 直射点纬度 = 180°。","只要当天有太阳直射，全球任何纬度都会出现极昼。"],

  "gen-x3u2-c3": ["我国有大庆、胜利油田，石油完全能够自给自足。","我国石油对外依存度很低，进口只占很小一部分。","我国石油进口主要走北极航道，不经过马六甲海峡。"]
};

const genById = {};
(D.genBank || []).forEach(q => { genById[q.id] = q; });

let fixed = 0; const problems = [];
Object.keys(FIX).forEach(id => {
  const q = genById[id];
  if (!q) { problems.push(id + " 不存在"); return; }
  const correct = q.options[q.answer];
  const raw = [correct, ...FIX[id]];
  // 校验：4 个非空且互异
  if (raw.length !== 4 || raw.some(o => !o || !o.trim()) || new Set(raw).size !== 4) {
    problems.push(id + " 选项不满足“4个互异非空”：" + JSON.stringify(raw));
    return;
  }
  const sh = shuffleWithAnswer(raw, 0, hashStr(id + "-fix2"));
  q.options = sh.options;
  q.answer = sh.answer;
  fixed++;
});

if (problems.length) { console.error("发现问题，未写入：\n  " + problems.join("\n  ")); process.exit(1); }

html = html.replace(re, (f, a, b, c) => a + JSON.stringify(D) + c);
fs.writeFileSync(path, html);

// 答案位置分布自检
const spread = {};
Object.keys(FIX).forEach(id => { const a = genById[id].answer; spread[a] = (spread[a] || 0) + 1; });
console.log("已精修 " + fixed + " 道题的干扰项。答案位置分布：" + JSON.stringify(spread));

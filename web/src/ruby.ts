// 哈吉文 Ruby 核心（仅 4 个函数，给主页 markdown 渲染用）
// 完整工具页面仍然使用 ruby-demo.html

// ===== 数据：192 元素映射 =====

const VOWELS = ['o','i','u','e','a','v','ei','ai'] as const;
const V_OFF: Record<string,number> = { o:0, i:1, u:2, e:3, a:4, v:5, ei:6, ai:7 };

const CONTAINERS = [
  { l:'k', b:0xE200 },{ l:'g', b:0xE22A },{ l:'t', b:0xE254 },{ l:'d', b:0xE27E },
  { l:'x', b:0xE2A8 },{ l:'s', b:0xE2D2 },{ l:'h', b:0xE2FC },{ l:'m', b:0xE326 },
  { l:'p', b:0xE350 },{ l:'b', b:0xE37A },{ l:'n', b:0xE3A4 },{ l:'r', b:0xE3CE },
  { l:'l', b:0xE3F8 },{ l:'f', b:0xE422 },{ l:'j', b:0xE44C },{ l:'z', b:0xE476 },
  { l:'c', b:0xE4A0 },{ l:'zh',b:0xE4CA },{ l:'ch',b:0xE4F4 },{ l:'sh',b:0xE51E },
  { l:'q', b:0xE548 },{ l:'ng',b:0xE572 },
];

const sylMap: Record<string,number> = {};
CONTAINERS.forEach(c => VOWELS.forEach(v => { sylMap[c.l+v] = c.b + V_OFF[v]; }));
Object.assign(sylMap, { o:0xE000, i:0xE001, u:0xE002, e:0xE003, ei:0xE004, a:0xE005, v:0xE006, ai:0xE007 });
Object.assign(sylMap, { w:0xE002, y:0xE001, iu:0xE006, ou:0xE000, ao:0xE000 });

const defaultA: Record<string,string> = {
  ko:'可',ki:'基',ku:'库',ke:'克',ka:'卡',kv:'屈',kei:'凯',kai:'开',
  go:'戈',gi:'吉',gu:'古',ge:'格',ga:'加',gv:'居',gei:'给',gai:'盖',
  to:'托',ti:'提',tu:'图',te:'特',ta:'塔',tv:'蒂',tei:'泰',tai:'泰',
  do:'多',di:'迪',du:'杜',de:'德',da:'达',dv:'杜',dei:'戴',dai:'戴',
  xo:'肖',xi:'西',xu:'休',xe:'谢',xa:'夏',xv:'许',xei:'谢',xai:'夏',
  so:'索',si:'斯',su:'苏',se:'塞',sa:'萨',sv:'叙',sei:'塞',sai:'塞',
  ho:'霍',hi:'希',hu:'胡',he:'赫',ha:'哈',hv:'许',hei:'黑',hai:'海',
  mo:'莫',mi:'米',mu:'穆',me:'梅',ma:'马',mv:'缪',mei:'梅',mai:'迈',
  po:'波',pi:'皮',pu:'普',pe:'佩',pa:'帕',pv:'皮',pei:'佩',pai:'派',
  bo:'博',bi:'比',bu:'布',be:'贝',ba:'巴',bv:'比',bei:'贝',bai:'拜',
  no:'诺',ni:'尼',nu:'努',ne:'内',na:'那',nv:'纽',nei:'内',nai:'奈',
  ro:'若',ri:'里',ru:'鲁',re:'热',ra:'拉',rv:'吕',rei:'雷',rai:'莱',
  lo:'洛',li:'利',lu:'卢',le:'勒',la:'拉',lv:'吕',lei:'莱',lai:'莱',
  fo:'福',fi:'菲',fu:'弗',fe:'费',fa:'法',fv:'菲',fei:'费',fai:'法',
  jo:'乔',ji:'吉',ju:'朱',je:'杰',ja:'贾',jv:'居',jei:'杰',jai:'贾',
  zo:'佐',zi:'齐',zu:'祖',ze:'泽',za:'扎',zv:'齐',zei:'泽',zai:'宰',
  co:'措',ci:'齐',cu:'楚',ce:'策',ca:'察',cv:'曲',cei:'采',cai:'采',
  zho:'卓',zhi:'之',zhu:'朱',zhe:'哲',zha:'扎',zhv:'朱',zhei:'哲',zhai:'翟',
  cho:'乔',chi:'奇',chu:'楚',che:'车',cha:'查',chv:'曲',chei:'柴',chai:'柴',
  sho:'硕',shi:'石',shu:'书',she:'舍',sha:'沙',shv:'书',shei:'谁',shai:'晒',
  qo:'桥',qi:'奇',qu:'区',qe:'切',qa:'恰',qv:'区',qei:'青',qai:'千',
  ngo:'俄',ngi:'凝',ngu:'吴',nge:'能',nga:'昂',ngv:'于',ngei:'凝',ngai:'艾',
  o:'奥',i:'伊',u:'乌',e:'厄',a:'阿',v:'于',ai:'艾',ei:'埃',
};

// ===== A/B/C 选字池（给 picker UI 用） =====

const charPool: Record<'A' | 'B', Record<string, string[]>> & { C: Record<string, string> } = {
  A: {
    ko:['科','可','柯','克'], ki:['基','奇','其','琪'], ku:['库','酷','苦'], ke:['克','刻','可'], ka:['卡','喀'], kai:['开','凯','楷'], kei:['凯','楷'], kv:['曲','屈','区'],
    go:['戈','歌','哥'], gi:['吉','基','及'], gu:['古','谷','故'], ge:['格','戈','各'], ga:['加','盖','该'], gai:['盖','该','改'], gei:['给'], gv:['居','巨','具'],
    to:['托','拓','脱'], ti:['提','体','替'], tu:['图','突','涂'], te:['特','忒'], ta:['塔','他','它'], tai:['太','泰','态'], tei:['泰','太'], tv:['图','涂','途'],
    do:['多','朵','铎'], di:['迪','第','地'], du:['杜','笃','读'], de:['德','得'], da:['达','大','答'], dai:['代','待','戴'], dei:['代','黛'], dv:['杜','都','度'],
    xo:['索','梭','所'], xi:['西','希','锡'], xu:['许','徐','须'], xe:['谢','协','写'], xa:['沙','夏','侠'], xai:['谢','谐','懈'], xei:['西','希','锡'], xv:['许','虚','徐'],
    so:['索','梭','所'], si:['斯','司','丝'], su:['苏','素','速'], se:['塞','色','涩'], sa:['萨','撒'], sai:['赛','塞','腮'], sei:['塞','色'], sv:['苏','胥'],
    ho:['霍','和','火'], hi:['希','喜'], hu:['胡','呼','虎'], he:['赫','和','何','合'], ha:['哈'], hai:['海','亥'], hei:['黑','嘿'], hv:['许','虚'],
    mo:['莫','摩','默'], mi:['米','密','弥'], mu:['穆','木','姆'], me:['么','墨','默'], ma:['马','玛','吗'], mai:['迈','麦','卖'], mei:['梅','美','玫'], mv:['穆','牧','目'],
    po:['波','珀','坡'], pi:['皮','匹','批'], pu:['普','浦','葡'], pe:['珀','迫','魄'], pa:['帕','怕','爬'], pai:['派','湃','排'], pei:['佩','沛','配'], pv:['普','葡','浦'],
    bo:['波','博','伯'], bi:['比','毕','必'], bu:['布','不','步'], be:['伯','帛','驳'], ba:['巴','芭','吧'], bai:['白','百','拜'], bei:['贝','北','杯'], bv:['布','比','毕'],
    no:['诺','娜'], ni:['尼','妮'], nu:['努','奴'], ne:['内','纳'], na:['那','娜','纳'], nai:['奈','耐','奶'], nei:['内'], nv:['女'],
    ro:['若','弱'], ri:['日'], ru:['如','儒','汝'], re:['尔','耳','而'], ra:['拉','喇','腊'], rai:['来','莱','赖'], rei:['瑞','蕊','锐'], rv:['如','汝','儒'],
    lo:['洛','罗','骆'], li:['利','里','莉'], lu:['卢','路','鲁'], le:['勒','乐'], la:['拉','腊','喇'], lai:['来','莱','赖'], lei:['雷','蕾','泪'], lv:['吕','绿','律'],
    fo:['佛'], fi:['菲','费','非'], fu:['夫','福','服'], fe:['菲','非','飞'], fa:['法','发','罚'], fai:['菲','斐'], fei:['菲','飞','非'], fv:['夫','孚'],
    jo:['若','弱'], ji:['吉','基','及'], ju:['居','巨','具'], je:['杰','捷','洁'], ja:['扎','乍','加'], jai:['介','芥','界'], jei:['杰','捷'], jv:['居','巨','举'],
    zo:['左','佐','做'], zi:['兹','子','资'], zu:['祖','足','组'], ze:['泽','则','择'], za:['扎','杂','匝'], zai:['在','载','再'], zei:['泽','则'], zv:['祖','组','阻'],
    co:['措','错','撮'], ci:['次','此','刺'], cu:['粗','促','簇'], ce:['策','侧','册'], ca:['擦'], cai:['才','材','财'], cei:['翠','萃','粹'], cv:['取','趣','渠'],
    zho:['卓','着'], zhi:['之','芝','知'], zhu:['朱','住','注'], zhe:['者','这','折'], zha:['扎','札','闸'], zhai:['斋','宅','翟'], zhei:['真','珍','贞'], zhv:['朱','主','竹'],
    cho:['绰','辍'], chi:['赤','吃','驰'], chu:['楚','出','初'], che:['彻','车','扯'], cha:['查','察','茶'], chai:['柴','差','拆'], chei:['陈','辰','晨'], chv:['楚','处','出'],
    sho:['硕','说','朔'], shi:['石','十','史'], shu:['书','舒','树'], she:['舍','奢','设'], sha:['沙','莎','啥'], shai:['晒','筛'], shei:['谁'], shv:['书','舒','殊'],
    qo:['却','确','雀'], qi:['其','奇','琪'], qu:['区','曲','去'], qe:['且','切'], qa:['恰','洽'], qai:['千','迁','签'], qei:['青','清','晴'], qv:['却','确','雀'],
    ngo:['俄','哦','娥'], ngi:['尼','宁','凝'], ngu:['乌','吴','吾'], nge:['嗯','能'], nga:['昂'], ngai:['艾','爱','哀'], ngei:['尼','宁','凝'], ngv:['于','语','玉'],
    o:['奥'], i:['伊'], u:['乌'], e:['厄'], a:['阿'], v:['于'], ai:['艾'], ei:['埃'],
  },
  B: {
    ko:['歌','鸽','珂'], ki:['琦','祈','麒'], ku:['枯','窟'], ke:['客','恪'], ka:['咖'], kai:['恺','铠'], kv:['渠'],
    go:['鸽','葛','舸'], gi:['玑','矶'], gu:['顾','鼓','崮'], ge:['葛','阁','舸'], gai:['垓'], gv:['琚'],
    to:['驼','砣'], ti:['蹄','鹈'], tu:['兔','屠'], ta:['獭','沓'], tai:['岱','苔'], tv:['荼','菟'],
    do:['舵'], di:['荻','笛'], du:['犊'], da:['搭'], dai:['黛','岱','玳'],
    xo:['笑','啸','萧'], xi:['溪','汐','熙'], xu:['煦','墟','栩'], xe:['榭'], xa:['霞','暇','瑕'], xei:['曦','熹'], xv:['栩','煦','胥'],
    so:['琐'], si:['思','寺'], su:['酥','溯'], se:['瑟'], sa:['飒'], sv:['谡','稣'],
    ho:['鹤','荷','壑'], hi:['熹','汐'], hu:['瑚','浒'], he:['荷','河','鹤'], hai:['骸'], hv:['栩','煦'],
    mo:['猫','漠','茉'], mi:['蜜','觅','幂'], mu:['暮','牧','慕'], me:['玫','梅'], ma:['码'], mai:['霾'], mei:['莓','媚','湄'], mv:['睦','沐'],
    po:['泊','皤'], pi:['琵','霹'], pu:['蒲','瀑','圃'], pe:['佩'], pa:['琶','葩'], pai:['徘'], pei:['霈','辔'], pv:['蒲','璞'],
    bo:['舶','帛'], bi:['璧','碧'], bu:['埠'], be:['柏','北'], ba:['疤','笆'], bai:['柏','伯'], bei:['蓓','碑'], bv:['璧'],
    no:['糯'], ni:['霓','鲵'], nu:['弩'], ne:['讷'],
    ra:['蜡'], rai:['籁'], rei:['芮'], rv:['茹'],
    lo:['珞','萝'], li:['璃','骊','漓'], lu:['鹭','麓','芦'], le:['泐'], la:['剌'], lai:['籁'], lei:['磊','垒'], lv:['缕','闾'],
    fi:['霏','翡'], fu:['芙','凫','釜'], fe:['绯','霏'], fa:['筏'], fai:['翡','霏'], fei:['绯','翡','霏'], fv:['芙','凫'],
    ji:['霁','骥','矶'], ju:['琚','驹','橘'], je:['玦','碣'], ja:['迦','珈','笳'], jai:['玠'], jv:['琚','裾','榉'],
    zo:['凿'], zi:['梓','紫'], zu:['卒','族'], ze:['仄'], za:['砸'],
    co:['厝'], ci:['瓷','磁'], cu:['蔟'], cai:['采','彩'], cv:['璩'],
    zho:['灼','濯'], zhi:['芷','枳','雉'], zhu:['珠','筑','竹'], zhe:['柘','鹧'], zhai:['寨'], zhei:['砧'], zhv:['珠','烛','筑'],
    chi:['鸱','墀'], chu:['滁','雏','储'], che:['澈'], cha:['槎'], chai:['钗'], chei:['宸'], chv:['滁','雏'],
    shi:['轼'], shu:['姝','漱'], she:['蛇','麝'], sha:['鲨','刹','纱'], shv:['姝','纾'],
    qo:['鹊','桥'], qi:['琦','祺','麒'], qu:['渠','蕖'], qai:['阡','芊'], qei:['卿'],
    ngo:['峨','鹅'], ngu:['悟','梧','鹜','坞'], ngai:['隘'], ngv:['瑀'],
  },
  C: {
    wu:'无', tu:'土', di:'地', de:'金', da:'石', xi:'水', si:'时', sa:'上', ba:'反', ja:'光', zhi:'火', she:'黑',
  },
};

// ===== 用户选字：持久化 + 读取 + 重置 =====

const CHOICES_KEY = 'haji_ruby_choices_v2';

function loadChoices(): Record<string, string> {
  try {
    const raw = (typeof localStorage !== 'undefined' ? localStorage.getItem(CHOICES_KEY) : null);
    return raw ? JSON.parse(raw) as Record<string, string> : {};
  } catch { return {}; }
}

let userChoices: Record<string, string> = loadChoices();

function persistChoices() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(CHOICES_KEY, JSON.stringify(userChoices));
    }
  } catch { /* ignore */ }
}

export function setHanChoice(syl: string, han: string) {
  syl = syl.toLowerCase();
  const def = defaultA[syl];
  if (han === def || han === syl) {
    delete userChoices[syl];
  } else {
    userChoices[syl] = han;
  }
  persistChoices();
}

export function resetHanChoice(syl: string) {
  syl = syl.toLowerCase();
  if (syl in userChoices) {
    delete userChoices[syl];
    persistChoices();
  }
}

export function resetAllHanChoices() {
  userChoices = {};
  persistChoices();
}

export function getAllHanChoices(): Record<string, string> {
  return { ...userChoices };
}

export function getHanOptions(syl: string): string[] {
  syl = syl.toLowerCase();
  const a = charPool.A[syl] || [];
  const b = charPool.B[syl] || [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const ch of [...a, ...b]) {
    if (!seen.has(ch)) { seen.add(ch); result.push(ch); }
  }
  if (result.length === 0) {
    const def = defaultA[syl];
    if (def) result.push(def);
  }
  return result;
}

// — tokenize 的字符分类（供阅读 FSM）—
//   DBL  = 双字母辅音声母（zh / ch / sh / ng），占 2 个字符
//   VW   = 双字母韵母（ai / ei / iu），占 2 个字符
//   VS   = 单字母韵母（o / i / u / e / a / v），占 1 个字符
//
//   FSM 共 3 层尝试，按"最长匹配优先"从 i 位置贪心推进：
//     第 1 层 → 看看当前位置是不是 DBL（双字母声母）开头：
//                是 → 再看下一位是不是 VW（双字母韵母），是就拼 d+v，跳 3-4 字
//                         不是 VW 就再看是不是 VS（单字母韵母），是就拼 d+VS，跳 3 字
//                         都不是 → 单独作声母 d，跳 2 字
//     第 2 层 → 看看是不是单字母声母（k/g/t/d/x/s/h/m/p/b/n/r/l/f/j/z/c/q 等）：
//                是 → 再看下一位是不是 VW（双字母韵母），是就拼 c+v，跳 3 字
//                         不是 VW 就再看是不是 VS（单字母韵母），是就拼 c+VS，跳 2 字
//                         都不是 → 单独作声母 c，跳 1 字
//     第 3 层 → 看看是不是元音/韵母单独出现（ai/ei/iu/ou/ao）：
//                是 → 作为一个音节，跳 2 字
//                都不是 → 当前字符原样保留（如标点/空格），跳 1 字
const DBL = ['zh','ch','sh','ng'];
const VW = ['ai','ei','iu'];
const VS = 'oiueav';

export function tokenize(word: string): string[] {
  const tokens: string[] = [];
  const w = word.toLowerCase();
  let i = 0;
  while (i < w.length) {
    let hit = false;

    // —— 第 1 层：双字母声母开头 ——
    for (const d of DBL) {
      if (w.startsWith(d, i)) {
        // 再拼一个双字母韵母 → 3~4 字符音节（如 zhai, shei, chong[不，ch+ong 不等长]）
        for (const v of VW) {
          if (w.startsWith(v, i + d.length)) {
            tokens.push(d + v);
            i += d.length + v.length;
            hit = true;
            break;
          }
        }
        if (hit) break;
        // 或拼一个单字母韵母 → 3 字符音节（如 zhu, shi, nga）
        if (VS.includes(w[i + d.length] ?? '')) {
          tokens.push(d + w[i + d.length]);
          i += d.length + 1;
          hit = true;
          break;
        }
        // 单独一个双字母声母（罕见，如词末 ng）
        tokens.push(d);
        i += d.length;
        hit = true;
        break;
      }
    }
    if (hit) continue;

    // —— 第 2 层：单字母声母开头 ——
    if ('kgtdxshmpbnrlfjzcq'.includes(w[i] ?? '')) {
      // 再拼一个双字母韵母 → 3 字符音节（如 kai, pei）
      for (const v of VW) {
        if (w.startsWith(v, i + 1)) {
          tokens.push(w[i] + v);
          i += 1 + v.length;
          hit = true;
          break;
        }
      }
      if (hit) continue;
      // 或拼一个单字母韵母 → 2 字符音节（如 ko, du, ma）
      if (VS.includes(w[i + 1] ?? '')) {
        tokens.push(w.slice(i, i + 2));
        i += 2;
        continue;
      }
      // 单独一个声母（罕见，如词末辅音）
      tokens.push(w[i]);
      i += 1;
      continue;
    }

    // —— 第 3 层：纯元音开头或特殊双字母音节 ——
    for (const v of [...VW, 'ou', 'ao']) {
      if (w.startsWith(v, i)) {
        tokens.push(v);
        i += v.length;
        hit = true;
        break;
      }
    }
    if (hit) continue;

    // —— 兜底：非哈吉文字符（标点/空格等），原样保留 ——
    tokens.push(w[i]);
    i += 1;
  }
  return tokens;
}

export function toPua(s: string): string {
  const c = sylMap[s]; return c !== undefined ? String.fromCodePoint(c) : s;
}

export function toHan(s: string): string {
  return userChoices[s.toLowerCase()] || defaultA[s.toLowerCase()] || s;
}

/** 把 "mogu naxomi qoko" 转成 ruby HTML（逐词，每个词内部逐音节） */
export function buildTermRuby(input: string): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  return words.map(w => {
    if (w.startsWith('<') && w.endsWith('>')) {
      // 整词标注：一个 ruby 包裹，但每个汉字包独立 span 以求逐字可点
      const inner = w.slice(1, -1).toLowerCase();
      const syls = tokenize(inner);
      const hanSpans = syls.map(s =>
        `<span class="ruby-clickable" data-syl="${s}">${toHan(s)}</span>`
      ).join('');
      const pua = syls.map(toPua).join('');
      return `<ruby class="haji-term">${hanSpans}<rt>${pua}</rt></ruby>`;
    }
    // 逐字标注：每个音节一个独立 ruby
    const syls = tokenize(w.toLowerCase());
    return syls.map(s =>
      `<ruby class="haji-term ruby-clickable" data-syl="${s}">${toHan(s)}<rt>${toPua(s)}</rt></ruby>`
    ).join('');
  }).join('');
}

/**
 * 把"中文 + 哈吉语词汇"混写的句子转成 ruby HTML。
 * 规则：只有连续的拉丁字母序列会被当作哈吉语词汇做注音，
 *       中文、标点、空格、换行全部原样保留。
 * 例如："我来到 mogu naxomi 山下。" → 中文原样，mogu/naxomi 各自加 ruby
 */
export function buildSentenceRuby(input: string): string {
  // Step 1: 保护 HTML 实体（&quot; &amp; &#123; &#xAB; 等），避免内部字母被当作哈吉语
  const placeholders: string[] = [];
  const protectedInput = input.replace(/&[a-zA-Z]+;|&#\d+;|&#x[0-9a-fA-F]+;/g, (match) => {
    placeholders.push(match);
    return "\x01" + (placeholders.length - 1) + "\x01";
  });

  // Step 2: 分块：拉丁字母（含撇号/连字符） vs 其它字符，交替出现
  const chunks = protectedInput.split(/([a-zA-Z]+(?:['\u2019\-][a-zA-Z]+)*)/g).filter(c => c.length > 0);

  // Step 3: 处理 ruby 注音
  const processed = chunks.map(chunk => {
    if (chunk.indexOf("\x01") !== -1) return chunk;
    if (/^[a-zA-Z'\u2019\-]+$/.test(chunk)) {
      const syls = tokenize(chunk.toLowerCase());
      return syls.map(s =>
        `<ruby class="haji-term ruby-clickable" data-syl="${s}">${toHan(s)}<rt>${toPua(s)}</rt></ruby>`
      ).join("");
    }
    return chunk;
  }).join("");

  // Step 4: 还原 HTML 实体
  return processed.replace(/\x01(\d+)\x01/g, (_, idx) => placeholders[Number(idx)]);
}

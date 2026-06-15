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

// ===== 核心函数 =====

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
  return defaultA[s] || s;
}

/** 把 "mogu naxomi qoko" 转成 ruby HTML（逐词，每个词内部逐音节） */
export function buildTermRuby(input: string): string {
  const words = input.trim().split(/\s+/).filter(Boolean);
  return words.map(w => {
    // 支持 <word> 整词标注
    if (w.startsWith('<') && w.endsWith('>')) {
      const inner = w.slice(1, -1).toLowerCase();
      const syls = tokenize(inner);
      const han = syls.map(toHan).join('');
      const pua = syls.map(toPua).join('');
      return `<ruby class="haji-term">${han}<rt>${pua}</rt></ruby>`;
    }
    // 逐字标注
    const syls = tokenize(w.toLowerCase());
    return syls.map(s =>
      `<ruby class="haji-term">${toHan(s)}<rt>${toPua(s)}</rt></ruby>`
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
  // 分块：拉丁字母（含撇号/连字符） vs 其它字符，交替出现
  const chunks = input.split(/([a-zA-Z]+(?:['’\-][a-zA-Z]+)*)/g).filter(c => c.length > 0);
  return chunks.map(chunk => {
    // 纯字母块 → 当作哈吉语 → ruby 逐词逐音节注音
    if (/^[a-zA-Z'’\-]+$/.test(chunk)) {
      const syls = tokenize(chunk.toLowerCase());
      return syls.map(s =>
        `<ruby class="haji-term">${toHan(s)}<rt>${toPua(s)}</rt></ruby>`
      ).join('');
    }
    // 其它字符（中文 / 标点 / 空格 / 换行）→ 原样保留
    return chunk;
  }).join('');
}

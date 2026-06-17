# -*- coding: utf-8 -*-
"""
Ξ 场魔法体系 — 概念可视化 v1.0
"""
import numpy as np
import matplotlib.pyplot as plt
from matplotlib import rcParams
import matplotlib.patches as mpatches

# 全局样式
rcParams['font.sans-serif'] = ['Microsoft YaHei', 'SimHei',
                                  'Arial Unicode MS', 'DejaVu Sans']
rcParams['axes.unicode_minus'] = False
rcParams['figure.dpi'] = 160
rcParams['savefig.dpi'] = 160

# 统一配色
COLOR = {
    'o_point':   '#C0392B',
    'f_curve':   '#2874A6',
    'f_soft':    '#5499C7',
    'peak':      '#1E8449',
    'peak_soft': '#58D68D',
    'xi':        '#6C3483',
    'self_cost': '#D68910',
    'overflow':  '#239B56',
    'dissociate': '#BA4A00',
    'repair':    '#239B56',
    'layer1':    '#A23B72',
    'layer2':    '#F18F01',
    'layer3':    '#C73E1D',
    'ancient':   '#2874A6',
    'silent':    '#7D3C98',
    'empire':    '#148F77',
    'warring':   '#B7950B',
    'grid':      '#E5E7E9',
    'ink':       '#2C3E50',
}


def _wm(ax, note):
    ax.text(0.99, 0.015, note, transform=ax.transAxes,
            ha='right', va='bottom', fontsize=7.5, color='#7F8C8D',
            style='italic')


def save(name):
    plt.tight_layout()
    out = 'E:\\哈吉语创制计划\\文创相关\\images\\{}.png'.format(name)
    plt.savefig(out, bbox_inches='tight', facecolor='white')
    print('  ✓ ' + out)
    plt.close()


# ========== 图 1：效率分布函数 f(n) ==========
def fig_01_efficiency_curve():
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))
    n = np.linspace(0, 1400, 500)
    o_point = 1000
    width = 180

    # 左图：不同 f 中心位置
    ax = axes[0]
    for center, c, lbl in [
        (300, COLOR['layer1'], 'f中心=300\n(帝国早期)'),
        (550, COLOR['layer2'], 'f中心=550\n(帝国中后期)'),
        (750, COLOR['layer3'], 'f中心=750\n(战国)'),
    ]:
        f = 1.0 / (1.0 + ((n - center) / width) ** 2)
        ax.plot(n, f, color=c, linewidth=2.2, label=lbl)
        ax.axvline(x=center, color=c, linestyle=':', alpha=0.45, linewidth=1)
    ax.axvline(x=o_point, color=COLOR['o_point'], linestyle='--',
               linewidth=1.8, label='o基准点 n=1000')
    ax.set_xlabel('复杂度参数 n', fontsize=11, color=COLOR['ink'])
    ax.set_ylabel('相对效率 f(n)', fontsize=11, color=COLOR['ink'])
    ax.set_title('不同 f 中心位置下的工作窗口',
                  fontsize=13, fontweight='bold', color=COLOR['ink'])
    ax.set_xlim(0, 1300); ax.set_ylim(0, 1.1)
    ax.grid(True, alpha=0.25, color=COLOR['grid'])
    ax.legend(loc='upper right', fontsize=8.5, framealpha=0.9)
    _wm(ax, '形态来自 txt 原文描述；具体宽度参数为示意值')

    # 右图：不同环境陡峭度
    ax = axes[1]
    center = 550
    for w, c, lbl in [
        (90, '#1F618D', '稳定环境（陡峭）'),
        (180, '#2874A6', '一般环境'),
        (360, '#7FB3D5', '动荡环境（扁平）'),
    ]:
        f = 1.0 / (1.0 + ((n - center) / w) ** 2)
        ax.plot(n, f, color=c, linewidth=2.2, label=lbl)
    ax.axvline(x=center, color=COLOR['f_soft'], linestyle=':', alpha=0.6)
    ax.axvline(x=o_point, color=COLOR['o_point'], linestyle='--', linewidth=1.5, alpha=0.6)
    ax.annotate('窄峰：需精准匹配', xy=(center + 80, 1.0 / (1.0 + (80 / 90) ** 2)),
                  xytext=(750, 0.75), fontsize=9, color='#1F618D',
                  arrowprops=dict(arrowstyle='->', color='#1F618D', lw=1))
    ax.annotate('宽峰：容错率高但峰值低',
                  xy=(center + 280, 1.0 / (1.0 + (280 / 360) ** 2)),
                  xytext=(150, 0.2), fontsize=9, color='#7FB3D5',
                  arrowprops=dict(arrowstyle='->', color='#7FB3D5', lw=1))
    ax.set_xlabel('复杂度参数 n', fontsize=11, color=COLOR['ink'])
    ax.set_ylabel('相对效率 f(n)', fontsize=11, color=COLOR['ink'])
    ax.set_title('环境稳定性对效率曲线形态的影响',
                  fontsize=13, fontweight='bold', color=COLOR['ink'])
    ax.set_xlim(0, 1300); ax.set_ylim(0, 1.1)
    ax.grid(True, alpha=0.25, color=COLOR['grid'])
    ax.legend(loc='upper right', fontsize=8.5, framealpha=0.9)
    _wm(ax, 'txt 原文「环境稳定性影响陡峭度；陡峭度为示意值')

    fig.suptitle('图1 效率分布函数 f(n)', fontsize=14,
                   fontweight='bold', y=1.02, color=COLOR['ink'])
    save('01_efficiency_curve')


# ========== 图 2：复杂度 — 峰值效率关系 ==========
def fig_02_peak_efficiency():
    fig, ax = plt.subplots(figsize=(11, 6))
    o_point = 1000
    n = np.linspace(50, 2500, 500)
    peak = np.where(n <= o_point, n / o_point, o_point / n)

    ax.plot(n, peak, color=COLOR['peak'], linewidth=2.8, zorder=5)
    ax.fill_between(n, 0, peak, color=COLOR['peak_soft'], alpha=0.15)
    ax.axvline(x=o_point, color=COLOR['o_point'], linestyle='--', linewidth=2, label='o基准点 n=1000')
    ax.scatter([o_point], [1.0], color=COLOR['o_point'], s=130, zorder=10, edgecolors='black', linewidth=1.5)
    ax.annotate('o点：效率峰值=1.0', xy=(o_point, 1.0), xytext=(o_point - 550, 0.9),
               fontsize=10, color=COLOR['o_point'], fontweight='bold',
               arrowprops=dict(arrowstyle='->', color=COLOR['o_point'], lw=1.5))

    for lo, hi, c, lbl in [
        (200, 400, COLOR['layer1'], '第一层 机械振子\n(复杂度最低)'),
        (400, 700, COLOR['layer2'], '第二层 双n点系统\n(中等复杂度)'),
        (750, 900, COLOR['layer3'], '第三层 大脑神经\n(高复杂度)'),
    ]:
        ax.axvspan(lo, hi, alpha=0.15, color=c)
    ax.set_xlabel('载体系统固有复杂度 n', fontsize=12, color=COLOR['ink'])
    ax.set_ylabel('相对峰值效率', fontsize=12, color=COLOR['ink'])
    ax.set_title('复杂度 峰值效率关系：o点天然上限',
                   fontsize=14, fontweight='bold', color=COLOR['ink'])
    ax.set_xlim(0, 2400); ax.set_ylim(0, 1.15)
    ax.grid(True, alpha=0.2, color=COLOR['grid'])
    ax.text(300, 0.15, '低于o点：\n效率正比于复杂度', fontsize=10,
             color='#186A3B', fontweight='bold',
             bbox=dict(boxstyle='round,pad=0.4', facecolor='#EAFAF1', edgecolor='#ABEBC6', linewidth=1.2))
    ax.text(1500, 0.15, '高于o点：\n效率反比于复杂度\n(边际收益递减)',
             fontsize=10, color='#BA4A00', fontweight='bold',
             bbox=dict(boxstyle='round,pad=0.4', facecolor='#FDEBD0', edgecolor='#F5CBA7', linewidth=1.2))
    _wm(ax, '低正比高反比形态来自 txt 原文；技术区间为定性标注')
    save('02_peak_efficiency')


# ========== 图 3：蓄势弹簧效应 — 能量分配 ==========
def fig_03_spring_energy():
    fig, ax = plt.subplots(figsize=(11, 6))
    t = np.linspace(0, 10, 300)
    input_base = 1.0
    oscillation = 0.08 * np.sin(2 * np.pi * t / 2.5)
    E_xi = input_base * (1.0 + oscillation)
    self_ratio = 0.90 - 0.30 * np.exp(-t / 4.0)
    E_self = E_xi * self_ratio
    E_overflow = E_xi - E_self

    ax.fill_between(t, 0, E_self, alpha=0.55, color=COLOR['self_cost'],
                     label='系统自耗（推动 n→o 的做功）')
    ax.fill_between(t, E_self, E_xi, alpha=0.55, color=COLOR['overflow'],
                     label='溢出部分（可被利用的 Ξ 动能）')
    ax.plot(t, E_xi, color=COLOR['xi'], linewidth=2.2, label='Ξ附加动能总量')
    ax.plot(t, E_self, color=COLOR['self_cost'], linewidth=1.8, linestyle='--', alpha=0.7)
    ax.plot(t, E_overflow, color=COLOR['overflow'], linewidth=1.8, linestyle='--', alpha=0.7)

    ax.set_xlabel('时间（振动周期，示意单位）', fontsize=11, color=COLOR['ink'])
    ax.set_ylabel('能量（相对单位）', fontsize=11, color=COLOR['ink'])
    ax.set_title('蓄势弹簧效应：外部输入 → Ξ动能 → 自耗 + 溢出',
                  fontsize=13, fontweight='bold', color=COLOR['ink'])
    ax.set_xlim(0, 10); ax.set_ylim(0, 1.25)
    ax.grid(True, alpha=0.2, color=COLOR['grid'])
    ax.legend(loc='upper right', fontsize=9, framealpha=0.9)
    _wm(ax, '能量分配定性趋势来自 txt；比例为示意值')
    save('03_spring_energy')


# ========== 图 4：复杂度解离 超线性代价 ==========
def fig_04_dissociation():
    fig, ax = plt.subplots(figsize=(10, 6.5))
    x = np.linspace(0.1, 2.5, 400)
    for alpha, c, ls, lbl in [
        (1.3, '#7FB3D5', '--', '指数=1.3（较温和）'),
        (1.585, COLOR['dissociate'], '-', '指数=1.585（2^1.585≈3）'),
        (1.9, '#78281F', '--', '指数=1.9（更激进）'),
    ]:
        y = x ** alpha
        ax.plot(x, y, color=c, linestyle=ls, linewidth=2, label=lbl, alpha=0.85)
    ax.axhline(y=1.0, color=COLOR['repair'], linestyle=':', linewidth=2.2,
                label='自主修复能力上限')
    mask_safe = (x ** 1.585) <= 1.0
    ax.fill_between(x, 0, 1.0, where=mask_safe, alpha=0.18, color=COLOR['repair'],
                     label='安全窗口（解离速度≤修复速度）')
    ax.fill_between(x, 0, x ** 1.585, where=~mask_safe, alpha=0.18,
                      color=COLOR['dissociate'],
                      label='不可逆损伤区')
    ax.scatter([1.0], [1.0], color=COLOR['repair'], s=120, zorder=10,
                edgecolors='black', linewidth=1.5)
    ax.text(1.05, 1.1, '安全上限 强度=1.0', fontsize=9, color=COLOR['repair'],
             fontweight='bold')
    ax.scatter([2.0], [2.0 ** 1.585], color=COLOR['dissociate'], s=120, zorder=10,
                edgecolors='black', linewidth=1.5)
    ax.annotate('txt原文点：强度翻倍 → 解离三倍', xy=(2.0, 2.0 ** 1.585),
                xytext=(1.2, 3.5), fontsize=10, color=COLOR['dissociate'],
                fontweight='bold',
                arrowprops=dict(arrowstyle='->', color=COLOR['dissociate'], lw=1.5))
    ax.set_xlabel('施法强度（相对基准）', fontsize=11, color=COLOR['ink'])
    ax.set_ylabel('结构解离速度（相对单位）', fontsize=11, color=COLOR['ink'])
    ax.set_title('复杂度解离效应：超线性代价 + 安全窗口',
                  fontsize=13, fontweight='bold', color=COLOR['ink'])
    ax.set_xlim(0, 2.5); ax.set_ylim(0, 4.5)
    ax.grid(True, alpha=0.2, color=COLOR['grid'])
    ax.legend(loc='upper left', fontsize=8.5, framealpha=0.9)
    _wm(ax, 'txt给出单点强度翻倍解离三倍；其余曲线为不确定性展示')
    save('04_dissociation')


# ========== 图 5：f中心历史漂移 ==========
def fig_05_f_center_history():
    fig, ax = plt.subplots(figsize=(14, 6.5))

    t_points = [0,   1,    2,    3,    4,    5,    6,    7,    8]
    f_points = [250, 120, 200, 300, 300, 450, 550, 750, 750]
    labels = ['本能时代\n人体范围≈250\n(Ξ通讯即语言)',
              '沉默早中期\nf偏离人体\n(示意值)',
              '沉默末期\nf回归趋势\n(示意值)',
              '城邦时期\nf≈300\n(txt)',
              '帝国早期\nf≈300\n(txt)',
              '帝国中期\nf=300→450\n(txt)',
              '帝国中后期\nf=450→550\n(txt)',
              '帝国后期\nf突破550\n标注600=示意值',
              '战国早-中后期\nf≈750\n(txt)']
    is_txt = [0,   0,    0,    1,    1,    1,    1,    0,    1]
    colors = [COLOR['ancient'], '#5D6D7E', COLOR['silent'],
              COLOR['empire'], COLOR['empire'], COLOR['empire'],
              '#B7950B', COLOR['warring'], COLOR['warring']]

    from scipy.interpolate import make_interp_spline
    t_smooth = np.linspace(0, 8, 300)
    spline = make_interp_spline(t_points, f_points, k=3)
    f_smooth = spline(t_smooth)

    ax.plot(t_smooth, f_smooth, color=COLOR['f_curve'], linewidth=2.5,
             alpha=0.85, zorder=3, label='f中心漂移路径（概念趋势）')

    for ti, fi, lbl, src, c in zip(t_points, f_points, labels, is_txt, colors):
        marker = 'o' if src else 'D'
        ax.scatter([ti], [fi], color=c, s=130 if src else 90, zorder=5,
                    marker=marker, edgecolors='black', linewidth=1.5)
        ax.annotate(lbl, xy=(ti, fi), xytext=(ti, fi + 45), fontsize=7.5,
                    ha='center', color=c, fontweight='bold')

    ax.axhspan(200, 400, alpha=0.08, color=COLOR['layer1'], label='第一层工作区间')
    ax.axhspan(400, 700, alpha=0.08, color=COLOR['layer2'], label='第二层工作区间')
    ax.axhspan(700, 900, alpha=0.08, color=COLOR['layer3'], label='第三层工作区间')
    ax.axhline(y=1000, color=COLOR['o_point'], linestyle='--', linewidth=1.5,
                   alpha=0.6, label='o基准点 n=1000')

    p_txt = mpatches.Patch(facecolor='white', edgecolor='black', label='实心圆 = txt 原文给出的值')
    p_inf = mpatches.Patch(facecolor='white', edgecolor=COLOR['o_point'],
                              label='菱形 = 展示趋势推断的示意值')
    leg2 = ax.legend(handles=[p_txt, p_inf], loc='lower right', fontsize=8.5, framealpha=0.95)
    ax.add_artist(leg2)

    for t_sep in [1.5, 4.5, 7.5]:
        ax.axvline(x=t_sep, color='gray', linestyle=':', alpha=0.4, linewidth=1)
    ax.text(0.75, 20, '本能时代', fontsize=9, color=COLOR['ancient'], ha='center')
    ax.text(1.75, 20, '沉默时代', fontsize=9, color=COLOR['silent'], ha='center')
    ax.text(3.5, 20, '城邦·帝国', fontsize=9, color=COLOR['empire'], ha='center')
    ax.text(7.75, 20, '战国', fontsize=9, color=COLOR['warring'], ha='center')

    ax.set_xlabel('文明时间（相对顺序，无绝对时间单位）', fontsize=11, color=COLOR['ink'])
    ax.set_ylabel('f中心位置（n值）', fontsize=11, color=COLOR['ink'])
    ax.set_title('f中心历史漂移：从本能时代到战国中后期',
                  fontsize=13, fontweight='bold', color=COLOR['ink'])
    ax.set_xlim(-0.3, 8.3); ax.set_ylim(0, 1050)
    ax.grid(True, alpha=0.2, color=COLOR['grid'])
    ax.legend(loc='upper left', fontsize=8.5, framealpha=0.9)
    _wm(ax, '时间单位为示意：仅表事件先后顺序，不对应真实年代')
    save('05_f_center_history')


# ========== 图 6：文明双线驱动模型 ==========
def fig_06_dual_axis():
    fig, ax = plt.subplots(figsize=(13, 6.5))
    t = np.linspace(0, 100, 400)

    f_cycle = 250 + 200 * np.sin(2 * np.pi * t / 80) + 60 * np.sin(2 * np.pi * t / 25)
    org_c = 80 + 520 / (1 + np.exp(-0.08 * (t - 45))) + 50 / (1 + np.exp(-0.15 * (t - 75)))

    ax.plot(t, f_cycle, color=COLOR['f_curve'], linewidth=2.8,
             label='线A：f周期（物理环境·可逆）', zorder=3)
    ax.plot(t, org_c, color='#6C3483', linewidth=2.8,
             label='线B：组织复杂度（文明内部·不可逆）', zorder=3)

    ax.axhspan(100, 400, alpha=0.12, color=COLOR['ancient'],
                 label='人体f范围（本能时代工作区间）')

    milestones = [
        (8, '语言诞生\n(f首次偏离人体)', COLOR['f_curve']),
        (22, '文字与文明\n(组织复杂度阈值)', '#6C3483'),
        (42, 'f回归+复杂度已高\n→Ξ工具化', COLOR['empire']),
        (72, 'f再次远离\n→工程追赶', COLOR['warring']),
        (88, 'f逼近大脑复杂度\n→内源施法', COLOR['layer3']),
    ]
    for tm, lbl, c in milestones:
        ax.axvline(x=tm, color=c, linestyle=':', alpha=0.45, linewidth=1)
        ax.annotate(lbl, xy=(tm, 500), xytext=(tm, 720), fontsize=8,
                    ha='center', color=c, fontweight='bold',
                    arrowprops=dict(arrowstyle='->', color=c, lw=1, alpha=0.8))
    ax.set_xlabel('文明时间（示意单位：仅表相对顺序）', fontsize=11, color=COLOR['ink'])
    ax.set_ylabel('f中心位置 / 组织复杂度（示意单位）', fontsize=11, color=COLOR['ink'])
    ax.set_title('文明演化的双线驱动模型：f周期 × 组织复杂度',
                  fontsize=13, fontweight='bold', color=COLOR['ink'])
    ax.set_xlim(0, 100); ax.set_ylim(-50, 800)
    ax.grid(True, alpha=0.2, color=COLOR['grid'])
    ax.legend(loc='upper left', fontsize=9, framealpha=0.9)
    _wm(ax, '周期相位与复杂度速率为示意值；事件相对顺序来自 txt')
    save('06_dual_axis')


# ========== 图 7：三层技术体系权衡图 ==========
def fig_07_three_layers():
    fig, ax = plt.subplots(figsize=(11, 7))
    n_bg = np.linspace(100, 1000, 100)
    risk_bg = (n_bg / 1000) ** 2.3
    ax.fill_between(n_bg, 0, risk_bg, alpha=0.12, color='#BA4A00')
    ax.plot(n_bg, risk_bg, color='#BA4A00', linewidth=1.2, alpha=0.5,
             label='理论风险指数∝(n/o)^2.3（指数为示意值）')

    layers = [
        ('第一层\n机械振子', 300, 0.30, 1.0, COLOR['layer1'],
         'n最低\n效率最低\n风险最低\n训练最快'),
        ('第二层\n双n点系统', 550, 0.55, 5.0, COLOR['layer2'],
         'n中等\n效率中等\n风险中等\n训练中等'),
        ('第三层\n大脑神经', 830, 0.82, 12.0, COLOR['layer3'],
         'n高\n效率高\n风险剧增\n训练极慢'),
    ]
    for name, n_val, eff, train, c, desc in layers:
        ax.scatter([n_val], [eff], s=train * 220, color=c, alpha=0.45, zorder=3,
                    edgecolors='black', linewidth=1.8)
        ax.scatter([n_val], [eff], s=50, color='white', zorder=4,
                    edgecolors='black', linewidth=1.5)
        ax.text(n_val, eff + 0.06, name, fontsize=10, ha='center', color=c, fontweight='bold')
        ax.text(n_val, eff - 0.08, desc, fontsize=7.5, ha='center', color=c, style='italic')

    ax.axvline(x=1000, color=COLOR['o_point'], linestyle='--', linewidth=1.8,
                alpha=0.7, label='o基准点 n=1000')
    ax.annotate('复杂度↑→效率↑\n风险超线性↑→训练↑',
                 xy=(900, 0.85), xytext=(150, 0.88), fontsize=10,
                 color=COLOR['ink'], fontweight='bold',
                 arrowprops=dict(arrowstyle='->', color=COLOR['ink'], lw=2))
    ax.set_xlabel('载体固有复杂度 n', fontsize=11, color=COLOR['ink'])
    ax.set_ylabel('相对峰值效率', fontsize=11, color=COLOR['ink'])
    ax.set_title('三层技术体系：复杂度效率风险权衡',
                  fontsize=13, fontweight='bold', color=COLOR['ink'])
    ax.set_xlim(50, 1050); ax.set_ylim(0, 1.1)
    ax.grid(True, alpha=0.2, color=COLOR['grid'])
    ax.legend(loc='lower right', fontsize=8.5, framealpha=0.9)
    _wm(ax, '气泡大小代表训练年限；具体比例为展示趋势而推断')
    save('07_three_layers')


# ========== 图 8：f塔联合调制 ==========
def fig_08_f_tower():
    fig, ax = plt.subplots(figsize=(11, 6.5))
    n = np.linspace(200, 1000, 500)
    o_point = 1000

    def peak_f(n0, width, amp):
        return amp / (1.0 + ((n - n0) / width) ** 2)

    tower_peaks = [
        (520, 60, 0.35, '#A23B72', 'f塔α n=520'),
        (600, 60, 0.35, '#F18F01', 'f塔β n=600'),
        (680, 60, 0.35, '#1E8449', 'f塔γ n=680'),
    ]
    for n0, w, amp, c, lbl in tower_peaks:
        ax.plot(n, peak_f(n0, w, amp), color=c, linewidth=1.6, alpha=0.75, label=lbl)

    ax.plot(n, peak_f(600, 220, 0.5), color='#85929E', linewidth=1.5,
             linestyle='--', alpha=0.7, label='行星f场背景（宽峰）')

    combined = (peak_f(520, 60, 0.35) + peak_f(600, 60, 0.35)
                 + peak_f(680, 60, 0.35) + peak_f(600, 220, 0.5)
                 + peak_f(600, 120, 0.35))
    ax.plot(n, combined, color=COLOR['layer3'], linewidth=3, zorder=5,
             label='联合调制合成峰（多塔相位协调 → 相长干涉）')
    ax.fill_between(n, 0, combined, alpha=0.15, color=COLOR['layer3'])

    max_idx = int(np.argmax(combined))
    ax.annotate('合成峰位置=物理层密码\n（知道密码的人才能在此n值下高效激发Ξ场）',
                 xy=(n[max_idx], combined[max_idx]),
                 xytext=(n[max_idx] + 120, combined[max_idx] - 0.2),
                 fontsize=10, color=COLOR['layer3'], fontweight='bold',
                 arrowprops=dict(arrowstyle='->', color=COLOR['layer3'], lw=2))

    for n0, w, amp, c, lbl in tower_peaks:
        ax.annotate('单塔效率有限', xy=(n0, amp), xytext=(n0 - 50, amp + 0.08),
                    fontsize=7.5, color=c, ha='center',
                    arrowprops=dict(arrowstyle='->', color=c, lw=1, alpha=0.7))
    ax.axvline(x=o_point, color=COLOR['o_point'], linestyle='--', linewidth=1.2,
                alpha=0.5, label='o基准点')
    ax.set_xlabel('复杂度 n', fontsize=11, color=COLOR['ink'])
    ax.set_ylabel('效率 / 场强（相对单位）', fontsize=11, color=COLOR['ink'])
    ax.set_title('f塔联合调制：多塔相位协调 → 相长干涉 → 合成峰',
                  fontsize=13, fontweight='bold', color=COLOR['ink'])
    ax.set_xlim(200, 1000); ax.set_ylim(0, 1.5)
    ax.grid(True, alpha=0.2, color=COLOR['grid'])
    ax.legend(loc='upper left', fontsize=8.5, framealpha=0.9)
    _wm(ax, '塔数与具体n值为示意；合成峰位置=密码来自 txt核心概念')
    save('08_f_tower')


if __name__ == '__main__':
    print('正在生成 Ξ 场魔法体系可视化图表 ...')
    print()
    fig_01_efficiency_curve()
    fig_02_peak_efficiency()
    fig_03_spring_energy()
    fig_04_dissociation()
    fig_05_f_center_history()
    fig_06_dual_axis()
    fig_07_three_layers()
    fig_08_f_tower()
    print()
    print('全部生成完毕（共 8 张图）')

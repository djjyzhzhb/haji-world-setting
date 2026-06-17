# -*- coding: utf-8 -*-
"""
Ξ场魔法体系 —— 统一数据获取层 (v2)

设计要点：
  1) 所有"txt原文提取的硬值"集中存放在 params_hard 中
  2) 所有"可推导值"统一由 calc_derived() 从 hard params 派生
  3) 所有"纯展示用形状参数"集中放在 display_shapes 中
  4) 每次画图前执行一致性自检（self_test()）
  5) 所有示意值在图例中标注"为展示趋势而设"

这样的好处：
  - 改一处 → 所有图自动跟着变（例如修改txt中的某个锚点值）
  - 不允许出现"效率 = 0.55 是随手写的一个数"这种情况
  - 同一概念在所有图中绝对一致（不会出现"图2中n=550"而"图7中n=555"）
"""

import numpy as np
import matplotlib.pyplot as plt
from matplotlib import rcParams
import matplotlib.patches as mpatches

# -------------------- 全局样式 --------------------
rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei",
                               "Arial Unicode MS", "DejaVu Sans"]
rcParams["axes.unicode_minus"] = False
rcParams["figure.dpi"] = 160
rcParams["savefig.dpi"] = 160

COLOR = {
    "o_point":    "#C0392B",
    "f_curve":    "#2874A6",
    "f_soft":     "#5499C7",
    "peak":       "#1E8449",
    "peak_soft":  "#58D68D",
    "xi":         "#6C3483",
    "self_cost":  "#D68910",
    "overflow":   "#239B56",
    "dissociate": "#BA4A00",
    "repair":     "#239B56",
    "layer1":     "#A23B72",
    "layer2":     "#F18F01",
    "layer3":     "#C73E1D",
    "ancient":    "#2874A6",
    "silent":     "#7D3C98",
    "empire":     "#148F77",
    "warring":    "#B7950B",
    "grid":       "#E5E7E9",
    "ink":        "#2C3E50",
}


# =========================================================
# 【层 1】txt 原文提取的硬值（只有 txt 明确写的才放这里）
# =========================================================
params_hard = {
    # 基准
    "o_point": 1000,           # txt: n=1000 处的基准参考点

    # 解离（txt 原文单点：强度翻倍 → 解离三倍）
    "spell_intensity_double": 2.0,
    "dissociation_ratio":     3.0,

    # 人体共振范围（txt: 本能时代人体可做Ξ通讯）
    "human_range_low":  100,
    "human_range_high": 400,

    # 历史 f 中心锚点（txt 原文各纪元给出的典型值）
    "f_empire_early":    300,
    "f_empire_mid_low":  300,   # 帝国中期的起点
    "f_empire_mid_high": 450,   # 帝国中期的终点
    "f_empire_late_low": 450,
    "f_empire_late_high":550,
    "f_warring":         750,

    # 三层技术定性描述（txt: 第一层机械/第二层双n点/第三层大脑）
    # 注意：n 的具体选择放在 display_shapes 中——它们是展示用的代表点
}


# =========================================================
# 【层 2】可从 txt 硬值推导的值（统一公式，不再手写）
# =========================================================
def calc_derived(p_hard, p_shape):
    """
    所有可推导值集中在这里计算。任何图函数不得绕过这个函数。
    """
    o = p_hard["o_point"]

    # 解离指数：txt 给了一点单点（强度2，解离3），但允许展示不确定性
    alpha_center = np.log(p_hard["dissociation_ratio"]) / np.log(p_hard["spell_intensity_double"])
    alpha_low    = alpha_center - p_shape["alpha_uncertainty"]
    alpha_high   = alpha_center + p_shape["alpha_uncertainty"]

    # 三层技术：效率必须 = peak(n) = n/o（当 n<o 时），这是 txt 明确的正比
    layer_n = p_shape["layer_n_representatives"]
    layer_efficiency = tuple(min(n / o, 1.0) for n in layer_n)

    # 人体范围中心：用于图中标注
    human_center = (p_hard["human_range_low"] + p_hard["human_range_high"]) / 2

    return {
        "o": o,
        "alpha_center": alpha_center,      # 解离指数中心值
        "alpha_low":    alpha_low,         # 下边界
        "alpha_high":   alpha_high,        # 上边界
        "layer_n":      layer_n,           # 三层 n 的代表点
        "layer_eff":    layer_efficiency,  # 三层效率（由 n 派生）
        "human_center": human_center,
    }


# =========================================================
# 【层 3】纯展示用的形状参数（这些是 C 级，必须明注为示意）
# =========================================================
display_shapes = {
    # 效率曲线的"钟型"宽窄（txt只给形态，未给具体宽度）
    # 用多宽都可以——只要读者知道这是"形状参数"即可
    "eff_width_stable":  90,
    "eff_width_normal":  180,
    "eff_width_turbulent": 360,

    # 三层技术在复杂度轴上的"代表点"（txt只给相对层级，不给具体n）
    # 选择原则：让三层在图中视觉分布合理，且符合"第一层<<第二层<<第三层<o"
    "layer_n_representatives": (300, 550, 830),

    # 三层训练年限的"展示比例"（txt只给定性：最慢 vs 中等 vs 最快）
    "layer_training_years": (1.0, 5.0, 12.0),

    # 风险随复杂度增长的指数（txt仅说"超线性"，未给具体值）
    "risk_power": 2.3,

    # 不确定性半宽（解离指数：我们给 ±0.2 的展示带）
    "alpha_uncertainty": 0.2,

    # 蓄势弹簧：自耗率的起点和终点（txt说随时间增长，但无具体值）
    "self_consume_start": 0.60,
    "self_consume_end":   0.90,
    "self_consume_tau":   4.0,   # 时间常数（时间单位）

    # f历史时间轴的相对间距（只表示事件先后，不对应真实年数）
    "history_t_spacing": (0, 1, 2, 3, 4, 5, 6, 7, 8),

    # f塔的振幅/宽度参数（纯展示比例）
    "tower_amp": 0.35,
    "tower_width": 60,
    "tower_positions": (520, 600, 680),
    "background_amp": 0.5,
    "background_width": 220,
    "interference_amp": 0.35,
    "interference_width": 120,

    # 周期驱动：f波动的振幅（txt仅说"周期性"，无周期具体值）
    "f_period_amp_primary":   200,
    "f_period_amp_secondary":  60,
    "f_period_t_primary":     80,
    "f_period_t_secondary":   25,
}


# =========================================================
# 【层 4】一致性自检：确保整套数值体系无内部矛盾
# =========================================================
def self_test(p_hard, p_shape, p_derived):
    checks = []
    warnings = []

    # (1) 三层效率必须 = layer_n / o（当 n<o 时）
    for i, (n, eff) in enumerate(zip(p_derived["layer_n"], p_derived["layer_eff"])):
        expected = min(n / p_hard["o_point"], 1.0)
        ok = abs(eff - expected) < 1e-9
        checks.append(("layer efficiency", f"layer{i+1} n={n} eff={eff:.3f} expected={expected:.3f}", ok))

    # (2) 解离指数必须满足：2^alpha_center = 3
    check_val = (p_hard["spell_intensity_double"] ** p_derived["alpha_center"])
    ok = abs(check_val - p_hard["dissociation_ratio"]) < 1e-9
    checks.append(("dissociation", f"2^{p_derived['alpha_center']:.4f} = {check_val:.6f} (应该是 {p_hard['dissociation_ratio']})", ok))

    # (3) 所有历史f值必须都落在 [0, o] 的合理范围
    for name, val in [("empire_early", p_hard["f_empire_early"]),
                       ("empire_mid_low", p_hard["f_empire_mid_low"]),
                       ("empire_mid_high", p_hard["f_empire_mid_high"]),
                       ("empire_late_low", p_hard["f_empire_late_low"]),
                       ("empire_late_high", p_hard["f_empire_late_high"]),
                       ("warring", p_hard["f_warring"])]:
        ok = 0 < val < p_hard["o_point"]
        checks.append(("f history", f"{name}={val} ∈ (0,{p_hard['o_point']})", ok))

    # (4) 人体范围中心应该接近第一层的中心
    human_c = p_derived["human_center"]
    layer1_n = p_derived["layer_n"][0]
    diff = abs(human_c - layer1_n)
    ok = diff < 80  # 允许 80 的容差
    checks.append(("human range", f"人体中心={human_c} vs 第一层n={layer1_n} 差={diff}", ok))

    # 打印结果
    ok_count = sum(1 for _, _, ok in checks if ok)
    total = len(checks)
    print(f"  自检 {ok_count}/{total} 通过")
    for category, msg, ok in checks:
        status = "✔" if ok else "✘"
        print(f"    [{status}] {category:<14} {msg}")
    if ok_count == total:
        print("  → 内部一致")
    else:
        print("  → 警告：存在不一致")
    return ok_count == total


# =========================================================
# 通用绘图辅助
# =========================================================
def _note(ax, text):
    """在图右下角加来源说明。"""
    ax.text(0.99, 0.015, text, transform=ax.transAxes,
            ha="right", va="bottom", fontsize=7.5, color="#7F8C8D",
            style="italic")


def save(name, fig):
    fig.tight_layout()
    out = f"E:\\哈吉语创制计划\\文创相关\\images\\{name}.png"
    fig.savefig(out, bbox_inches="tight", facecolor="white")
    print(f"  ✔ {out}")
    plt.close(fig)


# =========================================================
# 图 1：效率分布函数
# =========================================================
def fig_01(p_hard, p_shape, p_derived):
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))
    o = p_derived["o"]
    n = np.linspace(0, o + 300, 500)

    # 左图：不同 f 中心位置
    ax = axes[0]
    for center, c, lbl in [(p_hard["f_empire_early"],  COLOR["layer1"], "f中心=300（帝国早期·txt）"),
                            (p_hard["f_empire_late_high"], COLOR["layer2"], "f中心=550（帝国中后期·txt）"),
                            (p_hard["f_warring"],        COLOR["layer3"], "f中心=750（战国·txt）")]:
        f = 1.0 / (1.0 + ((n - center) / p_shape["eff_width_normal"]) ** 2)
        ax.plot(n, f, color=c, linewidth=2.2, label=lbl)
        ax.axvline(x=center, color=c, linestyle=":", alpha=0.45, linewidth=1)
    ax.axvline(x=o, color=COLOR["o_point"], linestyle="--",
               linewidth=1.8, label=f"o基准点 n={o}")
    ax.set_xlabel("复杂度参数 n", fontsize=11, color=COLOR["ink"])
    ax.set_ylabel("相对效率 f(n)", fontsize=11, color=COLOR["ink"])
    ax.set_title("不同 f 中心位置下的共振窗口", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, o + 200); ax.set_ylim(0, 1.15)
    ax.grid(True, alpha=0.25, color=COLOR["grid"])
    ax.legend(loc="upper right", fontsize=8.5, framealpha=0.9)
    _note(ax, "f中心值取自 txt原文；曲线宽度为展示用形状参数")

    # 右图：不同环境陡峭度（固定 f 中心 = 帝国中期 450）
    ax = axes[1]
    center = p_hard["f_empire_mid_high"]
    for w, c, lbl in [(p_shape["eff_width_stable"], "#1F618D", "稳定环境（共振范围窄）"),
                      (p_shape["eff_width_normal"], "#2874A6", "一般环境"),
                      (p_shape["eff_width_turbulent"], "#7FB3D5", "动荡环境（共振范围宽）")]:
        f = 1.0 / (1.0 + ((n - center) / w) ** 2)
        ax.plot(n, f, color=c, linewidth=2.2, label=lbl)
    ax.axvline(x=center, color=COLOR["f_soft"], linestyle=":", alpha=0.6)
    ax.axvline(x=o, color=COLOR["o_point"], linestyle="--", linewidth=1.5, alpha=0.6)
    ax.set_xlabel("复杂度参数 n", fontsize=11, color=COLOR["ink"])
    ax.set_ylabel("相对效率 f(n)", fontsize=11, color=COLOR["ink"])
    ax.set_title("环境稳定性对曲线形态的影响", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, o + 200); ax.set_ylim(0, 1.15)
    ax.grid(True, alpha=0.25, color=COLOR["grid"])
    ax.legend(loc="upper right", fontsize=8.5, framealpha=0.9)
    _note(ax, "陡峭度是txt仅给定性描述的形状参数；展示三级对比")

    fig.suptitle("图1 效率分布函数 f(n)", fontsize=14, fontweight="bold", y=1.02, color=COLOR["ink"])
    return fig, "01_efficiency_curve"


# =========================================================
# 图 2：复杂度 × 峰值效率
# =========================================================
def fig_02(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(11, 6))
    o = p_derived["o"]
    n = np.linspace(50, o + 500, 500)
    peak = np.where(n <= o, n / o, o / n)

    ax.plot(n, peak, color=COLOR["peak"], linewidth=2.8, zorder=5,
            label="peak(n) = n/o（n≤o） 或 o/n（n>o）")
    ax.fill_between(n, 0, peak, color=COLOR["peak_soft"], alpha=0.15)
    ax.axvline(x=o, color=COLOR["o_point"], linestyle="--", linewidth=2,
               label=f"o基准点 n={o}")

    # 在三层技术的代表点上标注
    for i, (ni, eff, c, lbl) in enumerate(zip(
            p_derived["layer_n"], p_derived["layer_eff"],
            [COLOR["layer1"], COLOR["layer2"], COLOR["layer3"]],
            ["第一层 机械振子", "第二层 双n点系统", "第三层 大脑神经"])):
        ax.scatter([ni], [eff], color=c, s=150, zorder=10,
                    edgecolors="black", linewidth=1.5)
        ax.annotate(f"{lbl}\nn={ni}  eff={eff:.2f}\n（由 peak 公式统一计算）",
                    xy=(ni, eff), xytext=(ni + 80, eff - 0.15),
                    fontsize=8.5, color=c, fontweight="bold",
                    arrowprops=dict(arrowstyle="->", color=c, lw=1))

    ax.set_xlabel("载体固有复杂度 n", fontsize=12, color=COLOR["ink"])
    ax.set_ylabel("相对峰值效率", fontsize=12, color=COLOR["ink"])
    ax.set_title("复杂度 — 峰值效率：txt原文'低正比高反比'的精确实现",
                 fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, o + 500); ax.set_ylim(0, 1.15)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper right", fontsize=9, framealpha=0.9)
    _note(ax, "曲线由 txt原文'正比/反比'唯一确定；三层 n 值为代表点选择")
    return fig, "02_peak_efficiency"


# =========================================================
# 图 3：蓄势弹簧效应 —— 能量分配
# =========================================================
def fig_03(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(11, 6))
    t = np.linspace(0, 10, 300)

    # Ξ动能：基准 1 + 小幅振动
    E_xi = 1.0 + 0.08 * np.sin(2 * np.pi * t / 2.5)

    # 自耗率：指数增长到 1 - exp(-t/τ) 的调制
    ratio = p_shape["self_consume_start"] + (p_shape["self_consume_end"] - p_shape["self_consume_start"]) * (
            1 - np.exp(-t / p_shape["self_consume_tau"]))
    E_self = E_xi * ratio
    E_overflow = E_xi - E_self

    ax.fill_between(t, 0, E_self, alpha=0.55, color=COLOR["self_cost"],
                     label="系统自耗（推动 n→o 的做功）")
    ax.fill_between(t, E_self, E_xi, alpha=0.55, color=COLOR["overflow"],
                     label="溢出部分（可被利用的 Ξ动能）")
    ax.plot(t, E_xi, color=COLOR["xi"], linewidth=2.2, label="Ξ附加动能总量")
    ax.plot(t, E_self, color=COLOR["self_cost"], linewidth=1.8, linestyle="--", alpha=0.7)
    ax.plot(t, E_overflow, color=COLOR["overflow"], linewidth=1.8, linestyle="--", alpha=0.7)

    # 说明
    ax.text(5, 0.45,
            f"自耗率 {p_shape['self_consume_start']:.0%} → {p_shape['self_consume_end']:.0%}\n(时间常数 τ={p_shape['self_consume_tau']} 示意单位)",
            fontsize=9, color=COLOR["self_cost"], ha="center",
            bbox=dict(boxstyle="round,pad=0.4", facecolor="#FFF3CD",
                      edgecolor="#EEB462", linewidth=1.0))

    ax.set_xlabel("时间（振动周期，示意单位）", fontsize=11, color=COLOR["ink"])
    ax.set_ylabel("能量（相对单位）", fontsize=11, color=COLOR["ink"])
    ax.set_title("蓄势弹簧效应：外部输入 → Ξ动能 → 自耗 + 溢出",
                  fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, 10); ax.set_ylim(0, 1.25)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper right", fontsize=9, framealpha=0.9)
    _note(ax, "比例参数为展示用；增长趋势定性来自 txt")
    return fig, "03_spring_energy"


# =========================================================
# 图 4：解离 —— 不确定性展示
# =========================================================
def fig_04(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(10, 6.5))
    x = np.linspace(0.1, 2.5, 400)

    # 不确定性带：alpha ± 0.2
    ax.fill_between(x, x ** p_derived["alpha_low"], x ** p_derived["alpha_high"],
                     alpha=0.20, color="#BA4A00",
                     label=f"不确定范围：α ∈ [{p_derived['alpha_low']:.2f}, {p_derived['alpha_high']:.2f}]")
    # 中心曲线
    ax.plot(x, x ** p_derived["alpha_center"], color=COLOR["dissociate"],
             linewidth=2.5,
             label=f"中心值：α = {p_derived['alpha_center']:.3f}（满足 2^α = 3）")

    # 修复能力上限（示意值）
    ax.axhline(y=1.0, color=COLOR["repair"], linestyle=":", linewidth=2.2,
                label="自主修复能力上限（示意值）")

    # 关键数据点
    ax.scatter([p_hard["spell_intensity_double"]],
                [p_hard["spell_intensity_double"] ** p_derived["alpha_center"]],
                color=COLOR["dissociate"], s=140, zorder=10,
                edgecolors="black", linewidth=1.5)
    ax.annotate("txt原文锚点\n(强度=2, 解离=3)",
                xy=(p_hard["spell_intensity_double"], p_hard["dissociation_ratio"]),
                xytext=(1.2, 3.8),
                fontsize=9.5, color=COLOR["dissociate"], fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=COLOR["dissociate"], lw=1.5))

    ax.set_xlabel("施法强度（相对基准）", fontsize=11, color=COLOR["ink"])
    ax.set_ylabel("结构解离速度（相对单位）", fontsize=11, color=COLOR["ink"])
    ax.set_title("复杂度解离效应：txt仅给 1 个锚点，幂律其余部分为不确定性",
                  fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, 2.5); ax.set_ylim(0, 4.5)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper left", fontsize=8.5, framealpha=0.9)
    _note(ax, "仅锚点(2,3)是txt给出的事实；其余区域为示意展示")
    return fig, "04_dissociation"


# =========================================================
# 图 5：f 中心历史漂移
# =========================================================
def fig_05(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(14, 6.5))
    o = p_derived["o"]

    # 使用 txt 原文节点：每个节点都是硬值
    # 为清晰展示：本能时代位于人体中心（250，也在txt范围内）
    # 沉默中期偏离（去 ~100）
    # 城邦/帝国早期回到人体范围（~300）
    # 帝国中期→后期逐步推高
    # 战国 ~750
    t_pts = p_shape["history_t_spacing"]
    f_pts = [
        (p_hard["human_range_low"] + p_hard["human_range_high"]) / 2,  # 本能时代：人体中心
        100,                                                             # 沉默早期：偏离
        200,                                                             # 沉默末期：回归
        p_hard["f_empire_early"],                                        # 城邦/帝国早期
        p_hard["f_empire_early"],
        p_hard["f_empire_mid_high"],
        p_hard["f_empire_late_high"],
        p_hard["f_warring"],
        p_hard["f_warring"],
    ]
    labels = [
        "本能时代\n人体中心≈250",
        "沉默早期\nf偏离人体\n(示意值)",
        "沉默末期\nf回归趋势\n(示意值)",
        "城邦时期\nf≈300(txt)",
        "帝国早期\nf≈300(txt)",
        "帝国中期\nf=300→450(txt)",
        "帝国后期\nf突破550\n标注为示意值",
        "战国早中期\nf≈750(txt)",
        "战国中后期\nf≈750(txt)",
    ]
    is_txt = [0, 0, 0, 1, 1, 1, 1, 1, 1]

    from scipy.interpolate import make_interp_spline
    t_smooth = np.linspace(0, 8, 300)
    spline = make_interp_spline(t_pts, f_pts, k=3)
    f_smooth = spline(t_smooth)

    ax.plot(t_smooth, f_smooth, color=COLOR["f_curve"], linewidth=2.5,
             alpha=0.85, zorder=3, label="f中心漂移路径（概念趋势）")

    for ti, fi, lbl, src in zip(t_pts, f_pts, labels, is_txt):
        marker = "o" if src else "D"
        c = COLOR["empire"] if src else COLOR["silent"]
        if ti >= 7: c = COLOR["warring"]
        if ti <= 2: c = COLOR["ancient"]
        ax.scatter([ti], [fi], color=c, s=130 if src else 90, zorder=5,
                    marker=marker, edgecolors="black", linewidth=1.5)
        ax.annotate(lbl, xy=(ti, fi), xytext=(ti, fi + 45), fontsize=7.5,
                    ha="center", color=c, fontweight="bold")

    # 三层技术工作区
    ax.axhspan(p_shape["layer_n_representatives"][0] - 100,
                p_shape["layer_n_representatives"][0] + 100,
                alpha=0.06, color=COLOR["layer1"])
    ax.axhspan(p_shape["layer_n_representatives"][1] - 100,
                p_shape["layer_n_representatives"][1] + 100,
                alpha=0.06, color=COLOR["layer2"])
    ax.axhspan(p_shape["layer_n_representatives"][2] - 80,
                p_shape["layer_n_representatives"][2] + 80,
                alpha=0.06, color=COLOR["layer3"])
    ax.axhline(y=o, color=COLOR["o_point"], linestyle="--", linewidth=1.5,
                alpha=0.6, label=f"o基准点 n={o}")

    # 图例：区分 txt值 vs 示意值
    p_txt = mpatches.Patch(facecolor="white", edgecolor="black", label="实心圆 = txt原文锚点")
    p_inf = mpatches.Patch(facecolor="white", edgecolor=COLOR["o_point"],
                              label="菱形 = 为展示趋势的推断节点")
    leg2 = ax.legend(handles=[p_txt, p_inf], loc="lower right",
                      fontsize=8.5, framealpha=0.95)
    ax.add_artist(leg2)

    # 时间分隔线
    for t_sep in [2.5, 4.5, 6.5]:
        ax.axvline(x=t_sep, color="gray", linestyle=":", alpha=0.4, linewidth=1)
    ax.text(1.25, -5, "本能/沉默", fontsize=9, color=COLOR["ancient"], ha="center")
    ax.text(4.5,  -5, "城邦/帝国", fontsize=9, color=COLOR["empire"], ha="center")
    ax.text(7.25, -5, "战国",      fontsize=9, color=COLOR["warring"], ha="center")

    ax.set_xlabel("文明时间（相对顺序，无绝对时间单位）", fontsize=11, color=COLOR["ink"])
    ax.set_ylabel("f中心位置（n 值）", fontsize=11, color=COLOR["ink"])
    ax.set_title("f中心历史漂移：txt锚点用实心圆，示意值用菱形明确标记",
                  fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(-0.3, 8.3); ax.set_ylim(-50, o + 50)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper left", fontsize=8.5, framealpha=0.9)
    _note(ax, "时间轴为示意顺序，不对应真实年代")
    return fig, "05_f_center_history"


# =========================================================
# 图 6：文明双线驱动模型
# =========================================================
def fig_06(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(13, 6.5))
    t = np.linspace(0, 100, 400)
    o = p_derived["o"]

    # 线 A：f 周期（展示用的周期性波动）
    f_cycle = p_derived["human_center"] + \
              p_shape["f_period_amp_primary"] * np.sin(2 * np.pi * t / p_shape["f_period_t_primary"]) + \
              p_shape["f_period_amp_secondary"] * np.sin(2 * np.pi * t / p_shape["f_period_t_secondary"])

    # 线 B：组织复杂度（S型不可逆增长）
    org_c = 50 + 520 / (1 + np.exp(-0.08 * (t - 45))) + \
            50 / (1 + np.exp(-0.15 * (t - 75)))

    ax.plot(t, f_cycle, color=COLOR["f_curve"], linewidth=2.8,
             label="线A：f周期（物理环境·可逆）", zorder=3)
    ax.plot(t, org_c, color="#6C3483", linewidth=2.8,
             label="线B：组织复杂度（文明内部·不可逆）", zorder=3)

    ax.axhspan(p_hard["human_range_low"], p_hard["human_range_high"],
                alpha=0.12, color=COLOR["ancient"],
                label="人体f范围（txt: 本能时代 Ξ通讯即语言）")

    milestones = [
        (8,   "语言诞生\n(f首次偏离人体)", COLOR["f_curve"]),
        (25,  "文字与文明\n(组织复杂度阈值)", "#6C3483"),
        (42,  "f回归+复杂度已高\n→Ξ工具化", COLOR["empire"]),
        (72,  "f再次远离\n→工程追赶", COLOR["warring"]),
        (88,  "f逼近大脑复杂度\n→内源施法", COLOR["layer3"]),
    ]
    for tm, lbl, c in milestones:
        ax.axvline(x=tm, color=c, linestyle=":", alpha=0.45, linewidth=1)
        ax.annotate(lbl, xy=(tm, 500), xytext=(tm, 720), fontsize=8,
                    ha="center", color=c, fontweight="bold",
                    arrowprops=dict(arrowstyle="->", color=c, lw=1, alpha=0.8))

    ax.set_xlabel("文明时间（示意单位：仅表相对顺序）", fontsize=11, color=COLOR["ink"])
    ax.set_ylabel("f中心位置 / 组织复杂度（示意单位）", fontsize=11, color=COLOR["ink"])
    ax.set_title("文明演化的双线驱动模型：f周期 × 组织复杂度",
                  fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, 100); ax.set_ylim(-50, 800)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper left", fontsize=9, framealpha=0.9)
    _note(ax, "周期相位和复杂度速率为示意展示；事件顺序来自 txt原文")
    return fig, "06_dual_axis"


# =========================================================
# 图 7：三层技术权衡图
# =========================================================
def fig_07(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(11, 7))
    o = p_derived["o"]

    # 背景：风险随复杂度超线性增长（指数=2.3为示意值）
    n_bg = np.linspace(50, o, 100)
    risk_bg = (n_bg / o) ** p_shape["risk_power"]
    ax.fill_between(n_bg, 0, risk_bg, alpha=0.12, color="#BA4A00")
    ax.plot(n_bg, risk_bg, color="#BA4A00", linewidth=1.2, alpha=0.5,
             label=f"风险 ∝ (n/o)^{p_shape['risk_power']:.1f}\n指数为展示值")

    # 三层的 n 和 eff 都是统一派生的（非手写）
    names = ["第一层\n机械振子", "第二层\n双n点系统", "第三层\n大脑神经"]
    for name, n_val, eff, train, c in zip(
            names, p_derived["layer_n"], p_derived["layer_eff"],
            p_shape["layer_training_years"],
            [COLOR["layer1"], COLOR["layer2"], COLOR["layer3"]]):
        ax.scatter([n_val], [eff], s=train * 220, color=c, alpha=0.45, zorder=3,
                    edgecolors="black", linewidth=1.8,
                    label=f"{name.splitlines()[0]}：n={n_val}, eff={eff:.2f}（公式统一计算）, 训练≈{train:.0f}年（示意比例）")
        ax.scatter([n_val], [eff], s=50, color="white", zorder=4,
                    edgecolors="black", linewidth=1.5)
        ax.text(n_val, eff + 0.07, name, fontsize=10, ha="center", color=c,
                 fontweight="bold")

    ax.axvline(x=o, color=COLOR["o_point"], linestyle="--", linewidth=1.8,
                alpha=0.7, label=f"o基准点 n={o}")
    ax.set_xlabel("载体固有复杂度 n", fontsize=11, color=COLOR["ink"])
    ax.set_ylabel("相对峰值效率（由 peak(n) 统一计算）", fontsize=11, color=COLOR["ink"])
    ax.set_title("三层技术权衡：n与效率由公式派生，训练年限为展示用比例",
                  fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(50, o + 50); ax.set_ylim(0, 1.1)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="lower right", fontsize=8.0, framealpha=0.9)
    _note(ax, "气泡大小=训练年限（展示比例）；n和效率由 peak(n)=n/o 公式统一派生")
    return fig, "07_three_layers"


# =========================================================
# 图 8：f 塔联合调制
# =========================================================
def fig_08(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(11, 6.5))
    n = np.linspace(200, p_derived["o"], 500)

    def peak_func(n0, width, amp):
        return amp / (1.0 + ((n - n0) / width) ** 2)

    # 三座塔 + 背景
    colors_t = ["#1F618D", COLOR["empire"], COLOR["warring"]]
    for pos, c in zip(p_shape["tower_positions"], colors_t):
        ax.plot(n, peak_func(pos, p_shape["tower_width"], p_shape["tower_amp"]), color=c,
                 linewidth=1.6, alpha=0.8, label=f"f塔 n={pos}（示意）")

    # 行星 f 场背景
    ax.plot(n, peak_func(p_shape["tower_positions"][1],
                           p_shape["background_width"],
                           p_shape["background_amp"]),
             color="#85929E", linewidth=1.5, linestyle="--", alpha=0.7,
             label="行星f场背景（宽峰）")

    # 合成峰（多塔+背景+干涉增强）
    combined = np.zeros_like(n)
    for pos in p_shape["tower_positions"]:
        combined += peak_func(pos, p_shape["tower_width"], p_shape["tower_amp"])
    combined += peak_func(p_shape["tower_positions"][1],
                            p_shape["background_width"], p_shape["background_amp"])
    combined += peak_func(p_shape["tower_positions"][1],
                            p_shape["interference_width"], p_shape["interference_amp"])

    ax.plot(n, combined, color=COLOR["layer3"], linewidth=3, zorder=5,
             label="联合调制合成峰\n（多塔相位协调 → 相长干涉 → 合成峰位置=密码）")
    ax.fill_between(n, 0, combined, alpha=0.18, color=COLOR["layer3"])

    # 标注"合成峰位置"
    idx = int(np.argmax(combined))
    peak_n = n[idx]
    ax.annotate(f"合成峰位置 ≈ {int(peak_n)}\n（= 物理层密码）",
                xy=(peak_n, combined[idx]), xytext=(peak_n + 100, combined[idx] - 0.2),
                fontsize=10, color=COLOR["layer3"], fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=COLOR["layer3"], lw=2))

    ax.axvline(x=p_derived["o"], color=COLOR["o_point"], linestyle="--", linewidth=1.2,
                alpha=0.5, label=f"o基准点 n={p_derived['o']}")
    ax.set_xlabel("复杂度 n", fontsize=11, color=COLOR["ink"])
    ax.set_ylabel("效率/场强（相对单位）", fontsize=11, color=COLOR["ink"])
    ax.set_title("f塔联合调制：相位协调 → 相长干涉 → 合成峰",
                  fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(200, p_derived["o"]); ax.set_ylim(0, max(combined) + 0.2)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper left", fontsize=8.5, framealpha=0.9)
    _note(ax, "塔位置/振幅为示意比例；核心概念'合成峰=密码'来自 txt")
    return fig, "08_f_tower"


# =========================================================
# 主入口
# =========================================================
if __name__ == "__main__":
    print("Ξ场可视化 v2 —— 统一数据获取层")
    print("=" * 60)
    print(f"  硬值：{len(params_hard)} 项（txt原文提取）")
    print(f"  形状参数：{len(display_shapes)} 项（展示用示意值）")
    print(f"  派生值：统一由 calc_derived() 计算")
    print()

    # 派生
    derived = calc_derived(params_hard, display_shapes)

    # 自检
    self_test(params_hard, display_shapes, derived)
    print()

    # 生成全部图表
    figs = [
        fig_01, fig_02, fig_03, fig_04,
        fig_05, fig_06, fig_07, fig_08,
    ]
    print("开始生成图表 ...")
    for fn in figs:
        fig, name = fn(params_hard, display_shapes, derived)
        save(name, fig)
    print()
    print("全部完成（共 8 张图）")

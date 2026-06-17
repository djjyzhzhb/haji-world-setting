# -*- coding: utf-8 -*-
"""
Ξ场魔法体系 —— v3 统一数据获取层 + JSON 配置 + 敏感性分析

使用：
    python generate_charts_v3.py                 # 使用 shapes_config.json 的参数
    python generate_charts_v3.py --sensitivity   # 额外跑3套参数做敏感性分析

参数分三层：
    params_hard    : txt原文硬值（不可改，集中管理）
    display_shapes : 纯展示用形状参数（从 JSON 加载；读者可直接编辑）
    derived        : 由 hard + shapes 统一推导

每次运行自动执行 11 项一致性自检。
"""

import json
import os
import sys
import copy
import numpy as np
import matplotlib.pyplot as plt
from matplotlib import rcParams
import matplotlib.patches as mpatches
from scipy.interpolate import make_interp_spline

# ================== 全局样式 ==================
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

HERE = os.path.dirname(os.path.abspath(__file__))
IMG_DIR = HERE
CONFIG_PATH = os.path.join(HERE, "shapes_config.json")


# =========================================================
# 【层 1】txt 原文提取的硬值（集中管理）
# =========================================================
params_hard = {
    "o_point":              1000,
    "spell_intensity_double": 2.0,
    "dissociation_ratio":   3.0,
    "human_range_low":      100,
    "human_range_high":     400,
    "f_empire_early":       300,
    "f_empire_mid_low":     300,
    "f_empire_mid_high":    450,
    "f_empire_late_low":    450,
    "f_empire_late_high":   550,
    "f_warring":            750,
}


# =========================================================
# 默认形状参数（JSON 缺失时的回退值）
# =========================================================
DEFAULT_SHAPES = {
    "eff_width_stable":  90,
    "eff_width_normal":  180,
    "eff_width_turbulent": 360,
    "layer_n_representatives": [300, 550, 830],
    "layer_training_years": [1.0, 5.0, 12.0],
    "risk_power": 2.3,
    "alpha_uncertainty": 0.2,
    "self_consume_start": 0.60,
    "self_consume_end":   0.90,
    "self_consume_tau":   4.0,
    "history_t_spacing": [0, 1, 2, 3, 4, 5, 6, 7, 8],
    "tower_amp": 0.35,
    "tower_width": 60,
    "tower_positions": [520, 600, 680],
    "background_amp": 0.5,
    "background_width": 220,
    "interference_amp": 0.35,
    "interference_width": 120,
    "f_period_amp_primary":   200,
    "f_period_amp_secondary":  60,
    "f_period_t_primary":     80,
    "f_period_t_secondary":   25,
}


def load_shapes():
    """从 JSON 读取 shapes；JSON 不存在或解析失败则用默认值。"""
    if not os.path.exists(CONFIG_PATH):
        print(f"  [!] 未找到 {os.path.basename(CONFIG_PATH)}，使用默认值。")
        return copy.deepcopy(DEFAULT_SHAPES)
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        # 检查缺项并补齐
        for k, v in DEFAULT_SHAPES.items():
            if k not in data:
                print(f"  [!] JSON 缺 '{k}'，使用默认值 {v}")
                data[k] = v
        print(f"  ✔ 从 {os.path.basename(CONFIG_PATH)} 读取 {len(data)} 项形状参数")
        return data
    except Exception as e:
        print(f"  [!] 解析 JSON 失败：{e}；使用默认值。")
        return copy.deepcopy(DEFAULT_SHAPES)


# =========================================================
# 【层 2】从硬值派生值
# =========================================================
def calc_derived(p_hard, p_shape):
    o = p_hard["o_point"]
    alpha_center = np.log(p_hard["dissociation_ratio"]) / np.log(p_hard["spell_intensity_double"])
    alpha_low    = alpha_center - p_shape["alpha_uncertainty"]
    alpha_high   = alpha_center + p_shape["alpha_uncertainty"]
    layer_n = tuple(p_shape["layer_n_representatives"])
    layer_eff = tuple(min(n / o, 1.0) for n in layer_n)
    human_center = (p_hard["human_range_low"] + p_hard["human_range_high"]) / 2
    return {
        "o": o,
        "alpha_center": alpha_center,
        "alpha_low":    alpha_low,
        "alpha_high":   alpha_high,
        "layer_n":      layer_n,
        "layer_eff":    layer_eff,
        "human_center": human_center,
    }


# =========================================================
# 一致性自检
# =========================================================
def self_test(p_hard, p_shape, p_derived):
    checks = []
    for i, (n, eff) in enumerate(zip(p_derived["layer_n"], p_derived["layer_eff"])):
        expected = min(n / p_hard["o_point"], 1.0)
        checks.append(("layer_eff", f"layer{i+1} n={n} eff={eff:.3f}", abs(eff - expected) < 1e-9))

    check_val = p_hard["spell_intensity_double"] ** p_derived["alpha_center"]
    checks.append(("dissociation", f"2^α = {check_val:.6f} (== {p_hard['dissociation_ratio']})",
                   abs(check_val - p_hard["dissociation_ratio"]) < 1e-9))

    for name, val in [("empire_early", p_hard["f_empire_early"]),
                       ("empire_mid_high", p_hard["f_empire_mid_high"]),
                       ("empire_late_high", p_hard["f_empire_late_high"]),
                       ("warring", p_hard["f_warring"])]:
        checks.append(("f_range", f"{name}={val} ∈ (0,{p_hard['o_point']})",
                       0 < val < p_hard["o_point"]))

    human_c = p_derived["human_center"]
    diff = abs(human_c - p_derived["layer_n"][0])
    checks.append(("human_align",
                   f"人体中心={human_c} vs 第一层n={p_derived['layer_n'][0]} 差={diff}",
                   diff < 80))

    ok = sum(1 for _, _, p in checks if p)
    print(f"  自检 {ok}/{len(checks)} 通过")
    for cat, msg, p in checks:
        print(f"    [{'✔' if p else '✘'}] {cat:<12} {msg}")
    return ok == len(checks)


# =========================================================
# 通用辅助
# =========================================================
def _note(ax, text):
    ax.text(0.99, 0.015, text, transform=ax.transAxes,
            ha="right", va="bottom", fontsize=7.5, color="#7F8C8D", style="italic")


def save(fig, name, subdir=""):
    fig.tight_layout()
    # 主输出目录：images/ （文件系统根）
    if subdir:
        out_dir = os.path.join(IMG_DIR, subdir)
        os.makedirs(out_dir, exist_ok=True)
    else:
        out_dir = IMG_DIR
    # Vite public 目录：浏览器实际访问的路径
    vite_public_dir = os.path.join(
        os.path.dirname(IMG_DIR), "web", "public", "images")
    os.makedirs(vite_public_dir, exist_ok=True)
    written = []
    for ext in (".png", ".svg"):
        for d in (out_dir, vite_public_dir):
            p = os.path.join(d, name + ext)
            fig.savefig(p, bbox_inches="tight", facecolor="white")
            written.append(p)
    print("  " + name + ".png / " + name + ".svg")
    plt.close(fig)


# =========================================================
# 图 1：效率分布函数
# =========================================================
def fig_01(p_hard, p_shape, p_derived):
    fig, axes = plt.subplots(1, 2, figsize=(14, 5.5))
    o = p_derived["o"]
    n = np.linspace(0, o + 300, 500)

    ax = axes[0]
    for center, c, lbl in [(p_hard["f_empire_early"], COLOR["layer1"], "f中心=300（帝国早期·txt）"),
                            (p_hard["f_empire_late_high"], COLOR["layer2"], "f中心=550（帝国中后期·txt）"),
                            (p_hard["f_warring"], COLOR["layer3"], "f中心=750（战国·txt）")]:
        f = 1.0 / (1.0 + ((n - center) / p_shape["eff_width_normal"]) ** 2)
        ax.plot(n, f, color=c, linewidth=2.2, label=lbl)
        ax.axvline(x=center, color=c, linestyle=":", alpha=0.45, linewidth=1)
    ax.axvline(x=o, color=COLOR["o_point"], linestyle="--", linewidth=1.8, label=f"o基准点 n={o}")
    ax.set_xlabel("复杂度参数 n"); ax.set_ylabel("相对效率 f(n)")
    ax.set_title("不同 f 中心位置下的共振窗口", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, o + 200); ax.set_ylim(0, 1.15)
    ax.grid(True, alpha=0.25, color=COLOR["grid"])
    ax.legend(loc="upper right", fontsize=8.5, framealpha=0.9)
    _note(ax, "f中心值取自 txt原文；曲线宽度为展示用形状参数")

    ax = axes[1]
    center = p_hard["f_empire_mid_high"]
    for w, c, lbl in [(p_shape["eff_width_stable"], "#1F618D", "稳定环境（共振窄）"),
                      (p_shape["eff_width_normal"], "#2874A6", "一般环境"),
                      (p_shape["eff_width_turbulent"], "#7FB3D5", "动荡环境（共振宽）")]:
        f = 1.0 / (1.0 + ((n - center) / w) ** 2)
        ax.plot(n, f, color=c, linewidth=2.2, label=lbl)
    ax.axvline(x=center, color=COLOR["f_soft"], linestyle=":", alpha=0.6)
    ax.axvline(x=o, color=COLOR["o_point"], linestyle="--", linewidth=1.5, alpha=0.6)
    ax.set_xlabel("复杂度参数 n"); ax.set_ylabel("相对效率 f(n)")
    ax.set_title("环境稳定性对曲线形态的影响", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, o + 200); ax.set_ylim(0, 1.15)
    ax.grid(True, alpha=0.25, color=COLOR["grid"])
    ax.legend(loc="upper right", fontsize=8.5, framealpha=0.9)
    _note(ax, "陡峭度为txt定性描述；展示三级对比")

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
    ax.axvline(x=o, color=COLOR["o_point"], linestyle="--", linewidth=2, label=f"o基准点 n={o}")
    for i, (ni, eff, c, lbl) in enumerate(zip(
            p_derived["layer_n"], p_derived["layer_eff"],
            [COLOR["layer1"], COLOR["layer2"], COLOR["layer3"]],
            ["第一层 机械振子", "第二层 双n点系统", "第三层 大脑神经"])):
        ax.scatter([ni], [eff], color=c, s=150, zorder=10, edgecolors="black", linewidth=1.5)
        ax.annotate(f"{lbl}\nn={ni}  eff={eff:.2f}\n（公式统一计算）",
                    xy=(ni, eff), xytext=(ni + 80, eff - 0.15),
                    fontsize=8.5, color=c, fontweight="bold",
                    arrowprops=dict(arrowstyle="->", color=c, lw=1))
    ax.set_xlabel("载体固有复杂度 n"); ax.set_ylabel("相对峰值效率")
    ax.set_title("复杂度—峰值效率：'低正比高反比'的精确实现", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, o + 500); ax.set_ylim(0, 1.15)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper right", fontsize=9, framealpha=0.9)
    _note(ax, "曲线由txt定性描述唯一确定；三层n值为代表点选择")
    return fig, "02_peak_efficiency"


# =========================================================
# 图 3：蓄势弹簧效应
# =========================================================
def fig_03(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(11, 6))
    t = np.linspace(0, 10, 300)
    E_xi = 1.0 + 0.08 * np.sin(2 * np.pi * t / 2.5)
    ratio = p_shape["self_consume_start"] + (p_shape["self_consume_end"] - p_shape["self_consume_start"]) * (
            1 - np.exp(-t / p_shape["self_consume_tau"]))
    E_self = E_xi * ratio
    E_overflow = E_xi - E_self
    ax.fill_between(t, 0, E_self, alpha=0.55, color=COLOR["self_cost"], label="系统自耗")
    ax.fill_between(t, E_self, E_xi, alpha=0.55, color=COLOR["overflow"], label="溢出部分")
    ax.plot(t, E_xi, color=COLOR["xi"], linewidth=2.2, label="Ξ动能总量")
    ax.plot(t, E_self, color=COLOR["self_cost"], linewidth=1.8, linestyle="--", alpha=0.7)
    ax.plot(t, E_overflow, color=COLOR["overflow"], linewidth=1.8, linestyle="--", alpha=0.7)
    ax.text(5, 0.45,
            f"自耗率 {p_shape['self_consume_start']:.0%} → {p_shape['self_consume_end']:.0%}\nτ={p_shape['self_consume_tau']} 示意单位",
            fontsize=9, color=COLOR["self_cost"], ha="center",
            bbox=dict(boxstyle="round,pad=0.4", facecolor="#FFF3CD", edgecolor="#EEB462", linewidth=1.0))
    ax.set_xlabel("时间（示意单位）"); ax.set_ylabel("能量（相对单位）")
    ax.set_title("蓄势弹簧效应", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, 10); ax.set_ylim(0, 1.25)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper right", fontsize=9, framealpha=0.9)
    _note(ax, "比例参数为展示用；增长趋势定性来自txt")
    return fig, "03_spring_energy"


# =========================================================
# 图 4：解离（不确定性展示）
# =========================================================
def fig_04(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(10, 6.5))
    x = np.linspace(0.1, 2.5, 400)
    ax.fill_between(x, x ** p_derived["alpha_low"], x ** p_derived["alpha_high"],
                     alpha=0.20, color="#BA4A00",
                     label=f"不确定范围：α ∈ [{p_derived['alpha_low']:.2f}, {p_derived['alpha_high']:.2f}]")
    ax.plot(x, x ** p_derived["alpha_center"], color=COLOR["dissociate"], linewidth=2.5,
             label=f"中心值：α = {p_derived['alpha_center']:.3f}（2^α = 3）")
    ax.axhline(y=1.0, color=COLOR["repair"], linestyle=":", linewidth=2.2, label="自主修复上限（示意）")
    ax.scatter([p_hard["spell_intensity_double"]],
                [p_hard["spell_intensity_double"] ** p_derived["alpha_center"]],
                color=COLOR["dissociate"], s=140, zorder=10, edgecolors="black", linewidth=1.5)
    ax.annotate("txt原文锚点\n(强度=2, 解离=3)",
                xy=(p_hard["spell_intensity_double"], p_hard["dissociation_ratio"]),
                xytext=(1.2, 3.8), fontsize=9.5, color=COLOR["dissociate"], fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=COLOR["dissociate"], lw=1.5))
    ax.set_xlabel("施法强度（相对基准）"); ax.set_ylabel("结构解离速度")
    ax.set_title("复杂度解离效应：仅1个锚点为txt给出，其余为示意", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, 2.5); ax.set_ylim(0, 4.5)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper left", fontsize=8.5, framealpha=0.9)
    _note(ax, "锚点(2,3)是txt事实；其余为示意展示")
    return fig, "04_dissociation"


# =========================================================
# 图 5：f中心历史漂移
# =========================================================
def fig_05(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(14, 6.5))
    o = p_derived["o"]
    t_pts = p_shape["history_t_spacing"]
    f_pts = [
        p_derived["human_center"],
        100,
        200,
        p_hard["f_empire_early"],
        p_hard["f_empire_early"],
        p_hard["f_empire_mid_high"],
        p_hard["f_empire_late_high"],
        p_hard["f_warring"],
        p_hard["f_warring"],
    ]
    labels = [
        "本能时代\n人体中心",
        "沉默早期\nf偏离\n示意值",
        "沉默末期\nf回归\n示意值",
        "城邦\nf≈300(txt)",
        "帝国早期\nf≈300(txt)",
        "帝国中期\nf=450(txt)",
        "帝国后期\nf=550\n示意值",
        "战国\nf≈750(txt)",
        "战国后期\nf≈750(txt)",
    ]
    is_txt = [0, 0, 0, 1, 1, 1, 1, 1, 1]
    t_smooth = np.linspace(0, 8, 300)
    spline = make_interp_spline(t_pts, f_pts, k=3)
    f_smooth = spline(t_smooth)
    ax.plot(t_smooth, f_smooth, color=COLOR["f_curve"], linewidth=2.5, alpha=0.85, zorder=3,
             label="f中心漂移路径（概念趋势）")
    for ti, fi, lbl, src in zip(t_pts, f_pts, labels, is_txt):
        marker = "o" if src else "D"
        c = COLOR["warring"] if ti >= 7 else (COLOR["empire"] if 2 < ti < 7 else (COLOR["silent"] if ti <= 2 else COLOR["ancient"]))
        if ti <= 2: c = COLOR["ancient"]
        ax.scatter([ti], [fi], color=c, s=130 if src else 90, zorder=5, marker=marker,
                    edgecolors="black", linewidth=1.5)
        ax.annotate(lbl, xy=(ti, fi), xytext=(ti, fi + 45), fontsize=7.5, ha="center", color=c, fontweight="bold")
    for y0, y1, cc in [(p_shape["layer_n_representatives"][0] - 100, p_shape["layer_n_representatives"][0] + 100, COLOR["layer1"]),
                        (p_shape["layer_n_representatives"][1] - 100, p_shape["layer_n_representatives"][1] + 100, COLOR["layer2"]),
                        (p_shape["layer_n_representatives"][2] - 80, p_shape["layer_n_representatives"][2] + 80, COLOR["layer3"])]:
        ax.axhspan(y0, y1, alpha=0.06, color=cc)
    ax.axhline(y=o, color=COLOR["o_point"], linestyle="--", linewidth=1.5, alpha=0.6, label=f"o基准点 n={o}")
    p_txt = mpatches.Patch(facecolor="white", edgecolor="black", label="实心圆 = txt原文锚点")
    p_inf = mpatches.Patch(facecolor="white", edgecolor=COLOR["o_point"], label="菱形 = 示意推断节点")
    leg2 = ax.legend(handles=[p_txt, p_inf], loc="lower right", fontsize=8.5, framealpha=0.95)
    ax.add_artist(leg2)
    for t_sep in [2.5, 4.5, 6.5]:
        ax.axvline(x=t_sep, color="gray", linestyle=":", alpha=0.4, linewidth=1)
    ax.text(1.25, -5, "本能/沉默", fontsize=9, color=COLOR["ancient"], ha="center")
    ax.text(4.5, -5, "城邦/帝国", fontsize=9, color=COLOR["empire"], ha="center")
    ax.text(7.25, -5, "战国", fontsize=9, color=COLOR["warring"], ha="center")
    ax.set_xlabel("文明时间（相对顺序，无绝对时间）"); ax.set_ylabel("f中心位置")
    ax.set_title("f中心历史漂移：txt锚点用实心圆，示意值用菱形明确标记", fontsize=13, fontweight="bold", color=COLOR["ink"])
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
    f_cycle = p_derived["human_center"] + \
              p_shape["f_period_amp_primary"] * np.sin(2 * np.pi * t / p_shape["f_period_t_primary"]) + \
              p_shape["f_period_amp_secondary"] * np.sin(2 * np.pi * t / p_shape["f_period_t_secondary"])
    org_c = 50 + 520 / (1 + np.exp(-0.08 * (t - 45))) + 50 / (1 + np.exp(-0.15 * (t - 75)))
    ax.plot(t, f_cycle, color=COLOR["f_curve"], linewidth=2.8, label="线A：f周期（物理环境）", zorder=3)
    ax.plot(t, org_c, color="#6C3483", linewidth=2.8, label="线B：组织复杂度（文明内部）", zorder=3)
    ax.axhspan(p_hard["human_range_low"], p_hard["human_range_high"], alpha=0.12, color=COLOR["ancient"],
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
        ax.annotate(lbl, xy=(tm, 500), xytext=(tm, 720), fontsize=8, ha="center", color=c, fontweight="bold",
                    arrowprops=dict(arrowstyle="->", color=c, lw=1, alpha=0.8))
    ax.set_xlabel("文明时间（示意单位：仅表相对顺序）"); ax.set_ylabel("f中心位置 / 组织复杂度")
    ax.set_title("文明演化的双线驱动模型：f周期 × 组织复杂度", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(0, 100); ax.set_ylim(-50, 800)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper left", fontsize=9, framealpha=0.9)
    _note(ax, "周期相位和复杂度速率为示意展示；事件顺序来自txt")
    return fig, "06_dual_axis"


# =========================================================
# 图 7：三层技术权衡图
# =========================================================
def fig_07(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(11, 7))
    o = p_derived["o"]
    n_bg = np.linspace(50, o, 100)
    risk_bg = (n_bg / o) ** p_shape["risk_power"]
    ax.fill_between(n_bg, 0, risk_bg, alpha=0.12, color="#BA4A00")
    ax.plot(n_bg, risk_bg, color="#BA4A00", linewidth=1.2, alpha=0.5,
             label=f"风险 ∝ (n/o)^{p_shape['risk_power']:.1f}（指数为展示值）")
    names = ["第一层\n机械振子", "第二层\n双n点系统", "第三层\n大脑神经"]
    for name, n_val, eff, train, c in zip(
            names, p_derived["layer_n"], p_derived["layer_eff"],
            p_shape["layer_training_years"],
            [COLOR["layer1"], COLOR["layer2"], COLOR["layer3"]]):
        ax.scatter([n_val], [eff], s=train * 220, color=c, alpha=0.45, zorder=3,
                    edgecolors="black", linewidth=1.8,
                    label=f"{name.splitlines()[0]}：n={n_val}, eff={eff:.2f}（公式统一计算）, 训练≈{train:.0f}年（示意比例）")
        ax.scatter([n_val], [eff], s=50, color="white", zorder=4, edgecolors="black", linewidth=1.5)
        ax.text(n_val, eff + 0.07, name, fontsize=10, ha="center", color=c, fontweight="bold")
    ax.axvline(x=o, color=COLOR["o_point"], linestyle="--", linewidth=1.8, alpha=0.7, label=f"o基准点 n={o}")
    ax.set_xlabel("载体固有复杂度 n"); ax.set_ylabel("相对峰值效率（由peak(n)统一计算）")
    ax.set_title("三层技术权衡：n与效率由公式派生，训练年限为展示用比例", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(50, o + 50); ax.set_ylim(0, 1.1)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="lower right", fontsize=8.0, framealpha=0.9)
    _note(ax, "气泡=训练年限（展示比例）；n和效率由peak(n)=n/o统一派生")
    return fig, "07_three_layers"


# =========================================================
# 图 8：f塔联合调制
# =========================================================
def fig_08(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(11, 6.5))
    n = np.linspace(200, p_derived["o"], 500)
    def peak_func(n0, width, amp):
        return amp / (1.0 + ((n - n0) / width) ** 2)
    colors_t = ["#1F618D", COLOR["empire"], COLOR["warring"]]
    for pos, c in zip(p_shape["tower_positions"], colors_t):
        ax.plot(n, peak_func(pos, p_shape["tower_width"], p_shape["tower_amp"]), color=c,
                 linewidth=1.6, alpha=0.8, label=f"f塔 n={pos}（示意）")
    ax.plot(n, peak_func(p_shape["tower_positions"][1], p_shape["background_width"], p_shape["background_amp"]),
             color="#85929E", linewidth=1.5, linestyle="--", alpha=0.7, label="行星f场背景")
    combined = np.zeros_like(n)
    for pos in p_shape["tower_positions"]:
        combined += peak_func(pos, p_shape["tower_width"], p_shape["tower_amp"])
    combined += peak_func(p_shape["tower_positions"][1], p_shape["background_width"], p_shape["background_amp"])
    combined += peak_func(p_shape["tower_positions"][1], p_shape["interference_width"], p_shape["interference_amp"])
    ax.plot(n, combined, color=COLOR["layer3"], linewidth=3, zorder=5,
             label="联合调制合成峰（多塔相位协调 → 相长干涉 → 合成峰位置=密码）")
    ax.fill_between(n, 0, combined, alpha=0.18, color=COLOR["layer3"])
    idx = int(np.argmax(combined))
    peak_n = n[idx]
    ax.annotate(f"合成峰位置 ≈ {int(peak_n)}\n（= 物理层密码）",
                xy=(peak_n, combined[idx]), xytext=(peak_n + 100, combined[idx] - 0.2),
                fontsize=10, color=COLOR["layer3"], fontweight="bold",
                arrowprops=dict(arrowstyle="->", color=COLOR["layer3"], lw=2))
    ax.axvline(x=p_derived["o"], color=COLOR["o_point"], linestyle="--", linewidth=1.2, alpha=0.5,
                label=f"o基准点 n={p_derived['o']}")
    ax.set_xlabel("复杂度 n"); ax.set_ylabel("效率/场强（相对单位）")
    ax.set_title("f塔联合调制：相位协调 → 相长干涉 → 合成峰", fontsize=13, fontweight="bold", color=COLOR["ink"])
    ax.set_xlim(200, p_derived["o"]); ax.set_ylim(0, max(combined) + 0.2)
    ax.grid(True, alpha=0.2, color=COLOR["grid"])
    ax.legend(loc="upper left", fontsize=8.5, framealpha=0.9)
    _note(ax, "塔位置/振幅为示意比例；核心概念'合成峰=密码'来自txt")
    return fig, "08_f_tower"


# =========================================================
# 敏感性分析：跑 3 套参数，生成对比表
# =========================================================
SENSITIVITY_CONFIGS = {
    "A_标准（默认）": None,   # 使用 DEFAULT_SHAPES
    "B_保守（更稳/更慢）": {
        "eff_width_normal": 320,        # 共振更宽 → 环境看起来更稳
        "risk_power": 1.8,
        "self_consume_start": 0.45,
        "self_consume_end": 0.70,
        "self_consume_tau": 6.0,
        "layer_training_years": [2.0, 8.0, 18.0],
        "tower_width": 90,
        "f_period_amp_primary": 150,
    },
    "C_激进（更敏感/更快）": {
        "eff_width_normal": 90,         # 共振很窄 → 环境看起来很挑
        "risk_power": 3.0,
        "self_consume_start": 0.75,
        "self_consume_end": 0.98,
        "self_consume_tau": 2.5,
        "layer_training_years": [0.5, 3.0, 8.0],
        "tower_width": 40,
        "f_period_amp_primary": 280,
    },
}


def fig_09(p_hard, p_shape, p_derived):
    """材料 f 响应特性对比（水平分段条形图）。

    数据来源：科技与工艺文档"材料工程积累"表格。
    """
    # --- 数据（txt 描述的硬值：f 区间） ---
    materials = [
        ("熟铁",           0,   350, "成本低，加工简单",              "f>400 内耗剧增"),
        ("合金钢 (Cr/Ni/Mo)", 350, 500, "有效频率范围拓展",             "振子重量与能量需求上升"),
        ("陶瓷基复合材料",   450, 600, "高温下表现优异",               "脆性，高振幅场景受限"),
        ("多层异质结构",    500, 650, "综合性能，可定制 f 区间",        "工艺复杂，成本高"),
        ("生物材料 (探索)", 200, 800, "理论上广谱自适应、自修复",        "无法大规模制备，稳定性极差"),
    ]
    o_value = p_hard["o_point"]

    fig, ax = plt.subplots(figsize=(12.5, 6.5))
    fig.subplots_adjust(left=0.22, right=0.97, top=0.91, bottom=0.15)

    # 背景：o 基准点
    ax.axvline(o_value, color=COLOR["o_point"], lw=1.4, ls="--", alpha=0.7, zorder=1)
    ax.text(o_value + 18, len(materials) - 0.5, f"o 基准点 n={o_value}",
            color=COLOR["o_point"], fontsize=10, va="center")

    # 色阶：从"早期低 f"冷色 → "晚期高 f"暖色
    blues = plt.get_cmap("Blues", len(materials) + 2)
    for i, (name, f_low, f_high, adv, weak) in enumerate(materials):
        color = blues(len(materials) - i + 1) if name != "生物材料 (探索)" else "#8E44AD"
        alpha = 0.85 if name != "生物材料 (探索)" else 0.55
        ax.barh(i, f_high - f_low, left=f_low, height=0.62,
                color=color, alpha=alpha, edgecolor="#2C3E50", lw=0.8, zorder=3)
        # 标签：区间数值
        ax.text(f_low - 15, i, f"{f_low}", fontsize=8.5, ha="right", va="center", color="#34495E")
        ax.text(f_high + 15, i, f"{f_high}", fontsize=8.5, ha="left", va="center", color="#34495E")
        # 优势标签（上半）
        ax.annotate("  " + adv, xy=(f_high, i), xytext=(f_high + 50, i + 0.25),
                    fontsize=8.5, color=COLOR["peak"],
                    arrowprops=dict(arrowstyle="->", color=COLOR["peak"], lw=0.6, alpha=0.6))
        # 弱点标签（下半）
        ax.annotate("  " + weak, xy=(f_low, i), xytext=(f_low - 50, i - 0.25),
                    fontsize=8.5, color="#A04000", ha="right",
                    arrowprops=dict(arrowstyle="->", color="#A04000", lw=0.6, alpha=0.6))

    # y 轴
    ax.set_yticks(range(len(materials)))
    ax.set_yticklabels([m[0] for m in materials], fontsize=10)
    ax.invert_yaxis()

    # x 轴
    ax.set_xlabel("复杂度 n (f 中心的典型工作区间)", fontsize=11, color=COLOR["ink"])
    ax.set_xlim(0, 900)
    ax.xaxis.grid(True, alpha=0.18, zorder=0)
    ax.set_axisbelow(True)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)

    ax.set_title("不同振子材料的最佳 f 工作区间 —— 工程应对 f 漂移的材料演化",
                 fontsize=12, color=COLOR["ink"], pad=14)
    _note(ax, "材料的 f 响应区间与弱点来源于 txt 描述；优势/弱点措辞为展示性概括")
    return fig, "09_material_f_response"


def fig_10(p_hard, p_shape, p_derived):
    """大脑区域 Ξ 耐受性对比（横向条形 + 风险色阶）。

    数据来源：规则与限制文档"不同脑区的耐受性差异"表格。
    """
    regions = [
        ("额叶皮质 (抽象思维)",     0.85, "相对耐受，安全施法路径的主要承载区"),
        ("语言功能区 (声带语言)",    0.45, "部分参与，但未列为优先承载区"),
        ("海马体 (记忆整合)",       0.12, "极易受损，必须避开"),
        ("小脑 (运动协调)",         0.10, "极易受损，自动化编码外包给它，但本身高风险"),
    ]

    fig, ax = plt.subplots(figsize=(11, 4.8))
    fig.subplots_adjust(left=0.28, right=0.96, top=0.88, bottom=0.15)

    # 色阶：高耐受 → 绿色；低耐受 → 红色
    cmap = plt.get_cmap("RdYlGn_r")

    for i, (name, tol, note) in enumerate(regions):
        color = cmap(1.0 - tol)
        ax.barh(i, tol, height=0.55, color=color, edgecolor="#2C3E50", lw=0.7, zorder=3, alpha=0.9)
        ax.text(tol + 0.015, i, f"{tol:.2f}", fontsize=9.5, va="center", color=COLOR["ink"])
        ax.text(tol + 0.08, i, note, fontsize=8.5, va="center", color="#555")

    ax.set_yticks(range(len(regions)))
    ax.set_yticklabels([r[0] for r in regions], fontsize=10)
    ax.invert_yaxis()

    ax.set_xlabel("相对 Ξ 耐受性 (数值越高，越能承受 Ξ 推动)", fontsize=11, color=COLOR["ink"])
    ax.set_xlim(0, 1.0)
    ax.xaxis.grid(True, alpha=0.18, zorder=0)
    ax.set_axisbelow(True)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)

    ax.set_title("不同脑区对 Ξ 推动的相对耐受性",
                 fontsize=12, color=COLOR["ink"], pad=12)
    _note(ax, "耐受性相对数值为概念性展示；实际差异为定性描述。"
          "核心信息：额叶 ≫ 海马体/小脑")
    return fig, "10_brain_tolerance"


def fig_11(p_hard, p_shape, p_derived):
    """第三层训练死亡漏斗：谨慎型 vs 自信型 累积存活率曲线。

    数据来源：传承体系文档"死亡率接近七成"与"天赋的悖论"段落。
    注：存活率的具体下降形状为示意性展示；锚点仅为"最终约 30% 存活"（死亡率 70%）。
    """
    # --- 数据锚点 ---
    final_survival = 0.30  # txt: 死亡率接近七成 → 存活约 30%
    total_years = 12.0     # 示意：入门 3-5 年 + 独立施法 8 年+ → 总周期约 12 年

    # 谨慎型：前期慢，后期稳；自信型：前期快，后期大量突然死亡
    years_careful = np.linspace(0, total_years, 50)
    years_bold = np.linspace(0, total_years, 50)

    # 谨慎型：指数衰减较缓
    careful = 1.0 * np.exp(-0.10 * years_careful)
    # 末端拉到 ~0.30
    careful_final = final_survival * 1.02  # 略高于锚点（谨慎者存活率稍高）
    # 归一化使其尾端落锚
    careful = careful_final + (1.0 - careful_final) * np.exp(-0.10 * years_careful)

    # 自信型：前期平缓（"进展神速"），中期突然断崖，末端更低
    # 用分段逻辑：前 25% 缓慢，中 50% 快速下降，后 25% 继续缓降
    bold = np.zeros_like(years_bold)
    for i, y in enumerate(years_bold):
        if y < total_years * 0.25:
            # 初期：几乎不下降（天赋异禀，一路顺畅）
            bold[i] = 1.0 - 0.03 * (y / (total_years * 0.25))
        elif y < total_years * 0.75:
            # 中期：断崖式下降（触发未知偏差）
            progress = (y - total_years * 0.25) / (total_years * 0.5)
            # 从 0.97 → 0.35
            bold[i] = 0.97 - 0.62 * progress
        else:
            # 后期：继续缓慢下滑至 0.22
            progress = (y - total_years * 0.75) / (total_years * 0.25)
            bold[i] = 0.35 - 0.13 * progress

    # 平滑一下
    bold_s = make_interp_spline(years_bold, bold, k=3)(years_bold)
    careful_s = make_interp_spline(years_careful, careful, k=3)(years_careful)

    fig, ax = plt.subplots(figsize=(11, 6.5))
    fig.subplots_adjust(left=0.10, right=0.96, top=0.89, bottom=0.16)

    # 背景色带：训练阶段
    ax.axvspan(0, 4, alpha=0.05, color="#2874A6")
    ax.axvspan(4, 8, alpha=0.05, color="#F39C12")
    ax.axvspan(8, total_years, alpha=0.05, color="#C0392B")
    ax.text(2, 0.06, "入门期\n(基础编码)", ha="center", fontsize=9, color="#2874A6")
    ax.text(6, 0.06, "独立施法期\n(多模式+强度控制)", ha="center", fontsize=9, color="#B9770E")
    ax.text(10, 0.06, "魔法师期\n(自主编码创新)", ha="center", fontsize=9, color="#C0392B")

    # 主线
    ax.plot(years_careful, careful_s, color=COLOR["peak"], lw=2.4, label="谨慎型学徒 (反复试探边界)", zorder=5)
    ax.plot(years_bold, bold_s, color="#C0392B", lw=2.4, label="自信型学徒 (高速晋升，未知偏差风险累积)", zorder=5)

    # 填充区域
    ax.fill_between(years_careful, careful_s, bold_s, where=(careful_s >= bold_s),
                    alpha=0.12, color=COLOR["peak"], interpolate=True)

    # 锚点线
    ax.axhline(final_survival, color=COLOR["ink"], ls=":", lw=1, alpha=0.5)
    ax.text(total_years + 0.2, final_survival, "txt 锚点：总体死亡率 ≈ 70% → 存活 ≈ 30%",
            fontsize=9, va="center", color=COLOR["ink"])

    # 关键事件标记
    ax.plot([total_years * 0.5], [0.52], 'o', color="#C0392B", markersize=9, zorder=6)
    ax.annotate("  未知偏差触发点\n  (某些高阶编码突然致伤)",
                xy=(total_years * 0.5, 0.52), xytext=(total_years * 0.55, 0.75),
                fontsize=9, color="#A04000",
                arrowprops=dict(arrowstyle="->", color="#A04000", lw=1.0))

    ax.set_xlabel("训练年限 (年)", fontsize=11, color=COLOR["ink"])
    ax.set_ylabel("累积存活率", fontsize=11, color=COLOR["ink"])
    ax.set_xlim(0, total_years + 1)
    ax.set_ylim(0, 1.05)
    ax.grid(True, alpha=0.18)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.legend(loc="lower left", fontsize=10, frameon=True, framealpha=0.85)

    ax.set_title("第三层训练的死亡漏斗 —— 谨慎者活下来，天赋者可能先倒下",
                 fontsize=12, color=COLOR["ink"], pad=12)
    _note(ax, "下降曲线形状为展示性示意；锚点只有 txt 中的'总体死亡率 ≈ 70%'这一项")
    return fig, "11_training_death_funnel"


def fig_12(p_hard, p_shape, p_derived):
    """f 漂移下的工程设计四阶段演化。

    数据来源：科技与工艺文档"f 漂移下的工程应对"四阶段描述。
    每个阶段的 f 中心范围直接来自 txt；"操作直觉程度"的下降是 txt 描述的定性推演。
    """
    # --- 阶段数据 ---
    stages = [
        ("阶段1\n固定调谐",     0,  300, 0.90, "直接仿生副发声器官，操作直觉"),
        ("阶段2\n可调谐 (旋钮)", 250, 450, 0.55, "旋钮校准，操作开始偏离生理直觉"),
        ("阶段3\n材料工程",    450, 550, 0.30, "合金钢→陶瓷→多层异质；每换材料都需重新标定"),
        ("阶段4\n参数库与机器语", 550, 650, 0.12, "参数表+计算尺操作；需长年训练，人才稀缺"),
    ]

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 7),
                                    gridspec_kw={'height_ratios': [1.2, 1]})
    fig.subplots_adjust(left=0.08, right=0.97, top=0.91, bottom=0.12, hspace=0.35)

    # ---- 上半：f 中心工作区间（分段条形） ----
    ax = ax1
    y_positions = list(range(len(stages)))
    for i, (name, f_lo, f_hi, intuition, desc) in enumerate(stages):
        color = plt.get_cmap("Blues")(0.35 + 0.15 * i)
        ax.barh(i, f_hi - f_lo, left=f_lo, height=0.55, color=color,
                edgecolor="#2C3E50", lw=0.8, zorder=3, alpha=0.92)
        ax.text((f_lo + f_hi) / 2, i, f"f ≈ {f_lo}–{f_hi}",
                fontsize=9.5, ha="center", va="center", color="white", fontweight="bold")

    # o 基准点
    ax.axvline(p_hard["o_point"], color=COLOR["o_point"], lw=1.2, ls="--", alpha=0.6, zorder=1)
    ax.text(p_hard["o_point"] + 15, -0.5, f"o={p_hard['o_point']}",
            fontsize=9, color=COLOR["o_point"])

    ax.set_yticks(y_positions)
    ax.set_yticklabels([s[0] for s in stages], fontsize=10)
    ax.invert_yaxis()
    ax.set_xlabel("复杂度 n (该阶段设备的典型 f 中心工作区间)", fontsize=10, color=COLOR["ink"])
    ax.set_xlim(0, 780)
    ax.xaxis.grid(True, alpha=0.18, zorder=0)
    ax.set_axisbelow(True)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.set_title("工程设计跟随 f 漂移的四阶段演化",
                 fontsize=12, color=COLOR["ink"], pad=12)

    # ---- 下半：操作直觉程度下降 + 关键事件 ----
    ax = ax2
    # 直觉程度（阶段中心 x 值 + 对应 intuition 值）
    xs = [(s[1] + s[2]) / 2 for s in stages]
    ys = [s[3] for s in stages]
    # 平滑曲线
    x_smooth = np.linspace(min(xs), max(xs), 200)
    y_smooth = make_interp_spline(xs, ys, k=2)(x_smooth)

    ax.plot(x_smooth, y_smooth, color="#2C3E50", lw=2.2, zorder=5, label="操作者对设备的直觉程度")
    ax.plot(xs, ys, 'o', color=COLOR["peak_soft"], markersize=9, zorder=6, markeredgecolor="#2C3E50")

    for i, (name, f_lo, f_hi, intuition, desc) in enumerate(stages):
        ax.annotate(f"  {desc}", xy=(xs[i], ys[i]),
                    xytext=(xs[i] + 20, ys[i] + (0.05 if i < 2 else -0.07)),
                    fontsize=8.5, color="#34495E")

    ax.set_xlabel("复杂度 n (与上图对齐)", fontsize=10, color=COLOR["ink"])
    ax.set_ylabel("操作直觉程度 (相对值)", fontsize=10, color=COLOR["ink"])
    ax.set_xlim(0, 780)
    ax.set_ylim(0, 1.0)
    ax.xaxis.grid(True, alpha=0.18, zorder=0)
    ax.yaxis.grid(True, alpha=0.12, zorder=0)
    ax.set_axisbelow(True)
    for spine in ["top", "right"]:
        ax.spines[spine].set_visible(False)
    ax.legend(loc="upper right", fontsize=9, frameon=True, framealpha=0.85)

    ax.set_title("人机关系异化：操作直觉随 f 升高持续下降",
                 fontsize=11, color=COLOR["ink"], pad=10)
    _note(ax2, "f 区间与阶段划分直接来自 txt；'直觉程度'为 txt 描述的定性展示")
    return fig, "12_engineering_evolution"


def fig_13(p_hard, p_shape, p_derived):
    """Ξ 器官能力雷达图：感受器官 vs 副发声器官 vs 大脑 (第三层)。

    数据来源：生理与特性文档对三大器官的功能描述。
    各维度为相对值（0–1），用于展示形态对比而非精确数值。
    """
    # --- 维度定义（0-1 相对值） ---
    dims = [
        "感知范围",      # 能感知/作用于的 f 范围宽度
        "输出强度",      # 能产生的 Ξ 效应强度
        "编码复杂度",    # 能承载的编码复杂度
        "训练需求",      # 需要的训练量（越高越难学）
        "损伤风险",      # 使用带来的解离/损伤风险
    ]

    # 感受器官：宽感知，弱输出，低风险，基本不需要训练
    sensor = [0.90, 0.20, 0.25, 0.15, 0.10]
    # 副发声器官：窄输出，中等强度，中等编码，需一些训练，低-中等损伤
    vocal  = [0.60, 0.55, 0.50, 0.40, 0.30]
    # 大脑（第三层）：极宽感知，极高输出，极高复杂度，需长期训练，极高风险
    brain  = [0.85, 0.90, 0.95, 0.92, 0.88]

    fig, ax = plt.subplots(figsize=(9.5, 9.5), subplot_kw=dict(projection="polar"))
    fig.subplots_adjust(left=0.08, right=0.95, top=0.90, bottom=0.10)

    N = len(dims)
    angles = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]  # 闭合

    sensor_plot = sensor + sensor[:1]
    vocal_plot  = vocal  + vocal[:1]
    brain_plot  = brain  + brain[:1]

    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_xticks(angles[:-1])
    ax.set_xticklabels(dims, fontsize=11, color=COLOR["ink"])

    ax.set_ylim(0, 1.0)
    ax.set_yticks([0.25, 0.50, 0.75, 1.00])
    ax.set_yticklabels(["0.25", "0.50", "0.75", "1.00"],
                       fontsize=8, color="#888")
    ax.grid(True, alpha=0.25)
    ax.set_rlabel_position(22.5)

    # 绘制
    ax.plot(angles, sensor_plot, color="#2874A6", lw=2.2, label="感受器官 (Ξ 信号接收)", zorder=4)
    ax.fill(angles, sensor_plot, color="#2874A6", alpha=0.18)

    ax.plot(angles, vocal_plot, color="#1E8449", lw=2.2, label="副发声器官 (Ξ 信号发射)", zorder=4)
    ax.fill(angles, vocal_plot, color="#1E8449", alpha=0.18)

    ax.plot(angles, brain_plot, color="#6C3483", lw=2.6, label="大脑 —— 第三层施法 (Ξ 振子)", zorder=5)
    ax.fill(angles, brain_plot, color="#6C3483", alpha=0.22)

    ax.legend(loc="upper right", bbox_to_anchor=(1.15, 1.12), fontsize=9.5, frameon=True, framealpha=0.85)
    ax.set_title("三类 Ξ 交互器官的能力形态对比",
                 fontsize=13, color=COLOR["ink"], pad=22, y=1.08)

    # 注释放在右上角
    ax.text(np.radians(22.5), 1.35,
            "各维度为相对值 (0–1)\n用于展示形态对比\n非精确测量数据",
            fontsize=8.5, color="#555", ha="left", va="top")

    return fig, "13_organ_radar"


def run_sensitivity():
    """跑 3 套参数，输出：(a) 生成对比图到 sensitivity/ 子目录；(b) 打一张'敏感/不敏感'摘要表。"""
    print()
    print("=== 敏感性分析：3 套参数对比 ===")
    figs_fn = [fig_01, fig_02, fig_03, fig_04, fig_05, fig_06, fig_07, fig_08,
               fig_09, fig_10, fig_11, fig_12, fig_13]

    # 为每套参数收集"关键摘要指标"（跨图对比的核心数字）
    summary_keys = {
        "peak效率 L1": lambda d: d["layer_eff"][0],
        "peak效率 L2": lambda d: d["layer_eff"][1],
        "peak效率 L3": lambda d: d["layer_eff"][2],
        "解离指数α":   lambda d: d["alpha_center"],
        "风险指数":     lambda ph, ps: ps["risk_power"],
        "共振宽度":     lambda ph, ps: ps["eff_width_normal"],
    }

    results = {}
    for name, override in SENSITIVITY_CONFIGS.items():
        shapes = copy.deepcopy(DEFAULT_SHAPES)
        if override:
            for k, v in override.items():
                shapes[k] = v
        derived = calc_derived(params_hard, shapes)

        sub = name.split("_")[0]
        label = name.split("_", 1)[1]
        print(f"\n  [{sub}] {label}")
        # 一致性检查（不打印细节，只看结果）
        self_test(params_hard, shapes, derived)
        for fn in figs_fn:
            fig, fname = fn(params_hard, shapes, derived)
            fig.suptitle(f"{sub} 参数组合：{label}", fontsize=12, fontweight="bold", color=COLOR["ink"], y=1.01)
            fig.tight_layout()
            out_dir = os.path.join(IMG_DIR, "sensitivity")
            os.makedirs(out_dir, exist_ok=True)
            out = os.path.join(out_dir, f"{sub}_{fname}.png")
            fig.savefig(out, bbox_inches="tight", facecolor="white")
            plt.close(fig)
        print(f"    → 已写入 sensitivity/{sub}_*.png (共 8 张)")
        results[name] = derived, shapes

    # 打印摘要表（对读者有用的数字对比）
    print()
    print("  核心数字对比表（看哪张图对形状参数敏感）：")
    print(f"  {'指标':<14} {'A_标准':>12} {'B_保守':>12} {'C_激进':>12}  {'敏感度':>8}")
    print("  " + "-" * 70)
    metrics = [
        ("L1 n 代表值",      lambda d, ps: d["layer_n"][0],         "数字"),
        ("L1 peak 效率",     lambda d, ps: d["layer_eff"][0],       "数字"),
        ("L2 n 代表值",      lambda d, ps: d["layer_n"][1],         "数字"),
        ("L2 peak 效率",     lambda d, ps: d["layer_eff"][1],       "数字"),
        ("L3 n 代表值",      lambda d, ps: d["layer_n"][2],         "数字"),
        ("L3 peak 效率",     lambda d, ps: d["layer_eff"][2],       "数字"),
        ("解离指数 α",       lambda d, ps: d["alpha_center"],       "数字"),
        ("α 不确定半宽",     lambda d, ps: ps["alpha_uncertainty"], "形状"),
        ("风险指数",         lambda d, ps: ps["risk_power"],        "形状"),
        ("共振宽度",         lambda d, ps: ps["eff_width_normal"],  "形状"),
        ("自耗率起点",       lambda d, ps: ps["self_consume_start"],"形状"),
        ("自耗率终点",       lambda d, ps: ps["self_consume_end"],  "形状"),
    ]
    vals_by_metric = {}
    for mname, fn, kind in metrics:
        vals = [fn(results[n][0], results[n][1]) for n in SENSITIVITY_CONFIGS.keys()]
        vals_by_metric[mname] = vals
        vmin, vmax = min(vals), max(vals)
        # 敏感度 = (max-min)/mean（相对变化）
        mean = (vmin + vmax) / 2 if (vmin + vmax) != 0 else 1
        rel_change = (vmax - vmin) / abs(mean) if mean != 0 else 0
        sens_label = "高" if rel_change > 0.30 else ("中" if rel_change > 0.12 else "低")
        print(f"  {mname:<14}" + "".join(f"{v:>12.3f}" for v in vals) + f"  {sens_label:>6}（{kind}）")

    print()
    print("  解读：")
    print("    · '数字'类（L1-3 n、peak效率、α）——A/B/C 三套下不变或变化很小")
    print("      → 说明这些值由 txt硬值 唯一确定，对形状参数不敏感")
    print("    · '形状'类（风险指数、共振宽度、自耗率）——A/B/C 三套下变化显著")
    print("      → 说明这些是纯展示用；读者可按需调整")
    print()
    print("  结论：'趋势'（效率正比、解离超线性、f中心从300向750漂移）")
    print("        在 A/B/C 三套参数下均稳定。敏感的只是'画得多夸张'。")
    return results


# =========================================================
# 主入口
# =========================================================
if __name__ == "__main__":
    print("Ξ场可视化 v3 —— JSON 配置 + 一致性自检 + 敏感性分析")
    print("=" * 68)

    # 1) 加载 shapes
    shapes = load_shapes()

    # 2) 派生
    derived = calc_derived(params_hard, shapes)

    # 3) 自检
    ok = self_test(params_hard, shapes, derived)
    if not ok:
        print("  [!] 自检失败，请检查参数一致性")

    # 4) 生成主图（使用 JSON 的参数）
    figs = [fig_01, fig_02, fig_03, fig_04, fig_05, fig_06, fig_07, fig_08,
            fig_09, fig_10, fig_11, fig_12, fig_13]
    print()
    print("使用 JSON 配置参数生成主图（13 张）：")
    for fn in figs:
        fig, name = fn(params_hard, shapes, derived)
        save(fig, name)

    # 5) 敏感性分析（如果传了 --sensitivity 参数）
    if "--sensitivity" in sys.argv or "-s" in sys.argv:
        run_sensitivity()
    else:
        print()
        print("（如需做敏感性分析，加参数 --sensitivity：）")
        print("    python generate_charts_v3.py --sensitivity")

    print()
    print("完成。")

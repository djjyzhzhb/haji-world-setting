# -*- coding: utf-8 -*-
"""
Ξ场魔法体系 —— v4 适应性图表生成

基于本次重构后的文本内容，生成新的适应性图表：
- 阅读路径导航图
- 概念层级树
- 历史三轴图（时间 / f中心 / 技术-社会事件）
- 势力关系网络图
- 三层技术风险-收益矩阵
- 产业链价值分配图
- 传承体系训练漏斗

使用：
    python generate_charts_v4.py
"""

import os
import sys
import numpy as np

# 将 matplotlib 配置目录限制在项目内，避免访问用户目录
HERE = os.path.dirname(os.path.abspath(__file__))
os.environ["MPLCONFIGDIR"] = os.path.join(HERE, ".matplotlib_cache")
os.makedirs(os.environ["MPLCONFIGDIR"], exist_ok=True)

import matplotlib
matplotlib.use("Agg")  # 无头后端，不依赖 GUI
import matplotlib.pyplot as plt
from matplotlib import rcParams
import matplotlib.patches as mpatches

# 导入 v3 的硬参数和颜色（假设 v3 与本文件同目录）
sys.path.insert(0, HERE)
from generate_charts_v3 import params_hard, COLOR, load_shapes, calc_derived, save, _note

rcParams["font.sans-serif"] = ["Microsoft YaHei", "SimHei",
                               "Arial Unicode MS", "DejaVu Sans"]
rcParams["axes.unicode_minus"] = False
rcParams["figure.dpi"] = 160
rcParams["savefig.dpi"] = 160

HERE = os.path.dirname(os.path.abspath(__file__))


# =========================================================
# 图 14：阅读路径导航图
# =========================================================
def fig_14_reading_path(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(14, 8))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 10)
    ax.axis("off")

    # 节点定义：(x, y, label, color, width)
    nodes = [
        (2.0, 9.0, "阅读索引\n与概念速查", COLOR["o_point"], 2.0),
        (2.0, 7.0, "根本法则\n三条铁律", COLOR["f_curve"], 1.8),
        (5.5, 9.0, "力量体系总论\n全局框架", COLOR["layer2"], 1.8),
        (5.5, 7.0, "体系A：\n原理与来源", COLOR["layer1"], 1.8),
        (5.5, 5.0, "体系A：\n分类与层级", COLOR["layer2"], 1.8),
        (5.5, 3.0, "体系A：\n规则与限制", COLOR["layer3"], 1.8),
        (9.0, 7.0, "因果链图谱\n双线驱动", COLOR["peak"], 1.8),
        (9.0, 5.0, "大年表\n文明史诗", COLOR["ancient"], 1.8),
        (9.0, 3.0, "纪元划分\n时代切片", COLOR["silent"], 1.8),
        (12.0, 5.0, "延伸专题\n科技·产业·政治·种族", COLOR["empire"], 2.0),
    ]

    # 绘制边（箭头）
    edges = [
        (0, 1, "先读"),
        (0, 2, "再读"),
        (1, 2, "支撑"),
        (2, 3, "深入"),
        (3, 4, "映射"),
        (4, 5, "约束"),
        (3, 6, "解释历史"),
        (6, 7, "时间轴"),
        (6, 8, "时代切片"),
        (5, 9, "应用展开"),
        (7, 9, "背景"),
        (8, 9, "背景"),
    ]

    for i, j, label in edges:
        x1, y1, *_ = nodes[i]
        x2, y2, *_ = nodes[j]
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="->", color="#7F8C8D", lw=1.5,
                                    connectionstyle="arc3,rad=0.1"))
        # 中点标注
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        ax.text(mx, my + 0.25, label, ha="center", va="bottom",
                fontsize=7.5, color="#7F8C8D")

    for x, y, label, color, w in nodes:
        rect = mpatches.FancyBboxPatch((x - w/2, y - 0.55), w, 1.1,
                                        boxstyle="round,pad=0.03,rounding_size=0.2",
                                        facecolor=color, alpha=0.18, edgecolor=color,
                                        linewidth=2)
        ax.add_patch(rect)
        ax.text(x, y, label, ha="center", va="center", fontsize=9.5,
                fontweight="bold", color=color)

    ax.set_title("图 14 阅读路径导航图", fontsize=14, fontweight="bold",
                 color=COLOR["ink"], pad=15)
    _note(ax, "推荐路径：索引→铁律→总论→原理→分类→规则→因果链→历史→专题")
    return fig, "14_reading_path_map"


# =========================================================
# 图 15：概念层级树
# =========================================================
def fig_15_concept_tree(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(14, 7.5))
    ax.set_xlim(0, 14)
    ax.set_ylim(0, 8)
    ax.axis("off")

    # 层级节点：每行从左到右展开
    levels = [
        [(7.0, 7.0, "世界铁律\n（因果律 / 物质 / 代价）", COLOR["o_point"], 2.2)],
        [(4.0, 5.5, "Ξ 场三公理\n（守恒 / 解离 / 负反馈）", COLOR["f_curve"], 2.0),
         (10.0, 5.5, "因果链\n双线驱动", COLOR["peak"], 1.8)],
        [(2.0, 4.0, "f 函数\n效率分布", COLOR["layer1"], 1.6),
         (5.0, 4.0, "n 点运动\n蓄势弹簧", COLOR["layer2"], 1.6),
         (8.0, 4.0, "三层载体\n机械/接口/大脑", COLOR["layer3"], 1.8),
         (11.5, 4.0, "f 周期\n历史节律", COLOR["ancient"], 1.6)],
        [(2.0, 2.5, "工业应用\n第一层", COLOR["layer1"], 1.6),
         (5.0, 2.5, "转译接口\n第二层", COLOR["layer2"], 1.6),
         (8.0, 2.5, "内源施法\n第三层", COLOR["layer3"], 1.6),
         (11.5, 2.5, "文明演化\n语言·帝国·战国", COLOR["empire"], 1.8)],
        [(3.5, 1.0, "产业与生产\n经济维度", COLOR["f_curve"], 1.6),
         (7.0, 1.0, "政治与传承\n组织维度", COLOR["silent"], 1.6),
         (10.5, 1.0, "种族与文化\n生理维度", COLOR["warring"], 1.6)],
    ]

    # 绘制连接
    connections = [
        ((7.0, 7.0), (4.0, 5.5)), ((7.0, 7.0), (10.0, 5.5)),
        ((4.0, 5.5), (2.0, 4.0)), ((4.0, 5.5), (5.0, 4.0)),
        ((4.0, 5.5), (8.0, 4.0)), ((10.0, 5.5), (11.5, 4.0)),
        ((2.0, 4.0), (2.0, 2.5)), ((5.0, 4.0), (5.0, 2.5)),
        ((8.0, 4.0), (8.0, 2.5)), ((11.5, 4.0), (11.5, 2.5)),
        ((2.0, 2.5), (3.5, 1.0)), ((5.0, 2.5), (7.0, 1.0)),
        ((8.0, 2.5), (10.5, 1.0)), ((11.5, 2.5), (10.5, 1.0)),
    ]

    for (x1, y1), (x2, y2) in connections:
        ax.plot([x1, x2], [y1 - 0.45, y2 + 0.55], color="#95A5A6", lw=1.5, zorder=1)

    for level in levels:
        for x, y, label, color, w in level:
            rect = mpatches.FancyBboxPatch((x - w/2, y - 0.45), w, 0.9,
                                            boxstyle="round,pad=0.02,rounding_size=0.15",
                                            facecolor="white", edgecolor=color,
                                            linewidth=2, zorder=2)
            ax.add_patch(rect)
            ax.text(x, y, label, ha="center", va="center", fontsize=8.5,
                    fontweight="bold", color=color, zorder=3)

    ax.set_title("图 15 概念层级树：从物理公理到文明应用", fontsize=14,
                 fontweight="bold", color=COLOR["ink"], pad=15)
    _note(ax, "纵向：抽象程度递减；横向：同一层级的不同展开方向")
    return fig, "15_concept_hierarchy_tree"


# =========================================================
# 图 16：历史三轴图
# =========================================================
def fig_16_history_triple_axis(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(14, 7))

    # 时间轴：从史前到战国末期
    stages = ["史前", "远古", "古人类", "古代-近古", "城邦", "共和", "帝国早期",
              "帝国中期", "帝国晚期", "战国早期", "战国中后期"]
    x = np.arange(len(stages))

    # f 中心曲线（基于硬参数插值）
    f_center = np.array([
        250, 250, 200, 150, 200, 250, 300, 375, 475, 650, 750
    ])

    # 绘制 f 中心曲线
    ax.plot(x, f_center, color=COLOR["f_curve"], linewidth=2.5, marker="o",
            markersize=7, label="f 中心位置", zorder=5)
    ax.fill_between(x, 100, f_center, color=COLOR["f_soft"], alpha=0.15)
    ax.axhline(y=400, color=COLOR["layer1"], linestyle="--", linewidth=1.5, alpha=0.6,
               label="人体范围上沿")
    ax.axhline(y=850, color=COLOR["layer3"], linestyle="--", linewidth=1.5, alpha=0.6,
               label="大脑危险区")
    ax.axhline(y=1000, color=COLOR["o_point"], linestyle="--", linewidth=2,
               label="o 基准点")

    # 事件标注（用不同颜色和垂直文本）
    events = [
        (3, "声带语言成熟\n文字诞生", COLOR["silent"]),
        (6, "Ξ工业兴盛\n参数手册", COLOR["empire"]),
        (7, "材料库积累\n远洋生物", COLOR["layer2"]),
        (8, "转译接口诞生\n机器语时代", COLOR["layer2"]),
        (9, "第三层实验\n死亡率70%", COLOR["layer3"]),
        (10, "f塔网络\n传承体系", COLOR["warring"]),
    ]
    for xi, text, c in events:
        ax.annotate(text, xy=(xi, f_center[xi]), xytext=(xi, f_center[xi] + 180),
                    ha="center", va="bottom", fontsize=8, color=c,
                    fontweight="bold",
                    arrowprops=dict(arrowstyle="->", color=c, lw=1.2),
                    bbox=dict(boxstyle="round,pad=0.3", facecolor="white",
                              edgecolor=c, alpha=0.9))

    ax.set_xticks(x)
    ax.set_xticklabels(stages, rotation=35, ha="right", fontsize=9)
    ax.set_ylabel("f 中心位置（n 值）", fontsize=11)
    ax.set_ylim(0, 1000)
    ax.set_title("图 16 历史三轴图：时间 · f中心 · 文明事件", fontsize=14,
                 fontweight="bold", color=COLOR["ink"])
    ax.grid(True, alpha=0.25, color=COLOR["grid"], axis="y")
    ax.legend(loc="upper left", fontsize=8.5, framealpha=0.9)
    _note(ax, "f中心值基于原文硬参数；展示物理环境线与历史事件的耦合")
    return fig, "16_history_triple_axis"


# =========================================================
# 图 17：势力关系网络图
# =========================================================
def fig_17_faction_network(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(12, 10))
    ax.set_xlim(-1.2, 1.2)
    ax.set_ylim(-1.2, 1.2)
    ax.axis("off")

    # 节点：角度、半径、标签、颜色、大小
    nodes = [
        (0, 0, "Ξ场技术\n整体生态", COLOR["o_point"], 0.18),
        (90, 0.75, "帝国政权\n（工部/皇家学会）", COLOR["empire"], 0.12),
        (150, 0.75, "皇家工坊\n军械工坊", COLOR["layer1"], 0.10),
        (30, 0.75, "沿海社团\n神秘生物研究", COLOR["layer2"], 0.10),
        (210, 0.75, "战国列国\n独立研究院", COLOR["warring"], 0.12),
        (270, 0.75, "民间社团\n仿生编程", COLOR["silent"], 0.10),
        (330, 0.75, "传承体系\n三层施法者", COLOR["layer3"], 0.12),
        (180, 0.35, "产业资本\n原材料/设备", COLOR["f_curve"], 0.09),
    ]

    # 绘制节点
    for angle_deg, r, label, color, size in nodes:
        angle = np.deg2rad(angle_deg)
        x, y = r * np.cos(angle), r * np.sin(angle)
        circle = plt.Circle((x, y), size, color=color, alpha=0.2, ec=color, linewidth=2.5)
        ax.add_patch(circle)
        ax.text(x, y, label, ha="center", va="center", fontsize=8.5,
                fontweight="bold", color=color)

    # 边：连接关系与强度（使用完整节点标签作为键）
    edges = [
        ("帝国政权\n（工部/皇家学会）", "皇家工坊\n军械工坊", "控制", 2.5),
        ("帝国政权\n（工部/皇家学会）", "沿海社团\n神秘生物研究", "资助/监控", 1.5),
        ("沿海社团\n神秘生物研究", "皇家工坊\n军械工坊", "技术输入", 1.5),
        ("帝国政权\n（工部/皇家学会）", "产业资本\n原材料/设备", "专卖/许可证", 2.0),
        ("战国列国\n独立研究院", "民间社团\n仿生编程", "吸纳/竞争", 2.0),
        ("战国列国\n独立研究院", "传承体系\n三层施法者", "庇护/依赖", 2.5),
        ("民间社团\n仿生编程", "传承体系\n三层施法者", "人才来源", 1.5),
        ("传承体系\n三层施法者", "产业资本\n原材料/设备", "设备需求", 1.5),
        ("沿海社团\n神秘生物研究", "战国列国\n独立研究院", "人才流失", 1.0),
        ("皇家工坊\n军械工坊", "产业资本\n原材料/设备", "产品输出", 1.5),
    ]

    # 建立名称到坐标的映射
    pos = {}
    for angle_deg, r, label, color, size in nodes:
        angle = np.deg2rad(angle_deg)
        pos[label] = (r * np.cos(angle), r * np.sin(angle))

    for a, b, label, lw in edges:
        x1, y1 = pos[a]
        x2, y2 = pos[b]
        ax.plot([x1, x2], [y1, y2], color="#95A5A6", linewidth=lw, alpha=0.6, zorder=1)
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        # 避免文字重叠，用微偏移
        ax.text(mx, my + 0.05, label, ha="center", va="bottom",
                fontsize=7, color="#5D6D7E", bbox=dict(boxstyle="round,pad=0.15",
                                                       facecolor="white", alpha=0.8,
                                                       edgecolor="none"))

    ax.set_title("图 17 势力关系网络：帝国—战国技术生态", fontsize=14,
                 fontweight="bold", color=COLOR["ink"], pad=15)
    _note(ax, "节点大小不代表势力强弱，只表示在本章中的讨论权重；边粗细表示关系强度")
    return fig, "17_faction_relationship"


# =========================================================
# 图 18：三层技术风险-收益矩阵
# =========================================================
def fig_18_risk_benefit_matrix(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(10, 8))

    layers = [
        ("第一层\n机械振子", 0.35, 0.15, 0.95, COLOR["layer1"]),
        ("第二层\n转译接口", 0.65, 0.45, 0.70, COLOR["layer2"]),
        ("第三层\n内源施法", 0.95, 0.90, 0.10, COLOR["layer3"]),
    ]

    for label, x, y, popularity, color in layers:
        size = 1200 + 3000 * popularity
        ax.scatter(x, y, s=size, c=color, alpha=0.35, edgecolors=color, linewidths=2.5, zorder=5)
        ax.scatter(x, y, s=80, c=color, zorder=6)
        ax.annotate(label, xy=(x, y), xytext=(x + 0.05, y + 0.05),
                    fontsize=10, fontweight="bold", color=color)

    # 添加参考区域
    ax.axvline(x=0.5, color="#BDC3C7", linestyle="--", linewidth=1)
    ax.axhline(y=0.5, color="#BDC3C7", linestyle="--", linewidth=1)
    ax.text(0.25, 0.95, "低风险·低收益\n（基础设施层）", ha="center", va="top",
            fontsize=9, color="#7F8C8D")
    ax.text(0.75, 0.95, "高风险·高收益\n（战略/禁忌层）", ha="center", va="top",
            fontsize=9, color="#7F8C8D")
    ax.text(0.25, 0.05, "低风险·低收益\n（民用普及层）", ha="center", va="bottom",
            fontsize=9, color="#7F8C8D")

    ax.set_xlim(0, 1.1)
    ax.set_ylim(0, 1.05)
    ax.set_xlabel("编码自由度 / 应用收益", fontsize=11)
    ax.set_ylabel("风险 / 代价（解离、训练死亡、社会管控）", fontsize=11)
    ax.set_title("图 18 三层技术风险-收益矩阵", fontsize=14,
                 fontweight="bold", color=COLOR["ink"])
    ax.grid(True, alpha=0.25, color=COLOR["grid"])

    # 图例：气泡大小 = 普及度
    legend_sizes = [0.9, 0.5, 0.1]
    legend_labels = ["高普及", "中普及", "低普及"]
    for size, lbl in zip(legend_sizes, legend_labels):
        ax.scatter([], [], s=1200 + 3000 * size, c="#95A5A6", alpha=0.35,
                   label=lbl)
    ax.legend(scatterpoints=1, frameon=True, labelspacing=1.5, loc="lower right",
              fontsize=9, title="气泡大小 = 社会普及度")

    _note(ax, "坐标为定性评估，反映三层技术在本世界观中的定位差异")
    return fig, "18_risk_benefit_matrix"


# =========================================================
# 图 19：产业链价值分配与管控强度
# =========================================================
def fig_19_value_chain(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(13, 6.5))

    stages = ["原材料\n供应", "振子\n制造", "设备\n组装", "终端\n应用"]
    x = np.arange(len(stages))
    width = 0.35

    # 利润率（定性）
    profit_rate = [15, 35, 25, 45]
    # 管控强度（0-100）
    control_intensity = [90, 95, 60, 30]

    bars1 = ax.bar(x - width/2, profit_rate, width, label="利润率（%·定性）",
                   color=COLOR["peak_soft"], edgecolor=COLOR["peak"], linewidth=1.5)
    ax2 = ax.twinx()
    bars2 = ax2.bar(x + width/2, control_intensity, width, label="管控强度（0-100）",
                    color=COLOR["dissociate"], alpha=0.4, edgecolor=COLOR["dissociate"],
                    linewidth=1.5)

    ax.set_xticks(x)
    ax.set_xticklabels(stages, fontsize=11)
    ax.set_ylabel("利润率（%）", fontsize=11, color=COLOR["peak"])
    ax2.set_ylabel("管控强度", fontsize=11, color=COLOR["dissociate"])
    ax.set_ylim(0, 60)
    ax2.set_ylim(0, 110)

    # 标注数值
    for bar in bars1:
        h = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2, h + 1, f"{h}%", ha="center",
                va="bottom", fontsize=9, color=COLOR["peak"], fontweight="bold")
    for bar in bars2:
        h = bar.get_height()
        ax2.text(bar.get_x() + bar.get_width()/2, h + 2, f"{h}", ha="center",
                 va="bottom", fontsize=9, color=COLOR["dissociate"], fontweight="bold")

    ax.set_title("图 19 Ξ 工业产业链：利润率与管控强度", fontsize=14,
                 fontweight="bold", color=COLOR["ink"])
    ax.grid(True, alpha=0.25, color=COLOR["grid"], axis="y")

    # 合并图例
    lines1, labels1 = ax.get_legend_handles_labels()
    lines2, labels2 = ax2.get_legend_handles_labels()
    ax.legend(lines1 + lines2, labels1 + labels2, loc="upper center",
              fontsize=9, framealpha=0.9)

    _note(ax, "数据为定性示意：振子制造利润高但管控最强，终端应用利润高但管控最弱")
    return fig, "19_value_chain"


# =========================================================
# 图 20：传承体系训练漏斗
# =========================================================
def fig_20_training_pipeline(p_hard, p_shape, p_derived):
    fig, ax = plt.subplots(figsize=(12, 7))
    ax.set_xlim(0, 12)
    ax.set_ylim(0, 8)
    ax.axis("off")

    # 阶段定义：x, y, 标签, 宽度, 高度, 颜色, 通过率
    stages = [
        (1.5, 6.5, "筛选期\n（天赋/体质）", 2.0, 0.9, COLOR["layer1"], 1.00),
        (4.0, 6.5, "学徒期\n基础神经控制", 2.0, 0.9, COLOR["layer2"], 0.80),
        (6.5, 6.5, "技师期\n接口操作", 2.0, 0.9, COLOR["layer2"], 0.55),
        (9.0, 6.5, "接口期\n切断仪器连接", 2.0, 0.9, COLOR["layer3"], 0.25),
        (5.5, 3.5, "自主编码期\n独立设计Ξ程序", 2.2, 1.0, COLOR["layer3"], 0.08),
        (8.5, 3.5, "魔法师\n国家战略资产", 2.0, 1.0, COLOR["o_point"], 0.01),
    ]

    for x, y, label, w, h, color, rate in stages:
        rect = mpatches.FancyBboxPatch((x - w/2, y - h/2), w, h,
                                        boxstyle="round,pad=0.02,rounding_size=0.15",
                                        facecolor=color, alpha=0.18, edgecolor=color,
                                        linewidth=2)
        ax.add_patch(rect)
        ax.text(x, y, label, ha="center", va="center", fontsize=9.5,
                fontweight="bold", color=color)
        ax.text(x, y - h/2 - 0.35, f"留存率 {rate*100:.0f}%", ha="center", va="top",
                fontsize=8, color="#5D6D7E")

    # 绘制箭头
    arrows = [
        ((2.5, 6.5), (3.0, 6.5)),
        ((5.0, 6.5), (5.5, 6.5)),
        ((7.5, 6.5), (8.0, 6.5)),
        ((10.0, 6.5), (9.6, 4.0)),
        ((6.6, 3.5), (7.5, 3.5)),
    ]
    for (x1, y1), (x2, y2) in arrows:
        ax.annotate("", xy=(x2, y2), xytext=(x1, y1),
                    arrowprops=dict(arrowstyle="->", color="#7F8C8D", lw=1.8))

    # 死亡/淘汰标注
    ax.text(3.0, 5.5, "淘汰：基础神经控制失败", ha="center", fontsize=8,
            color=COLOR["dissociate"], style="italic")
    ax.text(5.5, 5.5, "淘汰：接口操作失误", ha="center", fontsize=8,
            color=COLOR["dissociate"], style="italic")
    ax.text(8.0, 5.5, "淘汰：切断仪器后神经损伤", ha="center", fontsize=8,
            color=COLOR["dissociate"], style="italic")
    ax.text(9.0, 2.5, "整体存活率 ≈ 1%", ha="center", fontsize=10,
            color=COLOR["o_point"], fontweight="bold")

    ax.set_title("图 20 传承体系训练漏斗与淘汰路径", fontsize=14,
                 fontweight="bold", color=COLOR["ink"], pad=15)
    _note(ax, "数据基于原文'死亡率接近七成'及'幸存者比例不到百分之一'的定性映射")
    return fig, "20_training_pipeline"


# =========================================================
# 主入口
# =========================================================
if __name__ == "__main__":
    print("Ξ场可视化 v4 —— 基于重构后文本的适应性图表")
    print("=" * 60)

    shapes = load_shapes()
    derived = calc_derived(params_hard, shapes)

    new_figs = [fig_14_reading_path, fig_15_concept_tree, fig_16_history_triple_axis,
                fig_17_faction_network, fig_18_risk_benefit_matrix,
                fig_19_value_chain, fig_20_training_pipeline]

    print(f"生成新图表（{len(new_figs)} 张）：")
    for fn in new_figs:
        fig, name = fn(params_hard, shapes, derived)
        save(fig, name)

    print()
    print("完成。")

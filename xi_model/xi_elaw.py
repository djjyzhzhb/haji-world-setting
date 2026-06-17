"""
E-law 基准-偏离动力学模块
==========================
实现宇宙顶层法则 —— 基准-偏离指数增益动力学。

用户原始描述:
  在此宇宙中，存在某种我们完全无法摸清的基准 B。
  当任意形态逐渐靠近B时，进度以e常数进行增长；
  到达B时推进效应立即失效；
  远离B的条件限制于一切宏观层面(微观无效)；
  偏离=拉势能，推进=释放动能；
  Ξ的大部分被用作推进增长的燃料，观测到的仅是溢出(基于消散值2)。

形式化:
  d = |S - B| / S_scale          (无量纲偏离距离)
  G(d) = exp(α * Ξ_fuel / (d + d_0))  (指数增益因子)
  dS/dt = -γ_base * G(d) * (S - S_eq) * Θ_macro(scale)  (弛豫方程)
  溢出比例: ε(d) = f(d, dissipation=2)

注意: B (基准) 在本模型中为不可直接观测的形而上量。
      S_eq (平衡态) 是可观测的系统状态值。
      当 S = B = S_eq 时, d=0, G→1(有限基值), 但因(S-S_eq)=0, 推进为0。

补充: 豆包 v2.0 的弛豫方程形式:
  dS/dt = -γ_base [1 + γ(N) Ξ_fuel] (S - S_eq)
  本模块将此推广为指数增益形式以匹配用户描述。
"""

import math
from typing import List, Optional


# ============================================================
# 偏离距离
# ============================================================

def deviation_distance(S: float, B: float, S_scale: float = 1.0) -> float:
    """
    无量纲偏离距离

    d = |S - B| / S_scale

    参数:
        S: 当前系统状态值
        B: 基准 (不可直接观测，但用于理论建模)
        S_scale: 特征尺度

    返回:
        d ≥ 0
    """
    if S_scale <= 0:
        raise ValueError("S_scale must be positive")
    return abs(S - B) / S_scale


# ============================================================
# 偏离势能
# ============================================================

def deviation_potential(d: float) -> float:
    """
    偏离势能 —— "拉弓"储存的能量

    V(d) = ln(1 + d)

    对数形式确保:
    - 大偏离时势能增长趋缓 (对应"拉得越远越费力")
    - d=0时 V=0 (基准处无势能)

    物理图像: 如同拉伸弹簧，偏离基准越远越需要做功。
    """
    if d < 0:
        raise ValueError("d must be non-negative")
    return math.log(1.0 + d)


# ============================================================
# 指数增益因子
# ============================================================

def gain_factor(
    d: float,
    Xi_fuel: float,
    alpha: float = 1.0,
    d_0: float = 0.01,
) -> float:
    """
    指数增益因子 —— "释放动能"的放大器

    G(d, Ξ_fuel) = 1 + (exp(α·Ξ_fuel) - 1) · d_0/(d + d_0)

    性质:
    - d 大 (远离基准): G → 1 (增益消失)
    - d → 0 (到达基准): G → exp(α·Ξ_fuel) (有限最大值)
    - Ξ_fuel = 0: G = 1 (无燃料无增益)
    - 以e为底的增长来自 exp(α·Ξ_fuel) 项

    用户描述的 "e常数增长": 最大增益 = e^(α·Ξ_fuel)

    与之前发散形式的区别:
    到达基准时增益不是无穷大，而是有限值 exp(α·Ξ_fuel)，
    然后因为 (S-S_eq)=0 推动力自然消失 → "到达即终止"

    参数:
        d: 偏离距离
        Xi_fuel: Ξ燃料量 (无量纲, 归一化)
        alpha: 增益灵敏度
        d_0: 过渡区特征宽度
    """
    if Xi_fuel <= 0:
        return 1.0
    if d < 0:
        d = 0.0

    G_max = math.exp(alpha * Xi_fuel)
    weight = d_0 / (d + d_0)
    return 1.0 + (G_max - 1.0) * weight


# ============================================================
# 弛豫速率
# ============================================================

def relaxation_rate(
    d: float,
    Xi_fuel: float,
    gamma_base: float,
    alpha: float = 1.0,
    d_0: float = 0.01,
) -> float:
    """
    有效弛豫速率

    γ_eff = γ_base * G(d, Xi_fuel)

    对应豆包方程中的: γ_base [1 + γ(N) Ξ_fuel]
    推广为指数形式以匹配用户的E-law描述
    """
    G = gain_factor(d, Xi_fuel, alpha, d_0)
    return gamma_base * G


# ============================================================
# 弛豫步进
# ============================================================

def relaxation_step(
    S: float,
    S_eq: float,
    Xi_fuel: float,
    gamma_base: float,
    dt: float,
    alpha: float = 1.0,
    B: Optional[float] = None,
    S_scale: float = 1.0,
    d_0: float = 0.01,
) -> float:
    """
    单步 Euler 积分

    dS/dt = -γ_eff * (S - S_eq)
    S_{t+dt} = S_t + dS/dt * dt

    如果 S = B = S_eq: d=0, 推进效应终止 (用户原始约束)
    """
    if B is None:
        B = S_eq

    d = deviation_distance(S, B, S_scale)
    gamma_eff = relaxation_rate(d, Xi_fuel, gamma_base, alpha, d_0)

    dS = -gamma_eff * (S - S_eq) * dt
    return S + dS


# ============================================================
# 尺度判据
# ============================================================

def scale_criterion(
    size: float,
    threshold: float = 1.0,
    sharpness: float = 5.0,
) -> float:
    """
    宏观/微观判据 (S型过渡)

    Θ(size) = 1 / (1 + exp(-k * (size - thr)))

    用户约束: "远离的条件限制于一切宏观层面，微观无效"
    → 微观系统(小size) 无法触发偏离势能效应

    参数:
        size: 系统特征尺寸 (无量纲或归一化)
        threshold: 宏观阈值
        sharpness: S型过渡锐度

    返回:
        Θ ∈ [0, 1]: 0=微观无效, 1=宏观有效
    """
    return 1.0 / (1.0 + math.exp(-sharpness * (size - threshold)))


def macro_only_effective(
    d: float,
    size: float,
    threshold: float = 1.0,
    sharpness: float = 5.0,
) -> float:
    """
    宏观偏离有效性

    仅在宏观尺度 (size > threshold) 下，偏离基准才产生势能。

    返回: 有效偏离距离 (微观时被抑制为接近0)
    """
    sc = scale_criterion(size, threshold, sharpness)
    return d * sc


# ============================================================
# 溢出比例
# ============================================================

def spillover_fraction(
    d: float,
    dissipation: float = 2.0,
    d_0: float = 0.01,
) -> float:
    """
    Ξ溢出比例 —— 基于消散值2

    ε(d) = 1 / (dissipation + d / d_0)

    用户描述: "溢出基于一个溢出常数的消散值2"
    物理图像:
    - d 小 (接近基准): 增益大 → 高阶模式易退相干 → 溢出多
    - d 大 (远离基准): 溢出少
    - dissipation = 2: 基准溢出上限 = 1/2

    注意: 此ε(d)与豆包v2.0的ε_Ξ ~ 10⁻⁵独立。
          豆包的ε_Ξ是Krawtchouk模式层面的溢出(无关于d)，
          这里的ε(d)是E-law层面的溢出(依赖于偏离度)。
          两者的关系: ε_observed = ε_krawtchouk * ε_elaw(d)
    """
    if d < 0:
        d = 0.0
    return 1.0 / (dissipation + d / d_0)


# ============================================================
# E-law 系统
# ============================================================

class E_Law_System:
    """
    E-law 动力学系统

    封装一个向基准B弛豫的系统，包含偏离势能、指数增益、尺度判据。
    """

    def __init__(
        self,
        S0: float,
        S_eq: float,
        B: Optional[float] = None,
        gamma_base: float = 0.1,
        alpha: float = 1.0,
        d_0: float = 0.01,
        S_scale: float = 1.0,
        macro_threshold: float = 1.0,
        macro_sharpness: float = 5.0,
    ):
        """
        参数:
            S0: 初始状态
            S_eq: 平衡态 (可观测)
            B: 基准 (形而上, 默认=S_eq)
            gamma_base: 基础弛豫速率
            alpha: 增益灵敏度
            d_0: 正则化参数
            S_scale: 特征尺度
            macro_threshold: 宏观阈值
            macro_sharpness: S型锐度
        """
        self.S = S0
        self.S0 = S0
        self.S_eq = S_eq
        self.B = B if B is not None else S_eq
        self.gamma_base = gamma_base
        self.alpha = alpha
        self.d_0 = d_0
        self.S_scale = S_scale
        self.macro_threshold = macro_threshold
        self.macro_sharpness = macro_sharpness

    def step(self, Xi_fuel: float, dt: float, size: float = 10.0) -> float:
        """
        单步演化

        参数:
            Xi_fuel: Ξ燃料量 (无量纲)
            dt: 时间步长
            size: 当前系统宏观尺度

        返回: 新的S值
        """
        d_raw = deviation_distance(self.S, self.B, self.S_scale)
        # 微观尺度抑制偏离
        d_eff = macro_only_effective(
            d_raw, size, self.macro_threshold, self.macro_sharpness
        )
        # 有效弛豫速率 (考虑增益)
        G = gain_factor(d_eff, Xi_fuel, self.alpha, self.d_0)
        gamma_eff = self.gamma_base * G

        dS = -gamma_eff * (self.S - self.S_eq) * dt
        self.S += dS
        return self.S

    def evolve(
        self,
        Xi_fuel: float,
        dt: float,
        n_steps: int,
        size: float = 10.0,
    ) -> List[float]:
        """
        演化 n_steps 步，返回历史轨迹

        返回: list of S values (len = n_steps + 1, 含初始值)
        """
        self.S = self.S0  # 重置
        history = [self.S]
        for _ in range(n_steps):
            self.step(Xi_fuel, dt, size)
            history.append(self.S)
        return history

    def convergence_time(
        self,
        Xi_fuel: float,
        tolerance: float = 0.01,
        dt: float = 0.01,
        max_steps: int = 100000,
        size: float = 10.0,
    ) -> int:
        """
        估计收敛时间 (到达 tolerance 范围内的步数)

        返回: 步数, 若未收敛则返回 -1
        """
        self.S = self.S0
        target = self.S_eq
        for step in range(max_steps):
            if abs(self.S - target) < tolerance:
                return step
            self.step(Xi_fuel, dt, size)
        return -1

    def analyze_gain(self, Xi_fuel: float, d_range: tuple = (0.0, 5.0), n_points: int = 100) -> dict:
        """
        分析增益随偏离度的变化

        返回: {"d": [...], "G": [...], "gamma_eff": [...]}
        """
        import numpy as np
        ds = np.linspace(d_range[0], d_range[1], n_points)
        Gs = [gain_factor(d, Xi_fuel, self.alpha, self.d_0) for d in ds]
        gammas = [self.gamma_base * g for g in Gs]
        return {"d": ds.tolist(), "G": Gs, "gamma_eff": gammas}

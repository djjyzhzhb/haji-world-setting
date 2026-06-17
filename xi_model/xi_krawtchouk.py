"""
Krawtchouk 多项式模块
======================
实现 K_n(x; p, N) 的稳定递推计算、正交性验证、模式分析。

定义:
  采用 monic Krawtchouk 多项式 —— 首项系数为1。
  三项递推 (稳定形式):
    (n+1) K_{n+1}(x) = [(N-2n)p + n - x] K_n(x) - n(1-p)(N-n+1) K_{n-1}(x)
    初始: K_0(x)=1, K_1(x)=Np-x

权函数 (二项分布):
    w(x) = C(N,x) p^x (1-p)^{N-x}

正交性 (数值验证):
    Σ_x w(x) K_m(x) K_n(x) = h_n δ_{mn}
    h_n 由数值积分确定

参考: 豆包 Ξ场-基准增益模型 v2.0
"""

import math
from typing import Tuple, List


# ============================================================
# 组合数 (对数域，防溢出)
# ============================================================

def _log_comb(n: int, k: int) -> float:
    """ln C(n, k)"""
    if k < 0 or k > n:
        return -float('inf')
    if k == 0 or k == n:
        return 0.0
    k = min(k, n - k)
    result = 0.0
    for i in range(1, k + 1):
        result += math.log(n - k + i) - math.log(i)
    return result


def _comb(n: int, k: int) -> float:
    """C(n, k); 返回 float 因大N下可能超过int范围"""
    return math.exp(_log_comb(n, k))


# ============================================================
# 二项权重
# ============================================================

def binomial_weight(x: int, p: float, N: int) -> float:
    """
    w(x) = C(N,x) p^x (1-p)^{N-x}
    直接计算，适用于中等N (< 1000)
    """
    if x < 0 or x > N:
        return 0.0
    ln_w = _log_comb(N, x) + x * math.log(p) + (N - x) * math.log(1 - p)
    return math.exp(ln_w)


def log_binomial_weight(x: int, p: float, N: int) -> float:
    """对数域版本，适用于大N"""
    if x < 0 or x > N:
        return -float('inf')
    return _log_comb(N, x) + x * math.log(p) + (N - x) * math.log(1 - p)


# ============================================================
# Krawtchouk 多项式 —— 递推 (唯一计算入口)
# ============================================================

def krawtchouk(n: int, x: int, p: float, N: int) -> float:
    """
    K_n(x; p, N) —— monic Krawtchouk 多项式

    三项递推:
        (n+1) K_{n+1} = [(N-2n)p + n - x] K_n - n(1-p)(N-n+1) K_{n-1}
        K_0(x) = 1
        K_1(x) = Np - x

    这是模块唯一的多项式计算入口。所有下游分析均调用此函数。

    参数:
        n: 多项式阶数 (0 ≤ n ≤ N)
        x: 自变量 (0 ≤ x ≤ N, 整数)
        p: 二项参数 (0 < p < 1)
        N: 总量子位数

    返回:
        K_n(x)
    """
    if n < 0:
        return 0.0
    if n == 0:
        return 1.0

    k_prev = 1.0  # K_0
    k_curr = N * p - float(x)  # K_1

    if n == 1:
        return k_curr

    for k in range(1, n):
        coeff = (N - 2 * k) * p + k - float(x)
        dec = p * (1.0 - p) * (N - k + 1)
        k_next = (coeff * k_curr - dec * k_prev) / (k + 1)
        k_prev = k_curr
        k_curr = k_next

    return k_curr


# ============================================================
# 正交性验证 (数值积分)
# ============================================================

def orthogonality_check(m: int, n: int, p: float, N: int) -> float:
    """
    计算 Σ_x w(x) K_m(x) K_n(x)
    用于验证正交性和归一化
    """
    total = 0.0
    for x in range(N + 1):
        w = binomial_weight(x, p, N)
        km = krawtchouk(m, x, p, N)
        kn = krawtchouk(n, x, p, N)
        total += w * km * kn
    return total


def norm_squared(n: int, p: float, N: int) -> float:
    """
    h_n = ⟨K_n, K_n⟩ = Σ w(x) K_n(x)²

    通过数值积分计算（而非解析公式），确保与递推一致性。
    """
    return orthogonality_check(n, n, p, N)


def orthogonality_matrix(max_n: int, p: float, N: int) -> List[List[float]]:
    """
    返回 (max_n+1) × (max_n+1) 的正交性矩阵
    M[m][n] = ⟨K_m, K_n⟩
    对角元 = h_n, 非对角元应接近0
    """
    M = [[0.0] * (max_n + 1) for _ in range(max_n + 1)]
    for m in range(max_n + 1):
        for n in range(m, max_n + 1):
            v = orthogonality_check(m, n, p, N)
            M[m][n] = v
            M[n][m] = v
    return M


# ============================================================
# 归一化多项式
# ============================================================

def krawtchouk_normalized(n: int, x: int, p: float, N: int) -> float:
    """
    归一化 Krawtchouk 多项式: K̃_n(x) = K_n(x) / √h_n

    满足: Σ w(x) K̃_m(x) K̃_n(x) = δ_{mn}
    """
    h = norm_squared(n, p, N)
    if h <= 0:
        return 0.0
    return krawtchouk(n, x, p, N) / math.sqrt(h)


# ============================================================
# 模式支撑区间
# ============================================================

def mode_support_interval(
    n: int, p: float, N: int, threshold: float = 0.1
) -> Tuple[int, int]:
    """
    K_n(x) 的"有效支撑区间"
    |K_n(x)| 相对最大幅度 ≥ threshold 的 x 范围

    返回 (lo, hi) 闭区间
    """
    if n == 0:
        return (0, N)

    abs_vals = [abs(krawtchouk(n, x, p, N)) for x in range(N + 1)]
    max_abs = max(abs_vals)

    if max_abs == 0:
        return (0, N)

    threshold_abs = max_abs * threshold
    lo, hi = 0, N
    for x in range(N + 1):
        if abs_vals[x] >= threshold_abs:
            lo = x
            break
    for x in range(N, -1, -1):
        if abs_vals[x] >= threshold_abs:
            hi = x
            break

    return (lo, hi)


def mode_resonance_interval(
    n: int, p: float, N: int, noise_floor: float = 0.01
) -> list:
    """
    返回 K_n 的共振区间列表
    x 在哪些范围内 |K_n(x)| > noise_floor * max(|K_n|)

    因为 Krawtchouk 多项式振荡，可能有多段有效区间
    """
    if n == 0:
        return [(0, N)]

    abs_vals = [abs(krawtchouk(n, x, p, N)) for x in range(N + 1)]
    max_abs = max(abs_vals) if abs_vals else 0
    if max_abs == 0:
        return [(0, N)]

    threshold = max_abs * noise_floor
    intervals = []
    in_interval = False
    start = 0

    for x in range(N + 1):
        if abs_vals[x] >= threshold:
            if not in_interval:
                start = x
                in_interval = True
        else:
            if in_interval:
                intervals.append((start, x - 1))
                in_interval = False

    if in_interval:
        intervals.append((start, N))

    return intervals


# ============================================================
# 有效模式数
# ============================================================

def effective_mode_count(N: int, p_eq: float, noise_floor: float = 0.01) -> int:
    """
    估算在此(N, p_eq)条件下，可被有效区分的模式总数

    判定标准:
    在概率分布 w(x) 的 1% ~ 99% 分位数范围内，
    至少存在一个 x 使归一化后 |K̃_n(x)| > noise_floor。

    返回: 可区分的最高阶数
    """
    if N <= 0:
        return 0

    # 概率分布的集中区域 (排除尾部)
    from collections import namedtuple
    cum = 0.0
    x_lo, x_hi = 0, N
    for x in range(N + 1):
        cum += binomial_weight(x, p_eq, N)
        if cum >= 0.01 and x_lo == 0:
            x_lo = x
        if cum >= 0.99:
            x_hi = x
            break

    for n in range(N + 1):
        h = norm_squared(n, p_eq, N)
        if h <= 0:
            continue
        max_signal = 0.0
        for x in range(x_lo, x_hi + 1):
            v = abs(krawtchouk_normalized(n, x, p_eq, N))
            if v > max_signal:
                max_signal = v
        if max_signal < noise_floor and n > 0:
            return n
    return min(N + 1, N + 1)


def mode_distribution_analysis(
    N: int, p_eq: float, noise_floor: float = 0.01
) -> dict:
    """
    完整的模式分布分析

    返回:
    - n_effective: 有效模式总数
    - per_mode: 每个模式的支撑区间
    - fuel_vs_spillover: 燃料/溢出分类
    """
    n_eff = effective_mode_count(N, p_eq, noise_floor)

    per_mode = []
    for n in range(min(n_eff, N + 1)):
        intervals = mode_resonance_interval(n, p_eq, N, noise_floor)
        total_width = sum(hi - lo + 1 for lo, hi in intervals)
        per_mode.append({
            "n": n,
            "intervals": intervals,
            "total_support_width": total_width,
            "fraction": total_width / (N + 1),
        })

    # 燃料通道: 支撑宽度 ≥ 10% N 的模式
    n_fuel_max = -1
    for mode in per_mode:
        if mode["fraction"] >= 0.1:
            n_fuel_max = mode["n"]
        else:
            break

    n_spillover_min = n_fuel_max + 1 if n_fuel_max >= 0 else 0

    return {
        "n_effective": n_eff,
        "n_fuel_max": n_fuel_max,
        "n_spillover_min": min(n_spillover_min, n_eff),
        "per_mode": per_mode[:20],  # 限制返回量
    }

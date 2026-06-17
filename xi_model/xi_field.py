"""
Ξ 场态空间与耦合模块
====================
实现：平衡态分布、有效耦合、相干体积、能量密度。

假设: 质量比例荷模型 (模型II) —— 耦合强度正比于物质质量密度
    非相对论极限 (v << c)
    弱驱动线性响应

参考: 豆包 v2.0 参数体系
"""

import math
from typing import Tuple


# ============================================================
# 物理常数
# ============================================================

HBAR_EVS = 6.582119569e-16  # hbar [eV·s]
KB_EVK = 8.617333262e-5     # k_B [eV/K]
C = 2.99792458e8             # 光速 [m/s]
EV_TO_J = 1.602176634e-19    # eV → J


# ============================================================
# 基准参数 (豆包 v2.0)
# ============================================================

BENCHMARK_PARAMS = {
    "alpha_xi0": 1.00e-12,
    "lambda_xi": 7.26e-8,         # GeV (from l_Ξ via l_Ξ = hbar*c/(Lambda*e))
    "delta_e_vac": 9.93e-11,     # eV
    "tau_coh0": 1.00e-3,         # s
    "kappa_rho": 1.00e3,
    "beta_coh": 0.5,
    "N_c": 6.66e8,
    "l_xi": 1.00e-9,              # m (adjusted: 原 1.97e-31 → 1e-9, 解决能量密度过高)
    "rho_xi": 1.00e27,            # m^-3 = 1/l_xi^3
}


# ============================================================
# 热激发概率
# ============================================================

def thermal_excitation_prob(delta_e: float, T: float) -> float:
    """
    二能级系统在温度T下的热平衡激发概率
    p_eq = 1 / (1 + exp(ΔE / kT))

    参数:
        delta_e: 能隙 [eV]
        T: 温度 [K]

    返回:
        p_eq ∈ [0, 0.5]
    """
    if T <= 0:
        return 0.0
    # 防止数值溢出: ΔE/kT > 700 → exp溢出 → p_eq ≈ 0
    exponent = delta_e / (KB_EVK * T)
    if exponent > 700:
        return 0.0
    return 1.0 / (1.0 + math.exp(exponent))


# ============================================================
# 有效耦合常数
# ============================================================

def effective_coupling(
    alpha_xi0: float,
    rho: float,
    kappa_rho: float,
    rho_0: float = 1.0,
) -> float:
    """
    质量比例荷模型下的有效耦合常数

    g_eff(rho) = α_Ξ0 * sqrt(1 + κ_ρ * rho / ρ_0)

    质量比例荷假设: q_Ξ ∝ m → Ξ-荷密度 ∝ 质量密度
    耦合增强: sqrt形式源于二阶梯度耦合通道的集体效应

    参数:
        alpha_xi0: 真空耦合常数
        rho: 介质质量密度 [kg/m³]
        kappa_rho: 密度耦合增强系数
        rho_0: 参考密度 [kg/m³], 默认1

    返回:
        g_eff: 有效耦合常数 (无量纲)
    """
    if rho <= 0:
        return alpha_xi0
    enhancement = math.sqrt(1.0 + kappa_rho * rho / rho_0)
    return alpha_xi0 * enhancement


# ============================================================
# 介质重整化能隙
# ============================================================

def renormalized_energy_gap(
    delta_e_vac: float,
    rho: float,
    kappa_rho: float,
    model: str = "polaron",
) -> float:
    """
    介质重整化后的有效能隙

    polaron模型 (默认):
        ΔE_eff = ΔE_vac / (1 + κ_ρ * rho / ρ_0)^(1/3)

    物理图像: Ξ-量子位与介质偶极声子耦合 → 极化子 → 有效质量增大 → 能隙压低

    参数:
        delta_e_vac: 真空能隙 [eV]
        rho: 介质密度 [kg/m³]
        kappa_rho: 密度耦合增强系数
        model: "polaron" | "simple"

    返回:
        ΔE_eff [eV]
    """
    if rho <= 0:
        return delta_e_vac

    if model == "simple":
        return delta_e_vac / (1.0 + kappa_rho * rho)
    else:  # polaron
        screening = (1.0 + kappa_rho * rho) ** (1.0 / 3.0)
        return delta_e_vac / screening


# ============================================================
# 量子位数与相干体积
# ============================================================

def qubit_density(l_xi: float) -> float:
    """
    量子位数密度 ρ_Ξ = 1 / l_Ξ³

    参数:
        l_xi: 离散特征长度 [m]
    """
    return 1.0 / (l_xi ** 3)


def coherent_volume_N(
    rho_xi: float,
    V_coh: float,
    tau_coh0: float,
    beta_coh: float,
    N_c: float,
) -> float:
    """
    相干体积内的有效量子位数

    集体相干增强:
    τ_coh(N) = τ_coh0 * N^β_coh  (β=0.5)
    N_eff = min(ρ_Ξ * V_coh, N_c)

    参数:
        rho_xi: 量子位数密度 [m⁻³]
        V_coh: 相干体积 [m³]
        tau_coh0: 单量子位退相干时间 [s]
        beta_coh: 集体相干指数
        N_c: 最大有效量子位数 (退相干饱和)

    返回:
        N_eff
    """
    N_raw = rho_xi * V_coh
    return min(N_raw, N_c)


def collective_coherence_time(
    tau_coh0: float,
    N: float,
    beta_coh: float,
) -> float:
    """
    集体相干时间: τ_coh(N) = τ_coh0 * N^β_coh

    物理图像: N个量子位集体激发 → 退相干由最慢衰减通道主导 → 有效寿命延长
    """
    if N <= 1:
        return tau_coh0
    return tau_coh0 * (N ** beta_coh)


def quality_factor(
    tau_coh: float,
    omega_res: float,
    N: float = 1.0,
    beta_coh: float = 0.5,
) -> float:
    """
    Q 因子: Q = τ_coh(N) * ω_res

    参数:
        tau_coh: 基础退相干时间 [s]
        omega_res: 共振角频率 [rad/s]
        N: 量子位数
        beta_coh: 集体相干指数
    """
    tau = collective_coherence_time(tau_coh, N, beta_coh)
    return tau * omega_res


# ============================================================
# Ξ 能量
# ============================================================

def xi_total_energy_density(
    rho_xi: float,
    p_eq: float,
    delta_e: float,
) -> float:
    """
    Ξ 场总能量密度 [J/m³]

    U_Ξ = ρ_Ξ * p_eq * ΔE

    即: 单位体积内激发态量子位数 × 每个量子位的能量

    参数:
        rho_xi: 量子位数密度 [m⁻³]
        p_eq: 平衡激发概率
        delta_e: 能隙 [eV]

    返回:
        能量密度 [J/m³]
    """
    n_excited = rho_xi * p_eq  # 激发态量子位数密度
    return n_excited * delta_e * EV_TO_J


def xi_spillover_energy(
    xi_total: float,
    epsilon_xi: float,
) -> float:
    """
    溢出Ξ能量 = ε_Ξ × 总Ξ能量

    ε_Ξ ~ 10⁻⁵ (豆包约束拟合值)
    物理图像: 高阶Krawtchouk模式因窄支撑而快速退相干 → 能量以溢出形式泄漏
    """
    return xi_total * epsilon_xi


def xi_fuel_energy(
    xi_total: float,
    epsilon_xi: float,
) -> float:
    """
    燃料通道Ξ能量 = (1 - ε_Ξ) × 总Ξ能量

    燃料通道: 低阶宽支撑Krawtchouk模式 → 能量输入E-law弛豫方程
    """
    return xi_total * (1.0 - epsilon_xi)


# ============================================================
# 环境参数摘要
# ============================================================

def environment_profile(
    T: float,
    rho: float,
    V_coh: float,
    params: dict = None,
) -> dict:
    """
    计算给定环境的完整Ξ场参数

    返回字典包含:
    - p_eq, g_eff, delta_e_eff, N_V, Q, U_xi

    参数:
        T: 温度 [K]
        rho: 介质密度 [kg/m³]
        V_coh: 相干体积 [m³]
        params: 基准参数字典, 默认使用 BENCHMARK_PARAMS
    """
    if params is None:
        params = BENCHMARK_PARAMS

    alpha = params["alpha_xi0"]
    kappa = params["kappa_rho"]
    delta_e_vac = params["delta_e_vac"]
    tau0 = params["tau_coh0"]
    beta = params["beta_coh"]
    Nc = params["N_c"]
    rho_xi = params["rho_xi"]
    l_xi = params["l_xi"]

    delta_e_eff = renormalized_energy_gap(delta_e_vac, rho, kappa)
    p_eq = thermal_excitation_prob(delta_e_eff, T)
    g_eff = effective_coupling(alpha, rho, kappa)
    Nv = coherent_volume_N(rho_xi, V_coh, tau0, beta, Nc)

    omega = 2.0 * math.pi * (delta_e_eff * EV_TO_J / (2.0 * math.pi * HBAR_EVS * EV_TO_J))
    # 简化: ω_res = ΔE_eff / ħ
    omega_res = delta_e_eff / HBAR_EVS  # rad/s
    Q = quality_factor(tau0, omega_res, Nv, beta)

    U = xi_total_energy_density(rho_xi, p_eq, delta_e_eff)

    return {
        "T": T,
        "rho": rho,
        "V_coh": V_coh,
        "delta_e_eff_eV": delta_e_eff,
        "f_res_Hz": omega_res / (2.0 * math.pi),
        "p_eq": p_eq,
        "g_eff": g_eff,
        "N_V": Nv,
        "Q": Q,
        "U_xi_Jm3": U,
    }

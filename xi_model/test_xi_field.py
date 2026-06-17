"""
Ξ 场态空间与耦合模块 — 单元测试
验证: 平衡分布、有效耦合、相干体积、量子位数
参考: 豆包 v2.0, 质量比例荷模型
"""

import math
import pytest
from xi_field import (
    thermal_excitation_prob,
    effective_coupling,
    coherent_volume_N,
    quality_factor,
    qubit_density,
    xi_total_energy_density,
)


# ============================================================
# 基准参数 (豆包 v2.0)
# ============================================================

ALPHA_XI0 = 1.00e-12      # 真空耦合常数
LAMBDA_XI = 1.00e15        # 截断能标 [GeV]
DELTA_E_VAC = 9.93e-11     # 真空能隙 [eV]
TAU_COH0 = 1.00e-3         # 单量子位退相干时间 [s]
KAPPA_RHO = 1.00e3         # 密度耦合增强系数
BETA_COH = 0.5             # 集体相干指数
N_C = 6.66e8               # 最大有效量子位数

# 导出量
L_XI = 1.00e-9              # 离散特征长度 [m] (调整后)
RHO_XI = 1.00e27            # 量子位数密度 [m^-3]

# 物理常数
HBAR_EVS = 6.582119569e-16  # hbar [eV·s]
KB_EVK = 8.617333262e-5     # k_B [eV/K]
C = 2.99792458e8             # 光速 [m/s]


class TestThermalExcitation:
    """p_eq = 1 / (1 + exp(ΔE / kT))"""

    def test_zero_temperature(self):
        """T→0, p_eq→0"""
        p = thermal_excitation_prob(DELTA_E_VAC, T=1e-10)
        assert p == pytest.approx(0.0, abs=1e-12)

    def test_high_temperature(self):
        """T→∞, p_eq→0.5"""
        p = thermal_excitation_prob(DELTA_E_VAC, T=1e10)
        assert p == pytest.approx(0.5, abs=1e-6)

    def test_room_temperature_order(self):
        """室温下 p_eq 应在合理范围"""
        p = thermal_excitation_prob(DELTA_E_VAC, T=300)
        # ΔE_vac ~ 10^{-10} eV, kT @ 300K ~ 0.026 eV
        # ΔE << kT, 所以 p ≈ 0.5
        assert 0.49 < p < 0.51

    def test_medium_renormalized_energy(self):
        """介质中能隙压低 → p_eq 升高"""
        delta_e_medium = DELTA_E_VAC / KAPPA_RHO  # ~10^{-13} eV
        p_medium = thermal_excitation_prob(delta_e_medium, T=300)
        p_vac = thermal_excitation_prob(DELTA_E_VAC, T=300)
        # 能隙更低 → 更接近 0.5
        assert p_medium >= p_vac


class TestEffectiveCoupling:
    """g_eff = α_Ξ0 * sqrt(ρ/ρ_0) (质量比例荷, 密度增强)"""

    def test_vacuum_coupling(self):
        """真空: ρ=0 → g_eff = α_Ξ0"""
        g = effective_coupling(ALPHA_XI0, rho=0.0, kappa_rho=KAPPA_RHO)
        assert g == pytest.approx(ALPHA_XI0, rel=1e-12)

    def test_water_coupling_order(self):
        """纯水 ~1000 kg/m³: g_eff 应在 10^{-10} 量级"""
        g = effective_coupling(ALPHA_XI0, rho=1000.0, kappa_rho=KAPPA_RHO)
        # 豆包: 纯水 3.71e-10
        assert 1e-11 < g < 1e-8

    def test_air_coupling_small(self):
        """空气 ~1.2 kg/m³: 耦合应远小于水"""
        g_air = effective_coupling(ALPHA_XI0, rho=1.2, kappa_rho=KAPPA_RHO)
        g_water = effective_coupling(ALPHA_XI0, rho=1000.0, kappa_rho=KAPPA_RHO)
        assert g_air < g_water

    def test_density_scaling(self):
        """g_eff 应随密度单调增"""
        rho_vals = [0, 1, 100, 1000, 10000]
        g_vals = [effective_coupling(ALPHA_XI0, r, KAPPA_RHO) for r in rho_vals]
        for i in range(len(g_vals) - 1):
            assert g_vals[i] <= g_vals[i + 1]


class TestCoherentVolume:
    """N_V = ρ_Ξ * V_coh, V_coh 受退相干约束"""

    def test_vacuum_N(self):
        """真空声学场景 (V_coh ~ 1 cm³ 量级)"""
        V = 1e-6  # 1 cm³
        N = coherent_volume_N(RHO_XI, V, TAU_COH0, BETA_COH, N_C)
        # N不应超过N_c
        assert N <= N_C + 1

    def test_water_N_smaller(self):
        """水中退相干更快 → 相干体积更小 → N更小"""
        tau_coh_water = TAU_COH0 / 100  # 水中退相干快100倍
        V = 1e-12  # 更小的相干体积
        N = coherent_volume_N(RHO_XI, V, tau_coh_water, BETA_COH, N_C)
        assert N > 0
        assert N <= N_C + 1

    def test_N_never_exceeds_Nc(self):
        """N不应超过饱和阈值N_c"""
        for V in [1e-15, 1e-10, 1e-5, 1e0, 1e5]:
            N = coherent_volume_N(RHO_XI, V, TAU_COH0, BETA_COH, N_C)
            assert N <= N_C * 1.001  # 允许浮点误差

    def test_N_monotonic_with_volume(self):
        """N 随相干体积单调增"""
        Ns = []
        for V in [1e-15, 1e-10, 1e-5]:
            N = coherent_volume_N(RHO_XI, V, TAU_COH0, BETA_COH, N_C)
            Ns.append(N)
        assert Ns[0] <= Ns[1] <= Ns[2]


class TestQualityFactor:
    """Q = τ_coh * ω_res"""

    def test_vacuum_Q(self):
        """真空 Q 值应在 100-200 范围"""
        omega = 2 * math.pi * 24000  # 24 kHz
        Q = quality_factor(TAU_COH0, omega, N=1, beta_coh=BETA_COH)
        # 豆包: 真空细胞尺度 Q=160
        assert 50 < Q < 500

    def test_water_Q_lower(self):
        """水中 Q 更低（相比真空）"""
        tau_water = TAU_COH0 / 100  # 水中退相干更快
        omega = 2 * math.pi * 273
        Q_water = quality_factor(tau_water, omega, N=100, beta_coh=BETA_COH)
        # Q_water 应远小于真空Q（约160）
        assert Q_water < 10

    def test_Q_improves_with_N(self):
        """集体相干增强：更多量子位 → 更高Q"""
        omega = 2 * math.pi * 24000
        Q1 = quality_factor(TAU_COH0, omega, N=1, beta_coh=BETA_COH)
        Q100 = quality_factor(TAU_COH0, omega, N=100, beta_coh=BETA_COH)
        assert Q100 > Q1


class TestXiEnergyDensity:
    """Ξ 能量密度"""

    def test_equilibrium_positive(self):
        """平衡态Ξ能量密度为正"""
        p_eq = thermal_excitation_prob(DELTA_E_VAC, T=300)
        u = xi_total_energy_density(RHO_XI, p_eq, DELTA_E_VAC)
        assert u > 0

    def test_zero_at_zero_excitation(self):
        """p_eq = 0 → 能量密度 = 0"""
        u = xi_total_energy_density(RHO_XI, 0.0, DELTA_E_VAC)
        assert u == pytest.approx(0.0, abs=1e-30)

"""
E-law 基准-偏离动力学模块 — 单元测试
验证: 偏离势能、指数增益、弛豫方程、尺度判据、溢出分流

用户原始描述:
  存在某种基准B，靠近时进度以e常数增长，到达时立即失效，
  远离仅宏观有效(微观无效)，偏离=拉势能，推进=释放动能。
  Ξ的大部分用作推进燃料，观测到的仅是溢出(消散值2相关)。
"""

import math
import pytest
from xi_elaw import (
    deviation_distance,
    deviation_potential,
    gain_factor,
    relaxation_rate,
    relaxation_step,
    scale_criterion,
    spillover_fraction,
    E_Law_System,
)


class TestDeviationDistance:
    """偏离距离 d = |S - B| / S_scale"""

    def test_at_baseline(self):
        d = deviation_distance(S=42.0, B=42.0, S_scale=1.0)
        assert d == pytest.approx(0.0, abs=1e-15)

    def test_positive_deviation(self):
        d = deviation_distance(S=50.0, B=42.0, S_scale=10.0)
        assert d == pytest.approx(0.8, rel=1e-12)

    def test_scale_invariance(self):
        """尺度变换不改变偏离度"""
        d1 = deviation_distance(10, 0, 1)
        d2 = deviation_distance(100, 0, 10)
        assert d1 == pytest.approx(d2, rel=1e-12)


class TestDeviationPotential:
    """偏离势能 V(d) = ln(1 + d) (对数势)"""

    def test_zero_at_baseline(self):
        V = deviation_potential(0.0)
        assert V == pytest.approx(0.0, abs=1e-15)

    def test_monotonic_increasing(self):
        V1 = deviation_potential(0.1)
        V2 = deviation_potential(1.0)
        V3 = deviation_potential(10.0)
        assert V1 < V2 < V3

    def test_log_scaling(self):
        """大d时近似对数增长"""
        V10 = deviation_potential(10)
        V100 = deviation_potential(100)
        # ln(101)/ln(11) ≈ 1.92, 应接近
        ratio = V100 / V10
        assert 1.5 < ratio < 2.5


class TestGainFactor:
    """增益因子 G(d, Xi_fuel) = exp(α * Xi_fuel / (d + d_0))"""

    def test_unity_at_infinite_distance(self):
        G = gain_factor(d=1e10, Xi_fuel=1.0, alpha=1.0, d_0=0.01)
        assert G == pytest.approx(1.0, abs=0.1)

    def test_large_near_baseline(self):
        G = gain_factor(d=0.001, Xi_fuel=1.0, alpha=1.0, d_0=0.01)
        # exp(1.0)≈2.718, weight≈0.91 → G≈1+1.718*0.91≈2.56
        assert G > 2.0

    def test_zero_fuel_no_gain(self):
        G = gain_factor(d=0.1, Xi_fuel=0.0, alpha=1.0, d_0=0.01)
        assert G == pytest.approx(1.0, abs=1e-12)

    def test_increasing_with_fuel(self):
        G1 = gain_factor(d=0.1, Xi_fuel=0.01, alpha=1.0, d_0=0.01)
        G2 = gain_factor(d=0.1, Xi_fuel=0.1, alpha=1.0, d_0=0.01)
        assert G2 >= G1


class TestRelaxationRate:
    """弛豫速率: γ = γ_base * G(d, Xi_fuel)"""

    def test_base_rate_without_fuel(self):
        gamma = relaxation_rate(d=0.5, Xi_fuel=0, gamma_base=1.0, alpha=1.0, d_0=0.01)
        assert gamma == pytest.approx(1.0, rel=1e-12)

    def test_enhanced_with_fuel(self):
        gamma = relaxation_rate(d=0.01, Xi_fuel=0.5, gamma_base=0.1, alpha=1.0, d_0=0.01)
        assert gamma > 0.1


class TestRelaxationStep:
    """弛豫步进: dS/dt = -γ * (S - S_eq)"""

    def test_approach_equilibrium(self):
        """S > S_eq: 应向S_eq衰减"""
        S_new = relaxation_step(S=10, S_eq=5, Xi_fuel=0.2, gamma_base=0.1, dt=0.1, alpha=1.0, B=5, S_scale=5)
        assert S_new < 10
        assert S_new > 5

    def test_below_equilibrium(self):
        """S < S_eq: 应向S_eq增长"""
        S_new = relaxation_step(S=3, S_eq=5, Xi_fuel=0.2, gamma_base=0.1, dt=0.1, alpha=1.0, B=5, S_scale=5)
        assert S_new > 3

    def test_no_change_at_eq(self):
        S_new = relaxation_step(S=5, S_eq=5, Xi_fuel=0.2, gamma_base=0.1, dt=0.1, alpha=1.0, B=5, S_scale=5)
        assert S_new == pytest.approx(5, abs=1e-12)

    def test_termination_at_baseline(self):
        """到达基准B: d=0 → 增益=0 → 推进终止"""
        S_new = relaxation_step(S=5, S_eq=5, Xi_fuel=0.5, gamma_base=1.0, dt=0.1, alpha=1.0, B=5, S_scale=1)
        assert S_new == pytest.approx(5, abs=1e-12)


class TestScaleCriterion:
    """尺度判据：S型过渡函数判断系统是否处于宏观尺度"""

    def test_micro_ineffective(self):
        """微观尺度：S(0) ≈ 0 → 偏离无效"""
        c = scale_criterion(size=0.01, threshold=1.0, sharpness=5.0)
        assert c < 0.1

    def test_macro_effective(self):
        """宏观尺度：S(1) ≈ 1 → 偏离有效"""
        c = scale_criterion(size=10.0, threshold=1.0, sharpness=5.0)
        assert c > 0.9

    def test_transition_smooth(self):
        """过渡区连续"""
        c1 = scale_criterion(size=0.5, threshold=1.0, sharpness=5.0)
        c2 = scale_criterion(size=0.6, threshold=1.0, sharpness=5.0)
        assert c2 >= c1  # 单调


class TestSpilloverFraction:
    """溢出比例: 基于消散值2"""

    def test_range(self):
        """溢出比例在(0, 1)之间"""
        for d in [0.001, 0.01, 0.1, 1.0, 10.0]:
            eps = spillover_fraction(d, dissipation=2.0)
            assert 0 < eps < 1

    def test_larger_near_baseline(self):
        """越接近基准，溢出比例越大（增益越强，高阶模式越不稳定）"""
        eps_001 = spillover_fraction(0.001, dissipation=2.0)
        eps_1 = spillover_fraction(1.0, dissipation=2.0)
        assert eps_001 > eps_1

    def test_dissipation_constant_effect(self):
        """消散值越大，溢出越小"""
        eps_2 = spillover_fraction(0.1, dissipation=2.0)
        eps_5 = spillover_fraction(0.1, dissipation=5.0)
        assert eps_5 < eps_2


class TestELawSystem:
    """E-law 系统积分"""

    def test_convergence(self):
        """系统应向S_eq收敛"""
        sys = E_Law_System(S0=10, S_eq=5, B=5, gamma_base=0.5, alpha=1.0, d_0=1.0)
        history = sys.evolve(Xi_fuel=0.5, dt=0.01, n_steps=1000)
        assert len(history) == 1001
        assert history[-1] == pytest.approx(sys.S_eq, abs=0.1)

    def test_no_fuel_slow_convergence(self):
        """无燃料时以基础速率收敛"""
        sys_fuel = E_Law_System(S0=10, S_eq=5, B=5, gamma_base=0.1, alpha=1.0)
        hist_fuel = sys_fuel.evolve(Xi_fuel=0.5, dt=0.01, n_steps=200)

        sys_nofuel = E_Law_System(S0=10, S_eq=5, B=5, gamma_base=0.1, alpha=1.0)
        hist_nofuel = sys_nofuel.evolve(Xi_fuel=0.0, dt=0.01, n_steps=200)

        # 有燃料应更快接近平衡
        assert abs(hist_fuel[-1] - 5) <= abs(hist_nofuel[-1] - 5)

    def test_baseline_termination(self):
        """如果S=B=S_eq，系统完全不动"""
        sys = E_Law_System(S0=5, S_eq=5, B=5, gamma_base=0.5, alpha=1.0)
        history = sys.evolve(Xi_fuel=1.0, dt=0.1, n_steps=100)
        for s in history:
            assert s == pytest.approx(5, abs=1e-12)

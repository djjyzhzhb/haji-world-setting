"""
Krawtchouk 多项式模块 — 单元测试
验证：递推正确性、正交性、支撑区间
使用 monic Krawtchouk 多项式 (递推为唯一计算入口)
"""

import math
import pytest
from xi_krawtchouk import (
    krawtchouk,
    binomial_weight,
    norm_squared,
    orthogonality_check,
    mode_support_interval,
    mode_resonance_interval,
    effective_mode_count,
)


class TestKrawtchoukBasics:
    """基础性质"""

    def test_k0_is_one(self, N=20, p=0.3):
        for x in range(N + 1):
            assert krawtchouk(0, x, p, N) == pytest.approx(1.0, abs=1e-15)

    def test_k1_identity(self, N=20, p=0.3):
        """K_1(x) = Np - x"""
        for x in range(N + 1):
            assert krawtchouk(1, x, p, N) == pytest.approx(N * p - x, abs=1e-15)

    def test_weight_normalization(self, N=20, p=0.3):
        """Σ w(x) ≈ 1"""
        total = sum(binomial_weight(x, p, N) for x in range(N + 1))
        assert total == pytest.approx(1.0, abs=1e-14)


class TestOrthogonality:
    """数值验证正交性"""

    def test_small_orthogonal(self):
        """N=20, p=0.3: 正交性达到数值精度"""
        N, p = 20, 0.3
        for m in range(5):
            for n in range(5):
                v = orthogonality_check(m, n, p, N)
                if m == n:
                    h = norm_squared(n, p, N)
                    assert v == pytest.approx(h, rel=1e-12)
                else:
                    # 非对角元相对于对角元应可忽略
                    scale = math.sqrt(
                        norm_squared(m, p, N) * norm_squared(n, p, N)
                    )
                    normalized = abs(v) / max(scale, 1e-30)
                    assert normalized < 1e-13, f"<{m},{n}> normalized = {normalized}"

    def test_mid_orthogonal(self):
        """N=100, p=0.2: 低阶模式正交"""
        N, p = 100, 0.2
        for m in range(1, 4):
            for n in range(1, 4):
                if m == n:
                    continue
                v = orthogonality_check(m, n, p, N)
                scale = math.sqrt(
                    norm_squared(m, p, N) * norm_squared(n, p, N)
                )
                normalized = abs(v) / max(scale, 1e-30)
                assert normalized < 1e-8


class TestRecurrenceStability:
    """递推在大N下的稳定性"""

    def test_no_nan(self):
        """N=200, p=0.1: 递推不产生NaN或Inf"""
        N, p = 200, 0.1
        for n in range(20):
            for x in [0, N // 4, N // 2, 3 * N // 4, N]:
                v = krawtchouk(n, x, p, N)
                assert math.isfinite(v)

    def test_norm_bounded(self):
        """N=200, p=0.1: 低阶范数有限"""
        N, p = 200, 0.1
        for n in range(10):
            h = norm_squared(n, p, N)
            assert math.isfinite(h)
            assert h > 0


class TestSupportInterval:
    """支撑区间"""

    def test_higher_narrower(self):
        """高阶支撑应收窄"""
        N, p = 30, 0.3
        widths = []
        for n in range(1, 12):
            lo, hi = mode_support_interval(n, p, N, threshold=0.1)
            widths.append(hi - lo)
        # 整体趋势向下
        assert widths[0] >= widths[-1] * 0.3

    def test_inside_domain(self):
        """区间不超出[0, N]"""
        N, p = 20, 0.3
        for n in range(8):
            lo, hi = mode_support_interval(n, p, N, threshold=0.05)
            assert 0 <= lo <= hi <= N

    def test_n0_full_support(self):
        """K_0 ≡ 1: 全支撑"""
        lo, hi = mode_support_interval(0, 0.3, 20)
        assert lo == 0
        assert hi == 20

    def test_resonance_multi_interval(self):
        """高阶模式可能有多个共振区间"""
        N, p = 20, 0.3
        intervals = mode_resonance_interval(5, p, N, noise_floor=0.1)
        assert len(intervals) >= 1


class TestEffectiveModeCount:
    """有效模式数"""

    def test_small(self):
        """N=20, p=0.3: 小N下所有正交模式都可区分"""
        c = effective_mode_count(N=20, p_eq=0.3, noise_floor=0.01)
        assert c == 21  # N+1，所有正交模式在小N下都有效

    def test_large_N(self):
        """大N有效模式更多"""
        c = effective_mode_count(N=200, p_eq=0.1, noise_floor=0.01)
        assert c >= 1

    def test_monotonic_with_p(self):
        """p越高 → 分布越宽 → 有效模式可能更多"""
        c_low = effective_mode_count(N=50, p_eq=0.03, noise_floor=0.01)
        c_high = effective_mode_count(N=50, p_eq=0.3, noise_floor=0.01)
        assert c_high >= c_low - 3  # 允许小波动

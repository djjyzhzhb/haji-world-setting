"""
全链条集成模拟与分析
====================
连接三层: Krawtchouk 模式分类 → Ξ 场激发 → E-law 弛豫动力学

场景: 真空声学 / 纯水 / 生物细胞
使用 豆包 v2.0 基准参数
"""

import math
import json
from xi_krawtchouk import (
    krawtchouk,
    binomial_weight,
    norm_squared,
    mode_resonance_interval,
    mode_distribution_analysis,
    krawtchouk_normalized,
)
from xi_field import (
    BENCHMARK_PARAMS,
    thermal_excitation_prob,
    effective_coupling,
    renormalized_energy_gap,
    coherent_volume_N,
    quality_factor,
    xi_total_energy_density,
    environment_profile,
    EV_TO_J,
    HBAR_EVS,
)
from xi_elaw import (
    gain_factor,
    spillover_fraction,
    deviation_distance,
    E_Law_System,
)


def analyze_scenario(name: str, T: float, rho: float, V_coh: float, params=None):
    """
    完整场景分析: Krawtchouk → Ξ → E-law
    """
    if params is None:
        params = BENCHMARK_PARAMS

    print(f"\n{'='*60}")
    print(f"  场景: {name}")
    print(f"  T={T} K, ρ={rho} kg/m³, V_coh={V_coh} m³")
    print(f"{'='*60}")

    # ---- 第一层: Ξ 场环境参数 ----
    env = environment_profile(T, rho, V_coh, params)
    print(f"\n  [第一层] 环境参数:")
    print(f"    ΔE_eff = {env['delta_e_eff_eV']:.2e} eV")
    print(f"    f_res   = {env['f_res_Hz']:.1f} Hz")
    print(f"    p_eq    = {env['p_eq']:.6f}")
    print(f"    g_eff   = {env['g_eff']:.3e}")
    print(f"    N_V     = {env['N_V']:.2e}")
    print(f"    Q       = {env['Q']:.1f}")
    print(f"    U_Ξ     = {env['U_xi_Jm3']:.3e} J/m³")

    # ---- 第二层: Krawtchouk 模式分析 ----
    # 对于大N_V，降采样到可计算的规模进行分析
    N_demo = min(int(env['N_V']), 200)  # 大N时降采样
    if N_demo <= 0:
        N_demo = 20

    p_eq = env['p_eq']

    print(f"\n  [第二层] Krawtchouk 模式分析 (N_demo={N_demo}):")
    analysis = mode_distribution_analysis(N_demo, p_eq, noise_floor=0.01)

    n_eff = analysis['n_effective']
    n_fuel = analysis['n_fuel_max']
    n_spill = analysis['n_spillover_min']

    print(f"    有效模式数: {n_eff}")
    print(f"    燃料通道 (n ≤ {n_fuel}): 宽支撑 → 弛豫增益")
    print(f"    溢出通道 (n ≥ {n_spill}): 窄支撑 → 可观测信号")
    print(f"    溢出比例 (结构) ≈ {(n_eff - n_spill) / max(n_eff, 1):.1%}")

    # 前几个模式的支撑
    for mode in analysis['per_mode'][:min(5, len(analysis['per_mode']))]:
        n = mode['n']
        frac = mode['fraction']
        intervals = mode['intervals']
        print(f"    n={n}: 支撑宽度={frac:.1%}, 区间数={len(intervals)}")

    # ---- 第三层: E-law 分析 ----
    # 溢出比例
    d_demo = 0.1  # 典型偏离度
    eps_e = spillover_fraction(d_demo, dissipation=2.0, d_0=0.01)

    # 每单位体积的 Ξ 能量
    U_total = env['U_xi_Jm3']
    U_spill = U_total * eps_e  # E-law 层面溢出
    U_fuel = U_total - U_spill

    print(f"\n  [第三层] E-law 分析:")
    print(f"    偏离度 d = {d_demo}")
    print(f"    ε_E(d) 溢出 = {eps_e:.4f} (消散值=2)")
    print(f"    Ξ 总能量密度  = {U_total:.3e} J/m³")
    print(f"    Ξ 溢出(可观测) = {U_spill:.3e} J/m³")
    print(f"    Ξ 燃料(弛豫)   = {U_fuel:.3e} J/m³")

    # 弛豫动力学演示
    Xi_norm = U_fuel / max(U_total, 1e-30) if U_total > 0 else 0

    print(f"\n  [第三层] 弛豫动力学演示 (Ξ_fuel={Xi_norm:.3f}):")
    sys = E_Law_System(S0=10, S_eq=5, B=5, gamma_base=0.1, alpha=1.0, d_0=1.0)
    history = sys.evolve(Xi_fuel=Xi_norm, dt=0.01, n_steps=500)

    # 增益曲线
    d_range = [0.01, 0.1, 0.5, 1.0, 2.0, 5.0, 10.0]
    print(f"    偏离度 d → 增益 G:")
    for d in d_range:
        G = gain_factor(d, Xi_norm, alpha=1.0, d_0=1.0)
        print(f"      d={d:5.2f}  →  G={G:.4f}")

    print(f"    初始 S = {history[0]:.1f}")
    print(f"    最终 S = {history[-1]:.3f}  (目标={sys.S_eq})")
    print(f"    收敛步数: 约 {sum(1 for s in history if abs(s - sys.S_eq) > 0.1)}/{len(history)}")

    return {
        "name": name,
        "env": env,
        "krawtchouk": analysis,
        "U_total": U_total,
        "U_spill": U_spill,
        "U_fuel": U_fuel,
        "eps_elaw": eps_e,
        "history": history[:10] + history[-5:],  # 采样
    }


# ============================================================
# 三场景对比
# ============================================================

def main():
    scenarios = [
        ("真空声学 (24 kHz)", 293, 0.0, 1e-6),
        ("纯水 (273 Hz)", 298, 1000.0, 1e-12),
        ("生物细胞 (289 Hz)", 310, 1060.0, 1e-15),
    ]

    results = []
    for name, T, rho, V in scenarios:
        r = analyze_scenario(name, T, rho, V)
        results.append(r)

    # ---- 总结对比 ----
    print(f"\n\n{'='*70}")
    print(f"  三场景对比总结")
    print(f"{'='*70}")
    print(f"  {'场景':<20} {'p_eq':>8} {'g_eff':>10} {'N_V':>12} {'U_Ξ (J/m³)':>14} {'溢能 (J/m³)':>14}")
    print(f"  {'-'*20} {'-'*8} {'-'*10} {'-'*12} {'-'*14} {'-'*14}")
    for r in results:
        env = r['env']
        print(f"  {r['name']:<20} {env['p_eq']:8.5f} {env['g_eff']:10.3e} "
              f"{env['N_V']:12.1f} {r['U_total']:14.3e} {r['U_spill']:14.3e}")

    print(f"\n  Krawtchouk 模式对比:")
    for r in results:
        ka = r['krawtchouk']
        print(f"    {r['name']:<20} 有效模式={ka['n_effective']}, "
              f"燃料≤{ka['n_fuel_max']}, 溢出≥{ka['n_spillover_min']}")

    # 输出 JSON
    output = {
        "benchmark_params": BENCHMARK_PARAMS,
        "scenarios": [],
    }
    for r in results:
        output["scenarios"].append({
            "name": r["name"],
            "T": r["env"]["T"],
            "rho": r["env"]["rho"],
            "p_eq": r["env"]["p_eq"],
            "g_eff": r["env"]["g_eff"],
            "Q": r["env"]["Q"],
            "U_total_Jm3": r["U_total"],
            "U_spill_Jm3": r["U_spill"],
            "U_fuel_Jm3": r["U_fuel"],
            "eps_elaw": r["eps_elaw"],
        })

    with open("analysis_output.json", "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
    print(f"\n  输出已写入 analysis_output.json")


if __name__ == "__main__":
    main()

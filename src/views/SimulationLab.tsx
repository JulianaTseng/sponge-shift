import { useMemo, useState } from 'react'
import { ArrowRightLeft, Maximize2, RefreshCw, Sparkles } from 'lucide-react'
import { useApp, SCENARIO_META, ALL_RISKS } from '../store'
import { MapView } from '../components/MapView'
import { Timeline } from '../components/controls'
import { Bar, Chip, Empty, Modal, Panel, Toggle } from '../components/ui'
import { SPECS } from '../data/specs'
import { depthWith, depthWithout, hoursToFull, fmtHours } from '../lib/sim'

export function SimulationLab() {
  const {
    scenario,
    scenarioId,
    risks,
    modules,
    simH,
    wave,
    toggleWave,
    placing,
    startPlacing,
    loadScenario,
    custom,
    setCustom,
    applyCustom,
    syncLayout,
    compareFull,
    setCompareFull,
    settings,
    setView,
  } = useApp()
  const [showCustom, setShowCustom] = useState(scenarioId === 'custom')

  const deployed = modules.filter((m) => (m.state === 'operating' || m.state === 'saturated') && m.usage !== 'supply')
  const stats = useMemo(() => {
    let withMax = 0
    let withoutMax = 0
    let above = 0
    for (const r of risks) {
      const w = depthWith(r, simH, modules)
      const b = depthWithout(r, simH)
      withMax = Math.max(withMax, w)
      withoutMax = Math.max(withoutMax, b)
      if (w >= 0.5) above++
    }
    return { withMax, withoutMax, above }
  }, [risks, modules, simH])

  const reduction = stats.withoutMax > 0 ? Math.round((1 - stats.withMax / stats.withoutMax) * 100) : 0

  // Frame the comparison on the risk point that carries the deepest water, so both
  // viewports show the same patch of coastline at a readable scale.
  const focus = useMemo(() => {
    const top = [...risks].sort((a, b) => depthWithout(b, simH) - depthWithout(a, simH))[0]
    return top?.coord
  }, [risks, simH])

  return (
    <div className="view view--lab">
      <div className="lab-layout">
        <aside className="lab-side">
          <Panel title="Scenario library" sub="Preset JSON profiles">
            <div className="stack">
              {SCENARIO_META.map((s) => (
                <button
                  key={s.id}
                  className={`scenario-card ${scenarioId === s.id ? 'is-on' : ''}`}
                  onClick={() => loadScenario(s.id)}
                >
                  <strong>{s.name}</strong>
                  <em>{s.subtitle}</em>
                </button>
              ))}
              <button className="scenario-card scenario-card--custom" onClick={() => setShowCustom((v) => !v)}>
                <strong>Custom scenario</strong>
                <em>Warning points and intensity sliders</em>
              </button>
            </div>
          </Panel>

          {showCustom && (
            <Panel title="Custom parameters" sub="Regenerates the baseline curve">
              <div className="slider-field">
                <label>
                  Duration <span>{custom.durationHours} h</span>
                </label>
                <input
                  type="range"
                  min={12}
                  max={72}
                  step={2}
                  value={custom.durationHours}
                  onChange={(e) => setCustom({ durationHours: Number(e.target.value) })}
                />
              </div>
              <div className="slider-field">
                <label>
                  Peak rainfall <span>{custom.peakRainfall} mm/h</span>
                </label>
                <input
                  type="range"
                  min={20}
                  max={180}
                  step={5}
                  value={custom.peakRainfall}
                  onChange={(e) => setCustom({ peakRainfall: Number(e.target.value) })}
                />
              </div>
              <div className="slider-field">
                <label>
                  Peak tide <span>{custom.peakTide.toFixed(1)} m</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={4.5}
                  step={0.1}
                  value={custom.peakTide}
                  onChange={(e) => setCustom({ peakTide: Number(e.target.value) })}
                />
              </div>
              <div className="slider-field">
                <label>
                  Peak timing <span>T+{custom.peakHour} h</span>
                </label>
                <input
                  type="range"
                  min={4}
                  max={36}
                  step={1}
                  value={custom.peakHour}
                  onChange={(e) => setCustom({ peakHour: Number(e.target.value) })}
                />
              </div>
              <div className="risk-picker">
                <span className="mini-label">Warning points</span>
                <div className="risk-tags">
                  {ALL_RISKS.map((r) => (
                    <button
                      key={r.id}
                      className={`risk-tag ${custom.riskIds.includes(r.id) ? 'is-on' : ''}`}
                      onClick={() =>
                        setCustom({
                          riskIds: custom.riskIds.includes(r.id)
                            ? custom.riskIds.filter((x) => x !== r.id)
                            : [...custom.riskIds, r.id],
                        })
                      }
                    >
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
              <button className="btn btn--primary btn--block" onClick={applyCustom}>
                <Sparkles size={14} /> Generate scenario
              </button>
            </Panel>
          )}

          <Panel title="Deploy modules" sub="Manual placement into the simulation">
            <div className="palette-stack">
              {(['M1', 'M2', 'M3'] as const).map((t) => (
                <button
                  key={t}
                  className={`palette-row ${placing === t ? 'is-on' : ''}`}
                  onClick={() => startPlacing(placing === t ? null : t)}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/module', t)
                    startPlacing(t)
                  }}
                >
                  <span className={`shape shape--${SPECS[t].shape}`} />
                  <span>
                    <strong>{t} · {SPECS[t].name}</strong>
                    <em>{SPECS[t].environment}</em>
                  </span>
                  <Chip tone={t === 'M3' ? 'warn' : 'muted'}>{SPECS[t].sizeLabel.split(' ')[0]}</Chip>
                </button>
              ))}
            </div>
          </Panel>

          <Panel
            title="Time to saturation"
            sub="Computed from absorption rate and simTime"
            action={<Chip tone="brand">{deployed.length} deployed</Chip>}
          >
            <div className="sat-list">
              {deployed.length === 0 && <Empty>No deployed modules</Empty>}
              {deployed.slice(0, 8).map((m) => {
                const pct = Math.round((m.absorbed / m.capacity) * 100)
                const left = hoursToFull(m, { M1: 26, M2: 9, M3: 32 })
                return (
                  <div key={m.id} className="sat-row">
                    <div className="sat-top">
                      <span className={`type-tag type-tag--${m.type}`}>{m.type}</span>
                      <strong>{m.id}</strong>
                      <span className="sat-time">{pct >= 100 ? 'Full' : `Full in ${fmtHours(left)}`}</span>
                    </div>
                    <Bar value={pct} tone={pct >= 100 ? 'bad' : pct > 70 ? 'warn' : 'brand'} />
                    <div className="sat-meta">
                      <span>{Math.round(m.absorbed)} / {m.capacity} m³</span>
                      <span>{pct}%</span>
                    </div>
                  </div>
                )
              })}
            </div>
            <button className="btn btn--ghost btn--block" onClick={syncLayout}>
              <ArrowRightLeft size={14} /> Sync layout to dispatch
            </button>
          </Panel>

          <div className="lab-toggle">
            <Toggle on={wave} onChange={toggleWave} label="Realistic water & wave" hint="Animated surface over flooded areas · 30 FPS cap" />
          </div>
        </aside>

        <div className="lab-main">
          <MapView allowPlacement className="lab-map" />
          <Timeline />

          <div className="compare-wrap">
            <div className="compare-head">
              <div>
                <h3>With and without modules</h3>
                <p>Same scenario, same simTime · {scenario.name}</p>
              </div>
              <button className="btn btn--ghost" onClick={() => setCompareFull(true)} data-testid="compare-fullscreen">
                <Maximize2 size={14} /> Fullscreen compare
              </button>
            </div>
            <div className="compare-grid">
              <div className="compare-cell">
                <div className="compare-label">
                  <span>Without modules</span>
                  <strong>{stats.withoutMax.toFixed(2)} m max</strong>
                </div>
                <MapView variant="mini" compare="without" focus={focus} zoomLevel={11.4} />
              </div>
              <div className="compare-cell">
                <div className="compare-label">
                  <span>With deployed modules</span>
                  <strong className="text-ok">{stats.withMax.toFixed(2)} m max</strong>
                </div>
                <MapView variant="mini" compare="with" focus={focus} zoomLevel={11.4} />
              </div>
              <div className="compare-stats">
                <div>
                  <span>Peak depth reduction</span>
                  <strong>{reduction}%</strong>
                </div>
                <div>
                  <span>Points above 0.5 m</span>
                  <strong>{stats.above}</strong>
                </div>
                <div>
                  <span>Modules deployed</span>
                  <strong>{deployed.length}</strong>
                </div>
                <div>
                  <span>Absorption capacity</span>
                  <strong>{deployed.reduce((n, m) => n + m.capacity, 0).toLocaleString()} m³</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={compareFull}
        onClose={() => setCompareFull(false)}
        title="Fullscreen comparison"
        width={1200}
      >
        <div className="full-compare">
          <div>
            <div className="compare-label">
              <span>Without modules</span>
              <strong>{stats.withoutMax.toFixed(2)} m max</strong>
            </div>
            <MapView compare="without" className="full-compare-map" focus={focus} zoomLevel={11.4} />
          </div>
          <div>
            <div className="compare-label">
              <span>With deployed modules</span>
              <strong className="text-ok">{stats.withMax.toFixed(2)} m max</strong>
            </div>
            <MapView compare="with" className="full-compare-map" focus={focus} zoomLevel={11.4} />
          </div>
        </div>
        <div className="compare-stats compare-stats--wide">
          <div><span>Reduction</span><strong>{reduction}%</strong></div>
          <div><span>Points above 0.5 m</span><strong>{stats.above}</strong></div>
          <div><span>Deployed</span><strong>{deployed.length}</strong></div>
          <div><span>Sim time</span><strong>T+{simH.toFixed(1)} h</strong></div>
        </div>
      </Modal>
    </div>
  )
}

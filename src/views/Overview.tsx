import { ArrowRight, Radio, Ship, Truck } from 'lucide-react'
import { useApp } from '../store'
import { MapView } from '../components/MapView'
import { Chip, Empty, Panel, Sparkline, Stat } from '../components/ui'
import { SPECS } from '../data/specs'
import { inventory, depthWith, fmtHours, fmtClock, timeAgo } from '../lib/sim'
import { fmtNum } from '../lib/sim'

export function Overview() {
  const {
    scenario,
    risks,
    modules,
    orders,
    events,
    simH,
    setView,
    selectRisk,
    openDrawer,
    settings,
  } = useApp()

  const active = risks.filter((r) => r.status !== 'rejected')
  const pending = risks.filter((r) => r.status === 'pending')
  const inTransit = orders.filter((o) => o.status === 'in_transit')
  const land = inTransit.filter((o) => o.mode === 'land')
  const sea = inTransit.filter((o) => o.mode === 'sea')
  const inv = inventory(modules)
  const deployed = inv.M1.deployed + inv.M1.saturated + inv.M2.deployed + inv.M2.saturated + inv.M3.deployed + inv.M3.saturated
  const supplyM2 = modules.filter((m) => m.type === 'M2' && m.usage === 'supply').length
  const supplyPct = Math.round((supplyM2 / Math.max(1, settings.fleet.M2)) * 100)
  const saturated = modules.filter((m) => m.sensor === 'FULL')
  const damaged = modules.filter((m) => m.sensor === 'DAMAGED' || m.sensor === 'UNREACHABLE')
  const sorted = [...active].sort((a, b) => a.arriveByHours - b.arriveByHours)

  return (
    <div className="view">
      <div className="page-head">
        <div>
          <h1>Operations overview</h1>
          <p>
            {scenario.name} · {scenario.subtitle}
          </p>
        </div>
        <button className="btn btn--ghost" onClick={() => setView('map')}>
          Open risk map <ArrowRight size={14} />
        </button>
      </div>

      <div className="kpi-row">
        <Stat label="Active risk points" value={active.length} sub={`${active.filter((r) => r.level === 'severe').length} severe`} testId="kpi-risks" />
        <Stat label="Pending approvals" value={pending.length} sub="Decision required" tone={pending.length ? 'warn' : 'default'} testId="kpi-pending" />
        <Stat label="In transit" value={inTransit.reduce((n, o) => n + o.moduleIds.length, 0)} sub={`${land.length} land · ${sea.length} sea`} testId="kpi-transit" />
        <Stat label="Deployed modules" value={deployed} sub={`of ${settings.fleet.M1 + settings.fleet.M2 + settings.fleet.M3} in fleet`} testId="kpi-deployed" />
        <Stat label="M2 supply utilisation" value={`${supplyPct}%`} sub={`${supplyM2} of ${settings.fleet.M2} committed`} tone={supplyPct > 45 ? 'warn' : 'default'} testId="kpi-supply" />
        <Stat label="Saturated modules" value={saturated.length} sub="Sensor reports FULL" tone={saturated.length ? 'warn' : 'default'} onClick={() => openDrawer('saturated')} testId="kpi-saturated" />
        <Stat label="Damaged modules" value={damaged.length} sub="Sensor lost / flagged" tone={damaged.length ? 'bad' : 'default'} onClick={() => openDrawer('damaged')} testId="kpi-damaged" />
      </div>

      <div className="overview-grid">
        <Panel
          title="Live risk map"
          sub="Forecast flood extent and module positions at simulation time"
          className="overview-map"
          action={<Chip tone="brand">{fmtClock(scenario.t0, simH)} HKT</Chip>}
        >
          <MapView variant="mini" onRiskClick={(id) => { setView('map'); selectRisk(id) }} />
        </Panel>

        <Panel title="Risk points" sub="Sorted by arrival deadline" className="overview-risks">
          <div className="risk-list">
            {sorted.length === 0 && <Empty>No active risk points</Empty>}
            {sorted.map((r) => {
              const depth = depthWith(r, simH, modules)
              const eta = r.arriveByHours - simH
              return (
                <button
                  key={r.id}
                  className="risk-row"
                  onClick={() => {
                    selectRisk(r.id)
                    setView('map')
                  }}
                >
                  <span className={`risk-dot risk-dot--${r.level}`} />
                  <span className="risk-name">
                    <strong>{r.name}</strong>
                    <em>{r.region} · {r.type}</em>
                  </span>
                  <span className="risk-figures">
                    <b>{depth.toFixed(2)} m</b>
                    <i>peak {r.peakDepth.toFixed(2)} m</i>
                  </span>
                  <span className={`risk-eta ${eta < 2 ? 'is-critical' : ''}`}>
                    <b>{eta > 0 ? `${eta.toFixed(1)} h` : 'Due now'}</b>
                    <i>to deadline</i>
                  </span>
                </button>
              )
            })}
          </div>
        </Panel>

        <Panel
          title="Transport status"
          sub="Live land and sea movements"
          className="overview-transport"
          action={<Chip tone="info" dot>{inTransit.length} active</Chip>}
        >
          <div className="transport-list">
            {inTransit.length === 0 && <Empty>No modules in transit</Empty>}
            {inTransit.map((o) => (
              <div key={o.id} className="transport-row">
                <span className={`mode-icon mode-icon--${o.mode}`}>
                  {o.mode === 'land' ? <Truck size={14} /> : <Ship size={14} />}
                </span>
                <span>
                  <strong>{o.id} · {o.moduleIds.join(', ')}</strong>
                  <em>
                    Yuen Long → {o.riskName}
                    {o.route ? ` · ${o.route.distanceKm.toFixed(1)} km` : ''}
                  </em>
                </span>
                <span className="transport-eta">
                  {fmtHours(Math.max(0, o.departAt + o.etaH - simH))}
                  <em>{o.lateMin > 0 ? `+${o.lateMin} min late` : 'on schedule'}</em>
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Module inventory" sub="Standby / transit / deployed / saturated" className="overview-inventory">
          {(['M1', 'M2', 'M3'] as const).map((t) => {
            const i = inv[t]
            const total = Math.max(1, settings.fleet[t])
            return (
              <div key={t} className="inv-row">
                <span className={`type-tag type-tag--${t}`}>{t}</span>
                <span className="inv-name">{SPECS[t].name}</span>
                <div className="inv-bar">
                  <span className="seg seg--standby" style={{ width: `${(i.standby / total) * 100}%` }} />
                  <span className="seg seg--transit" style={{ width: `${(i.transit / total) * 100}%` }} />
                  <span className="seg seg--deployed" style={{ width: `${(i.deployed / total) * 100}%` }} />
                  <span className="seg seg--saturated" style={{ width: `${(i.saturated / total) * 100}%` }} />
                </div>
                <span className="inv-count">{i.total}</span>
              </div>
            )
          })}
          <div className="inv-legend">
            <span><i className="seg seg--standby" /> Standby</span>
            <span><i className="seg seg--transit" /> Transit</span>
            <span><i className="seg seg--deployed" /> Deployed</span>
            <span><i className="seg seg--saturated" /> Saturated</span>
          </div>
        </Panel>

        <Panel title="Event feed" sub="Latest system activity" className="overview-events">
          <div className="event-list">
            {events.slice(0, 7).map((e) => (
              <div key={e.id} className={`event-row event-row--${e.severity}`}>
                <span className="event-time">{timeAgo(e.t)}</span>
                <span className="event-dot" />
                <span className="event-msg">{e.message}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Tide and rainfall" sub="Scenario forcing at current time" className="overview-forcing">
          <div className="forcing-grid">
            <div>
              <span className="mini-label">Tide (Tai O)</span>
              <strong className="mini-value">{scenario.series.tide[Math.min(scenario.series.tide.length - 1, Math.round(simH))]?.v.toFixed(2)} m</strong>
              <Sparkline data={scenario.series.tide} color="#3fd0c9" width={150} height={40} />
            </div>
            <div>
              <span className="mini-label">Rainfall</span>
              <strong className="mini-value">{scenario.series.rainfall[Math.min(scenario.series.rainfall.length - 1, Math.round(simH))]?.v.toFixed(0)} mm/h</strong>
              <Sparkline data={scenario.series.rainfall} color="#6ea8fe" width={150} height={40} />
            </div>
          </div>
          <div className="forcing-foot">
            <Radio size={13} />
            <span>{fmtNum(modules.filter((m) => m.state === 'operating').length)} modules reporting</span>
          </div>
        </Panel>
      </div>
    </div>
  )
}

import type { SyntheticEvent } from 'react'
import './workflow-cards.css'

function hideBrokenImg(e: SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = 'none'
}

function PlanParseCard() {
  return (
    <div className="wf-card wf-card--plan">
      <div className="wf-card-media">
        <div className="prd-wrap">
          <div className="prd-file">
            <div className="prd-file-dot" />
            PRD.md
          </div>
          <div className="prd-line" />
          <div className="prd-line" />
          <div className="prd-line" />
          <div className="prd-line" />
          <div className="task-section">
            <div className="task-label">TASKS GENERATED</div>
            <div className="task-item">
              <span className="task-id">#001</span>
              <div className="task-bar">
                <div className="task-bar-fill" style={{ width: '100%' }} />
              </div>
              <div className="task-dot" style={{ background: '#8A85FF' }} />
            </div>
            <div className="task-item">
              <span className="task-id">#002</span>
              <div className="task-bar">
                <div className="task-bar-fill" style={{ width: '72%' }} />
              </div>
              <div
                className="task-dot"
                style={{ background: 'rgba(138,133,255,0.4)', border: '1px solid #635BFF' }}
              />
            </div>
            <div className="task-item">
              <span className="task-id">#003</span>
              <div className="task-bar">
                <div className="task-bar-fill" style={{ width: '45%' }} />
              </div>
              <div
                className="task-dot"
                style={{ background: 'rgba(138,133,255,0.2)', border: '1px solid rgba(99,91,255,0.5)' }}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="wf-card-body">
        <div className="wf-pill">Plan &amp; parse</div>
        <p className="wf-desc">
          Ingest PRDs and generate a clear task hierarchy with IDs, statuses, and dependencies your whole team can follow.
        </p>
      </div>
    </div>
  )
}

function CliMcpCard() {
  return (
    <div className="wf-card wf-card--cli">
      <div className="wf-card-media">
        <div className="cli-header">
          <div className="cli-dots">
            <div className="cli-dot" style={{ background: '#ff5f57' }} />
            <div className="cli-dot" style={{ background: '#febc2e' }} />
            <div className="cli-dot" style={{ background: '#28c840' }} />
          </div>
          <div className="cli-title-txt">taskmaster — zsh</div>
          <div style={{ width: 40 }} />
        </div>

        <div className="terminal-body">
          <span className="t-line" style={{ animationDelay: '0.15s' }}>
            <span className="t-prompt">❯</span>
            <span className="t-cmd-muted"> taskmaster </span>
            <span className="t-kw">next</span>
          </span>
          <span className="t-line" style={{ animationDelay: '0.75s' }}>
            <span className="t-out">
              ◆ Next: <span className="t-hl">#003</span> Auth middleware<span className="t-tag">ready</span>
            </span>
          </span>
          <span className="t-line" style={{ animationDelay: '1.05s' }}>
            <span className="t-out">
              {'  '}deps: #001 <span className="t-check">✓</span> #002 <span className="t-check">✓</span>{' '}
              score:<span className="t-num">6</span>
            </span>
          </span>
          <span className="t-line" style={{ animationDelay: '1.6s', display: 'block', marginTop: 3 }}>
            <span className="t-prompt">❯</span>
            <span className="t-cmd-muted"> taskmaster </span>
            <span className="t-kw">expand</span> <span className="t-str">3</span>
          </span>
          <span className="t-line" style={{ animationDelay: '2.1s' }}>
            <span className="t-out">
              {'  '}↳ <span className="t-hl">3.1</span> JWT validation<span className="t-ok">subtask</span>
            </span>
          </span>
          <span className="t-line" style={{ animationDelay: '2.4s' }}>
            <span className="t-out">
              {'  '}↳ <span className="t-hl">3.2</span> Refresh token flow<span className="t-ok">subtask</span>
            </span>
          </span>
          <span className="t-line" style={{ animationDelay: '2.7s' }}>
            <span className="t-out">
              {'  '}↳ <span className="t-hl">3.3</span> Session expiry<span className="t-ok">subtask</span>
            </span>
          </span>
        </div>

        <div className="mcp-bar">
          <div className="mcp-dot" />
          <div className="mcp-label">
            MCP — <span>3 hosts</span>
          </div>
          <div className="ide-chips">
            <div className="ide-chip">
              <img
                src="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/cursor.svg"
                alt=""
                onError={hideBrokenImg}
              />
              Cursor
            </div>
            <div className="ide-chip">
              <svg
                className="ide-windsurf-svg"
                width="11"
                height="11"
                viewBox="0 0 1024 1024"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden
              >
                <path
                  fill="currentColor"
                  d="M897.246 286.869H889.819C850.735 286.808 819.017 318.46 819.017 357.539V515.589C819.017 547.15 792.93 572.716 761.882 572.716C743.436 572.716 725.02 563.433 714.093 547.85L552.673 317.304C539.28 298.16 517.486 286.747 493.895 286.747C457.094 286.747 423.976 318.034 423.976 356.657V515.619C423.976 547.181 398.103 572.746 366.842 572.746C348.335 572.746 329.949 563.463 319.021 547.881L138.395 289.882C134.316 284.038 125.154 286.93 125.154 294.052V431.892C125.154 438.862 127.285 445.619 131.272 451.34L309.037 705.2C319.539 720.204 335.033 731.344 352.9 735.392C397.616 745.557 438.77 711.135 438.77 667.278V508.406C438.77 476.845 464.339 451.279 495.904 451.279H495.995C515.02 451.279 532.857 460.562 543.785 476.145L705.235 706.661C718.659 725.835 739.327 737.218 763.983 737.218C801.606 737.218 833.841 705.9 833.841 667.308V508.376C833.841 476.815 859.41 451.249 890.975 451.249H897.276C901.233 451.249 904.43 448.053 904.43 444.097V294.021C904.43 290.065 901.233 286.869 897.276 286.869H897.246Z"
                />
              </svg>
              Windsurf
            </div>
            <div className="ide-chip">
              <img
                src="https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/visualstudiocode.svg"
                alt=""
                onError={hideBrokenImg}
              />
              VS Code
            </div>
          </div>
        </div>
      </div>

      <div className="wf-card-body">
        <div className="wf-pill">CLI &amp; MCP</div>
        <p className="wf-desc">
          Run <code>taskmaster</code> in the terminal and wire Cursor, Windsurf, and other MCP hosts — same tasks
          everywhere.
        </p>
      </div>
    </div>
  )
}

const BAR_HEIGHTS = ['35%', '52%', '44%', '68%', '58%', '88%', '72%']

function DashboardSyncCard() {
  return (
    <div className="wf-card">
      <div className="wf-card-media">
        <div className="dash-wrap">
          <div className="dash-stats">
            <div className="dash-stat">
              <div className="dash-stat-label">Tasks done</div>
              <div className="dash-stat-val">24/31</div>
              <div className="dash-stat-sub">↑ 3 today</div>
            </div>
            <div className="dash-stat">
              <div className="dash-stat-label">API calls</div>
              <div className="dash-stat-val">1.2k</div>
              <div className="dash-stat-sub">this month</div>
            </div>
          </div>
          <div className="dash-bars-label">ACTIVITY — 7 DAYS</div>
          <div className="dash-bars">
            {BAR_HEIGHTS.map((h, i) => (
              <div key={i} className="dash-bar" style={{ height: h }} />
            ))}
          </div>
          <div className="sync-row">
            <div className="sync-pulse" />
            <div className="sync-txt">
              agents in sync with <span>dashboard</span>
            </div>
          </div>
        </div>
      </div>
      <div className="wf-card-body">
        <div className="wf-pill">Dashboard sync</div>
        <p className="wf-desc">
          Watch usage, license status, and task activity in the web dashboard — aligned with what your agents do locally.
        </p>
      </div>
    </div>
  )
}

/** Animated “How it works” cards for the landing page */
export default function WorkflowCards() {
  return (
    <div className="wf-cards-wrap">
      <PlanParseCard />
      <CliMcpCard />
      <DashboardSyncCard />
    </div>
  )
}

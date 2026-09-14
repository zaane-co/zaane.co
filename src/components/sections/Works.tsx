import { ArrowUpRight, Activity, Command, MoreHorizontal } from "lucide-react";
export default function Works() {
  return (
    <section id="works" className="studio-panel light-panel" data-reveal>
      <div className="section-heading">
        <h2>Ideas, made real.</h2>
        <span className="eyebrow">Product possibilities</span>
      </div>
      <p className="section-intro">
        A look at what we can build together. Illustrative product concepts,
        designed around real business needs.
      </p>
      <div className="work-grid">
        <a
          href="#contact"
          className="work-card"
          aria-label="Discuss a business platform project"
        >
          <div className="work-stage platform-stage">
            <div className="dashboard-demo" aria-hidden="true">
              <aside>
                <Command size={23} />
                <b>workspace</b>
                <span>Overview</span>
                <span>Projects</span>
                <span>Customers</span>
                <span>Insights</span>
                <span>Settings</span>
              </aside>
              <div className="dashboard-main">
                <div className="demo-header">
                  Your business, at a glance.
                  <MoreHorizontal size={18} />
                </div>
                <div className="demo-metrics">
                  <div>
                    <small>Revenue</small>
                    <strong>₦8.42m</strong>
                    <em>↗ 12.8%</em>
                  </div>
                  <div>
                    <small>Active projects</small>
                    <strong>24</strong>
                    <em>↑ 4 this month</em>
                  </div>
                </div>
                <div className="demo-chart">
                  <span>Performance overview</span>
                  <div>
                    {[32, 48, 39, 63, 52, 76, 66, 87, 75, 93, 82, 100].map(
                      (n, i) => (
                        <i key={i} style={{ height: `${n}%` }} />
                      ),
                    )}
                  </div>
                </div>
                <div className="demo-task">
                  <span>Website launch</span>
                  <em>In progress</em>
                </div>
                <div className="demo-task">
                  <span>Customer onboarding</span>
                  <em>Completed</em>
                </div>
              </div>
            </div>
          </div>
          <div className="work-caption">
            <div>
              <h3>Everything, connected.</h3>
              <p>Business platforms · Custom software</p>
            </div>
            <span className="round-arrow">
              <ArrowUpRight />
            </span>
          </div>
        </a>
        <a
          href="#contact"
          className="work-card"
          aria-label="Discuss a mobile app project"
        >
          <div className="work-stage mobile-stage">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <span className="mobile-backdrop-word" aria-hidden="true">
              go.
            </span>
            <div className="phone-demo" aria-hidden="true">
              <div className="phone-island" />
              <div className="phone-top">
                9:41 <span>● ▰</span>
              </div>
              <small>A little better, every day.</small>
              <h4>
                Find your
                <br />
                moment.
              </h4>
              <div className="activity-ring">
                <Activity size={34} />
                <strong>
                  64<span>min</span>
                </strong>
              </div>
              <div className="phone-stats">
                <span>
                  Distance<b>4.8 km</b>
                </span>
                <span>
                  Energy<b>320 kcal</b>
                </span>
              </div>
              <div className="phone-cta">Let’s get moving ↗</div>
            </div>
          </div>
          <div className="work-caption">
            <div>
              <h3>Made for the everyday.</h3>
              <p>Mobile experiences · Product design</p>
            </div>
            <span className="round-arrow">
              <ArrowUpRight />
            </span>
          </div>
        </a>
      </div>
    </section>
  );
}

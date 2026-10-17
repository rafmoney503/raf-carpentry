/* The small moving pieces, all from the same idea as the yellow ball on the enquiry line.
   Rail: a ball travelling along an ink line, carrying the work from one place to the next.
   Drift: faint drawing-board shapes moving very slowly.
   Level: tools of the trade, a door being measured and painted and a spirit level settling.
   Each piece is still for people who ask for less motion, and only moves while it is on screen (MotionObserver). */

/* A line with a ball running along it. Sits under page titles. */
export function Rail() {
  return (
    <div className="rail" data-motion aria-hidden="true">
      <i />
    </div>
  );
}

/* Faint shapes behind a page title, on the empty side of the page. */
export function Drift() {
  return (
    <div className="drift" aria-hidden="true">
      <i className="d-circle" />
      <i className="d-plus" />
      <i className="d-dash" />
      <i className="d-ball" />
      <i className="d-square" />
      <i className="d-ring" />
    </div>
  );
}

const FormIcon = () => (
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="4.5" y="3" width="15" height="18" rx="1" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </svg>
);
const JobsIcon = () => (
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="4" width="18" height="16" rx="1" />
    <path d="M3 9h18M8.5 9v11" />
  </svg>
);
const PhoneIcon = () => (
  <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="7" y="2.5" width="10" height="19" rx="2" />
    <path d="M11 18h2" />
  </svg>
);

/* One enquiry carried by the ball: your form, ServiceM8, my phone. Each box lights up as the ball reaches it. */
export function CarryDiagram({ label, caption, className = '' }: { label?: string; caption?: string; className?: string }) {
  return (
    <figure className={`carry ${className}`} data-motion>
      {label ? <p className="kicker carry-label">{label}</p> : null}
      <div className="carry-row" role="img" aria-label="Your form goes into ServiceM8, then onto my phone">
        <span className="carry-line" aria-hidden="true" />
        <span className="carry-track" aria-hidden="true">
          <i />
        </span>
        <span className="carry-node" aria-hidden="true">
          <span className="carry-box n1">
            <FormIcon />
          </span>
          <b>Your form</b>
        </span>
        <span className="carry-node" aria-hidden="true">
          <span className="carry-box n2">
            <JobsIcon />
          </span>
          <b>ServiceM8</b>
        </span>
        <span className="carry-node" aria-hidden="true">
          <span className="carry-box n3">
            <PhoneIcon />
          </span>
          <b>My phone</b>
        </span>
      </div>
      {caption ? <figcaption className="small muted">{caption}</figcaption> : null}
    </figure>
  );
}

/* A 600 x 2000 door: measured, then given coat 1 and coat 2, with the sum beside it. */
export function DoorCoats() {
  return (
    <figure className="door-fig" data-motion>
      <div className="door-draw" aria-hidden="true">
        <span className="dim-label dl-w">600</span>
        <span className="dim-tick dt-wl" />
        <span className="dim-line dim-w" />
        <span className="dim-tick dt-wr" />
        <span className="dim-label dl-h">2000</span>
        <span className="dim-tick dt-ht" />
        <span className="dim-line dim-h" />
        <span className="dim-tick dt-hb" />
        <span className="door">
          <i className="coat coat-1" />
          <i className="coat coat-2" />
          <i className="door-panel" />
          <i className="door-handle" />
        </span>
      </div>
      <figcaption className="door-facts">
        <div>
          <span>Tall door</span>
          <b className="mono">600 × 2000 mm</b>
        </div>
        <div>
          <span>Both faces and edges</span>
          <b className="mono">2.5 m²</b>
        </div>
        <div>
          <span>Coat</span>
          <b className="mono coat-no">
            <i className="cn-1" aria-hidden="true">
              1 of 2
            </i>
            <i className="cn-2">2 of 2</i>
          </b>
        </div>
        <div className="door-total">
          <span>Top coat, brushed</span>
          <b>
            <span className="hl">0.44 L</span>
          </b>
        </div>
      </figcaption>
    </figure>
  );
}

/* A spirit level whose bubble wobbles and settles in the middle. */
export function SpiritLevel({ className = '' }: { className?: string }) {
  return (
    <div className={`level ${className}`} data-motion aria-hidden="true">
      <div className="level-bar">
        <i className="level-hole" />
        <span className="level-vial">
          <i className="level-tick" />
          <i className="level-tick" />
          <i className="level-bubble" />
        </span>
        <i className="level-hole" />
      </div>
    </div>
  );
}

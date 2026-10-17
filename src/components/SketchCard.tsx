import OpenSketch from './OpenSketch';
import StepsMark from './StepsMark';

/* A card that opens the 'Sketch my system' planner, with the steps logo being built one step at a time beside it.
   Sits just above the bottom band on Systems, Trades and How it works. */

export default function SketchCard() {
  return (
    <section className="sketch-band" aria-labelledby="sketch-card-title">
      <div className="wrap">
        <div className="sketch-card">
          <div className="sketch-mark">
            <StepsMark play="build" roomy delay={0.6} />
          </div>
          <div className="sketch-text">
            <p className="kicker">60 seconds</p>
            <h2 className="h3" id="sketch-card-title">
              Sketch my system
            </h2>
            <p className="body">Tap what eats your time and the parts of your system appear, one at a time. Then send it to me.</p>
            <OpenSketch className="btn">
              <span className="dot" aria-hidden="true" />
              Sketch my system in 60 seconds
            </OpenSketch>
          </div>
        </div>
      </div>
    </section>
  );
}

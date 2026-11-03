import OpenSketch from './OpenSketch';
import StepsMark from './StepsMark';

/* A card that opens Start a project (the seven questions), with the steps logo being built one step at a time beside
   it. Sits just above the bottom band on Systems, Trades and How it works. */

export default function SketchCard() {
  return (
    <section className="sketch-band" aria-labelledby="sketch-card-title">
      <div className="wrap">
        <div className="sketch-card">
          <div className="sketch-mark">
            <StepsMark play="build" roomy delay={0.6} />
          </div>
          <div className="sketch-text">
            <p className="kicker">About a minute</p>
            <h2 className="h3" id="sketch-card-title">
              Start a project
            </h2>
            <p className="body">Seven quick questions: what you&apos;d like built, what you use now and what eats your time. Then it comes straight to me.</p>
            <OpenSketch className="btn">
              <span className="dot" aria-hidden="true" />
              Start a project
            </OpenSketch>
          </div>
        </div>
      </div>
    </section>
  );
}

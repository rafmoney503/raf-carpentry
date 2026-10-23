import Image from 'next/image';

/* The CabinetOS band on the home page: the same app on a computer screen, a tablet and a phone, drawn in CSS
   (src/app/home.css .dv-*), standing together on one desk line. Plain devices with no maker's marks. Sizes are
   in cqw of the figure round it (.app-shot is the container), so the three keep their places at any width.
   Each screen is the real screenshot at its own shape (computer 2400 x 1500, tablet 1230 x 1770, phone 780 x
   1688), so nothing is squashed; the phone's status strip covers the top of its screenshot. Inside TiltShot the
   tablet and phone stand a little in front of the screen (translateZ), so they move apart as it leans. */
export type Shot = { src: string; alt: string };

export default function DeviceTrio({ computer, tablet, phone }: { computer: Shot; tablet?: Shot; phone?: Shot }) {
  return (
    <div className="dv">
      <div className="dv-mon">
        <div className="dv-mon-body">
          <div className="dv-screen dv-mon-screen">
            <Image src={computer.src} alt={computer.alt} fill sizes="(max-width: 860px) 80vw, 560px" />
          </div>
        </div>
        <i className="dv-neck" aria-hidden="true" />
        <i className="dv-foot" aria-hidden="true" />
      </div>
      {tablet ? (
        <div className="dv-tab">
          <div className="dv-screen dv-tab-screen">
            <Image src={tablet.src} alt={tablet.alt} fill sizes="(max-width: 860px) 36vw, 240px" />
          </div>
        </div>
      ) : null}
      {phone ? (
        <div className="dv-phone">
          <div className="dv-screen dv-phone-screen">
            <i className="dv-status" aria-hidden="true" />
            <div className="dv-view">
              <Image src={phone.src} alt={phone.alt} fill sizes="(max-width: 860px) 20vw, 130px" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

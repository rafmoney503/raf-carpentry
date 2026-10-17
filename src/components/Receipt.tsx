/* What the visitor sees once their enquiry is in: the steps the system just did, which is the demo. */

export default function Receipt({ first, job, emailed, hasEmail, onAgain }: { first: string; job: string; emailed: boolean; hasEmail: boolean; onAgain: () => void }) {
  return (
    <div className="receipt" role="status">
      <span className="pill built">Sent</span>
      <p style={{ fontFamily: 'var(--f-display)', fontWeight: 700, fontSize: 26, letterSpacing: '-0.02em', lineHeight: 1.15 }}>Thanks, {first}. Here&apos;s what just happened:</p>
      <ol>
        <li>
          <span>
            <strong>{job ? `Job ${job} made in my ServiceM8` : 'A job made in my ServiceM8'}</strong>, with your name, your details and what you wrote.
          </span>
        </li>
        <li>
          <span>
            {emailed ? (
              <>
                <strong>A confirmation email sent to you</strong>{' '}through ServiceM8 and filed on the job. Reply to it and it lands on the same job.
              </>
            ) : hasEmail ? (
              <>
                <strong>Your confirmation email is on its way</strong>. If it hasn&apos;t arrived in 10 minutes, check your junk folder.
              </>
            ) : (
              <>
                <strong>No email given</strong>, so I&apos;ll reply by phone or WhatsApp.
              </>
            )}
          </span>
        </li>
        <li>
          <span>
            <strong>It&apos;s on my phone</strong>{' '}at the top of Today in the Job Kit. I&apos;ll come back with one question or a first sketch.
          </span>
        </li>
      </ol>
      <p className="small muted">That took about two seconds and nobody typed anything twice. It&apos;s the same kind of system I&apos;d build for you.</p>
      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} onClick={onAgain}>
        Send another
      </button>
    </div>
  );
}

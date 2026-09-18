const COUNTDOWN = {
  election: '2026-11-03',
  voting_begins: '2026-10-15',
};

function daysUntil(dateStr) {
  const target = new Date(`${dateStr}T00:00:00`);
  const now = new Date();
  return Math.max(0, Math.round((target - now) / 86400000));
}

export default function Countdown() {
  const toElection = daysUntil(COUNTDOWN.election);
  const toVoting = daysUntil(COUNTDOWN.voting_begins);
  return (
    <div className="countdown" role="timer" aria-label="Election countdown">
      <span className="cd-line"><b>{toElection}</b> days to election</span>
      <span className="cd-line"><b>{toVoting}</b> days until voting begins</span>
    </div>
  );
}
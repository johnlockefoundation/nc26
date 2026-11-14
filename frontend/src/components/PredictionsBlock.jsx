import { useEffect, useState } from 'react';
import CollapsibleMetric from './CollapsibleMetric.jsx';
import { loadKalshiResults, kalshiResultFor } from '../lib/kalshiResults.js';
import { assetUrl, getMov } from '../api.js';

export default function PredictionsBlock({ districtId, markets, polls }) {
  const [kalshi, setKalshi] = useState(null);
  const [pollsRow, setPollsRow] = useState(null);
  const [result, setResult] = useState(null);
  const [mov, setMov] = useState(null);

  useEffect(() => {
    let alive = true;
    loadKalshiResults().then((d) => { if (alive) setKalshi(kalshiResultFor(d, districtId)); });
    fetch(assetUrl('polls-results.json')).then((r) => r.ok ? r.json() : null).then((d) => {
      if (alive && d && d.races) setPollsRow(d.races[districtId]);
    }).catch(() => {});
    fetch(assetUrl('results.json')).then((r) => r.ok ? r.json() : null).then((d) => {
      if (alive && d && d.races) setResult(d.races[districtId]);
    }).catch(() => {});
    getMov(districtId).then((m) => { if (alive) setMov(m); }).catch(() => {});
    return () => { alive = false; };
  }, [districtId]);

  const kalshiMargin = mov && mov.available && mov.margin != null
    ? `${mov.party} +${Math.abs(mov.margin).toFixed(1)}`
    : (kalshi
        ? `${kalshi.pre_dem > kalshi.pre_rep ? 'D' : 'R'} +${(Math.abs(kalshi.pre_dem - kalshi.pre_rep) * 100).toFixed(1)} (price)`
        : null);
  const pollMargin = pollsRow
    ? `${pollsRow.poll_margin >= 0 ? 'D' : 'R'} +${Math.abs(pollsRow.poll_margin).toFixed(1)}`
    : null;
  const finalMov = result
    ? `${result.margin_pp >= 0 ? 'D' : 'R'} +${Math.abs(result.margin_pp).toFixed(1)} pp`
    : null;

  const hasAny = kalshi || pollsRow || markets?.available || polls?.available;
  if (!hasAny) return null;

  return (
    <CollapsibleMetric title="PREDICTIONS" value={null} open>
      <div className="ballot-rows">
        {kalshiMargin && (
          <div className="ballot-row">
            <span className="ballot-row-party">{mov && mov.available ? 'KALSHI PREDICTED MOV' : 'KALSHI PRICE MARGIN'}</span>
            <span className="ballot-row-share" />
            <span className={`ballot-row-count ${kalshiMargin?.startsWith('D') ? 'val-d' : 'val-r'}`}>{kalshiMargin}</span>
          </div>
        )}
        {pollsRow && (
          <div className="ballot-row">
            <span className="ballot-row-party">POLL MARGIN, ELECTION DAY</span>
            <span className="ballot-row-share" />
            <span className={`ballot-row-count ${pollMargin?.startsWith('D') ? 'val-d' : 'val-r'}`}>{pollMargin}</span>
          </div>
        )}
        {finalMov && (
          <div className="ballot-row ballot-row-total">
            <span className="ballot-row-party">FINAL MARGIN OF VICTORY</span>
            <span className="ballot-row-share" />
            <span className={`ballot-row-count ${finalMov?.startsWith('D') ? 'val-d' : 'val-r'}`}>{finalMov}</span>
          </div>
        )}
      </div>
    </CollapsibleMetric>
  );
}
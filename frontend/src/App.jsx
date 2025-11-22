import React, { useEffect, useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { mockRows } from './mockData';

const Panel = ({ title, children }) => (
  <div className="panel">
    <div className="panel-header">{title}</div>
    <div className="panel-body">{children}</div>
  </div>
);

const factors = ['PE_TTM', 'PB', 'PS_TTM', 'EV_EBITDA'];

function percentileAscending(values, target) {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length <= 1) return 0.5;
  const idx = sorted.findIndex((v) => v === target);
  const rank = idx === -1 ? sorted.length - 1 : idx;
  return rank / (sorted.length - 1);
}

function computeValueScores(rows) {
  const result = rows.map((row) => ({ ...row }));
  factors.forEach((f) => {
    const values = result.map((r) => r[f]);
    result.forEach((r, i) => {
      const pct = percentileAscending(values, r[f]);
      result[i][`${f}_pct`] = pct * 100;
    });
  });

  result.forEach((r, i) => {
    const inverted = factors.map((f) => 100 - (r[`${f}_pct`] ?? 50));
    const valueScore = inverted.reduce((a, b) => a + b, 0) / factors.length;
    result[i].value_score = valueScore;
  });
  return result;
}

function groupByIndustry(rows) {
  const grouped = {};
  rows.forEach((row) => {
    grouped[row.industry] = grouped[row.industry] || [];
    grouped[row.industry].push(row);
  });
  return Object.entries(grouped).map(([industry, list]) => ({ industry, list }));
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

function App() {
  const dateOptions = useMemo(
    () => Array.from(new Set(mockRows.map((r) => r.date))).sort(),
    []
  );
  const [selectedDate, setSelectedDate] = useState(dateOptions[dateOptions.length - 1] || '');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [message] = useState('Demo data loaded. Ready for visual preview (no backend needed).');

  const rowsForDate = useMemo(
    () => mockRows.filter((r) => r.date === selectedDate),
    [selectedDate]
  );

  const scoredRows = useMemo(() => computeValueScores(rowsForDate), [rowsForDate]);

  useEffect(() => {
    setSelectedTicker('');
    setSelectedIndustry('');
  }, [selectedDate]);

  const industryOptions = useMemo(
    () => Array.from(new Set(rowsForDate.map((r) => r.industry))).sort(),
    [rowsForDate]
  );

  const tickerOptions = useMemo(() => {
    return rowsForDate
      .filter((r) => (selectedIndustry ? r.industry === selectedIndustry : true))
      .map((r) => r.ticker);
  }, [rowsForDate, selectedIndustry]);

  const snapshot = useMemo(() => {
    return scoredRows.filter((r) => (selectedIndustry ? r.industry === selectedIndustry : true));
  }, [scoredRows, selectedIndustry]);

  const heatmapData = useMemo(() => {
    return groupByIndustry(scoredRows).map(({ industry, list }) => ({
      industry,
      median_value_score: median(list.map((r) => r.value_score)),
      median_PE_TTM: median(list.map((r) => r.PE_TTM)),
      median_PB: median(list.map((r) => r.PB)),
      count: list.length
    }));
  }, [scoredRows]);

  const scatterData = useMemo(
    () =>
      scoredRows.map((r) => ({
        ...r,
        x: r.PB,
        y: r.ROE,
        color: '#5ad8a6'
      })),
    [scoredRows]
  );

  const stockSummary = useMemo(() => {
    if (!selectedTicker) return null;
    const current = scoredRows.find((r) => r.ticker === selectedTicker);
    if (!current) return null;
    const universeRanks = [...scoredRows]
      .sort((a, b) => b.value_score - a.value_score)
      .map((r, idx) => ({ ticker: r.ticker, rank: idx + 1 }));
    const industryRanks = scoredRows
      .filter((r) => r.industry === current.industry)
      .sort((a, b) => b.value_score - a.value_score)
      .map((r, idx) => ({ ticker: r.ticker, rank: idx + 1 }));
    const uRank = universeRanks.find((r) => r.ticker === current.ticker)?.rank;
    const iRank = industryRanks.find((r) => r.ticker === current.ticker)?.rank;

    return {
      ...current,
      universe_value_rank: uRank,
      industry_value_rank: iRank
    };
  }, [selectedTicker, scoredRows]);

  const heatmapOption = useMemo(() => {
    if (!heatmapData.length) return {};
    return {
      title: { text: 'Industry Heatmap', textStyle: { color: '#e0e0e0' } },
      tooltip: { formatter: (p) => `${p.name}<br/>Value Score: ${p.value}` },
      visualMap: {
        min: 0,
        max: 100,
        left: 'left',
        bottom: 0,
        text: ['Rich', 'Cheap'],
        inRange: { color: ['#d94e5d', '#4caf50'] },
        textStyle: { color: '#e0e0e0' }
      },
      series: [
        {
          name: 'Value Score',
          type: 'treemap',
          data: heatmapData.map((row) => ({
            name: `${row.industry} (${row.count})`,
            value: row.median_value_score,
            children: [
              { name: 'Median PE', value: row.median_PE_TTM },
              { name: 'Median PB', value: row.median_PB }
            ]
          })),
          label: { color: '#f5f5f5' }
        }
      ],
      backgroundColor: '#121212'
    };
  }, [heatmapData]);

  const scatterOption = useMemo(() => {
    return {
      backgroundColor: '#121212',
      title: { text: 'PB vs ROE', textStyle: { color: '#e0e0e0' } },
      tooltip: {
        trigger: 'item',
        formatter: (params) => {
          const d = params.data;
          return `${d.ticker}<br/>${d.name || ''}<br/>PB: ${d.x}<br/>ROE: ${(d.y * 100).toFixed(1)}%`;
        }
      },
      xAxis: { name: 'PB', nameTextStyle: { color: '#e0e0e0' }, axisLine: { lineStyle: { color: '#555' } } },
      yAxis: { name: 'ROE', nameTextStyle: { color: '#e0e0e0' }, axisLabel: { formatter: (v) => `${(v * 100).toFixed(0)}%` }, axisLine: { lineStyle: { color: '#555' } } },
      series: [
        {
          symbolSize: (data) => Math.max(6, Math.sqrt((data.mktcap || 0) / 1e8)),
          data: scatterData,
          type: 'scatter',
          itemStyle: {
            color: (params) => params.data.color || '#5ad8a6'
          }
        }
      ]
    };
  }, [scatterData]);

  const tableRows = snapshot.slice(0, 50);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>A-share Valuation Lab</h1>
          <p>Pure web preview with simulated A-share factors. Switch date/industry to explore visuals.</p>
        </div>
        <div className="upload">
          <div className="upload-label static">Demo mode</div>
          <div className="message">{message}</div>
        </div>
      </header>

      <section className="controls">
        <div>
          <label>Date</label>
          <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
            <option value="">Select date</option>
            {dateOptions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Industry</label>
          <select value={selectedIndustry} onChange={(e) => setSelectedIndustry(e.target.value)}>
            <option value="">All</option>
            {industryOptions.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label>Ticker</label>
          <select value={selectedTicker} onChange={(e) => setSelectedTicker(e.target.value)}>
            <option value="">Select ticker</option>
            {tickerOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </section>

      <div className="grid">
        <Panel title="Industry Heatmap">
          <ReactECharts option={heatmapOption} style={{ height: 360 }} />
        </Panel>
        <Panel title="PB vs ROE Scatter">
          <ReactECharts option={scatterOption} style={{ height: 360 }} />
        </Panel>
        <Panel title="Market Snapshot">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Name</th>
                  <th>Industry</th>
                  <th>PE</th>
                  <th>PB</th>
                  <th>PS</th>
                  <th>Value Score</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((row) => (
                  <tr key={row.ticker}>
                    <td>{row.ticker}</td>
                    <td>{row.name}</td>
                    <td>{row.industry}</td>
                    <td>{row.PE_TTM?.toFixed(2)}</td>
                    <td>{row.PB?.toFixed(2)}</td>
                    <td>{row.PS_TTM?.toFixed(2)}</td>
                    <td>{row.value_score ? row.value_score.toFixed(1) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Stock Valuation Card">
          {stockSummary ? (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="ticker">{stockSummary.ticker}</div>
                  <div className="name">{stockSummary.name}</div>
                  <div className="industry-tag">{stockSummary.industry}</div>
                </div>
                <div className="score">Value Score: {stockSummary.value_score?.toFixed(1)}</div>
              </div>
              <div className="card-grid">
                <div>
                  <div className="label">PE_TTM</div>
                  <div className="value">{stockSummary.PE_TTM}</div>
                </div>
                <div>
                  <div className="label">PB</div>
                  <div className="value">{stockSummary.PB}</div>
                </div>
                <div>
                  <div className="label">PS_TTM</div>
                  <div className="value">{stockSummary.PS_TTM}</div>
                </div>
                <div>
                  <div className="label">EV_EBITDA</div>
                  <div className="value">{stockSummary.EV_EBITDA}</div>
                </div>
              </div>
              <div className="bars">
                <div>
                  <span>Rank (Market): </span>
                  <span className="bar" style={{ width: `${100 - (stockSummary.universe_value_rank || 0)}%` }} />
                  <span className="rank">#{stockSummary.universe_value_rank}</span>
                </div>
                <div>
                  <span>Rank (Industry): </span>
                  <span className="bar" style={{ width: `${100 - (stockSummary.industry_value_rank || 0)}%` }} />
                  <span className="rank">#{stockSummary.industry_value_rank}</span>
                </div>
              </div>
              <div className="placeholder">
                Time-series chart placeholder. Extend with longitudinal factors when data is available.
              </div>
            </div>
          ) : (
            <div className="placeholder">Select a ticker to see details.</div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export default App;

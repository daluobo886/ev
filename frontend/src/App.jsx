import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import ReactECharts from 'echarts-for-react';

const API_BASE = '/api';

const Panel = ({ title, children }) => (
  <div className="panel">
    <div className="panel-header">{title}</div>
    <div className="panel-body">{children}</div>
  </div>
);

function App() {
  const [uploading, setUploading] = useState(false);
  const [dates, setDates] = useState([]);
  const [industries, setIndustries] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedIndustry, setSelectedIndustry] = useState('');
  const [tickers, setTickers] = useState([]);
  const [selectedTicker, setSelectedTicker] = useState('');
  const [snapshot, setSnapshot] = useState([]);
  const [heatmapData, setHeatmapData] = useState([]);
  const [scatterData, setScatterData] = useState([]);
  const [stockSummary, setStockSummary] = useState(null);
  const [message, setMessage] = useState('Upload an Excel file to get started.');

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const { data } = await axios.post(`${API_BASE}/upload-factors`, formData);
      setDates(data.dates || []);
      setIndustries(data.industries || []);
      if (data.dates?.length) {
        setSelectedDate(data.dates[data.dates.length - 1]);
      }
      setMessage('Upload successful. Choose a date and view analytics.');
    } catch (err) {
      setMessage(err?.response?.data?.detail || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    const fetchTickers = async () => {
      if (!selectedDate) return;
      const params = { date: selectedDate };
      if (selectedIndustry) params.industry = selectedIndustry;
      const { data } = await axios.get(`${API_BASE}/tickers`, { params });
      setTickers(data);
    };
    fetchTickers();
  }, [selectedDate, selectedIndustry]);

  useEffect(() => {
    const fetchSnapshot = async () => {
      if (!selectedDate) return;
      const params = { date: selectedDate };
      if (selectedIndustry) params.industry = selectedIndustry;
      const { data } = await axios.get(`${API_BASE}/snapshot`, { params });
      setSnapshot(data.data);
    };

    const fetchHeatmap = async () => {
      if (!selectedDate) return;
      const { data } = await axios.get(`${API_BASE}/heatmap`, { params: { date: selectedDate } });
      setHeatmapData(data);
    };

    const fetchScatter = async () => {
      if (!selectedDate) return;
      const { data } = await axios.get(`${API_BASE}/scatter`, {
        params: { date: selectedDate, x: 'PB', y: 'ROE', color_by: 'industry' }
      });
      const points = data.points.map((p) => ({
        ...p,
        x: p.x ?? p.PB,
        y: p.y ?? p.ROE
      }));
      setScatterData(points);
    };

    fetchSnapshot();
    fetchHeatmap();
    fetchScatter();
  }, [selectedDate, selectedIndustry]);

  useEffect(() => {
    const fetchStock = async () => {
      if (!selectedDate || !selectedTicker) return;
      const { data } = await axios.get(`${API_BASE}/stock-summary`, {
        params: { date: selectedDate, ticker: selectedTicker }
      });
      setStockSummary(data);
    };
    fetchStock();
  }, [selectedTicker, selectedDate]);

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
              {
                name: 'PE',
                value: row.median_PE_TTM
              },
              {
                name: 'PB',
                value: row.median_PB
              }
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
          return `${d.ticker}<br/>${d.name || ''}<br/>PB: ${d.x}<br/>ROE: ${d.y}`;
        }
      },
      xAxis: { name: 'PB', nameTextStyle: { color: '#e0e0e0' }, axisLine: { lineStyle: { color: '#555' } } },
      yAxis: { name: 'ROE', nameTextStyle: { color: '#e0e0e0' }, axisLine: { lineStyle: { color: '#555' } } },
      series: [
        {
          symbolSize: (data) => Math.max(6, Math.sqrt(data.mktcap || 0) / 100),
          data: scatterData,
          type: 'scatter',
          itemStyle: {
            color: (params) => params.data.color || '#5ad8a6'
          }
        }
      ]
    };
  }, [scatterData]);

  const tableRows = snapshot
    .filter((row) => (selectedIndustry ? row.industry === selectedIndustry : true))
    .slice(0, 50);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>A-share Valuation Lab</h1>
          <p>Upload factor Excel files, explore industries, and review single-stock value scores.</p>
        </div>
        <div className="upload">
          <label className="upload-label">
            <input type="file" accept=".xlsx,.xls" onChange={handleUpload} disabled={uploading} />
            {uploading ? 'Uploading…' : 'Upload Excel'}
          </label>
          <div className="message">{message}</div>
        </div>
      </header>

      <section className="controls">
        <div>
          <label>Date</label>
          <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
            <option value="">Select date</option>
            {dates.map((d) => (
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
            {industries.map((ind) => (
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
            {tickers.map((t) => (
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

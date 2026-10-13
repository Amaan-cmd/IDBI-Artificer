import React, { useState } from 'react';
import { 
  Layers, UploadCloud, FileSpreadsheet, Download, CheckCircle2, 
  Clock, Play, Pause, AlertCircle, FileArchive, Check, ArrowRight
} from 'lucide-react';
import './BatchUploadView.css';

const SAMPLE_BATCH = [
  { id: 1, name: 'Precision Dies & Moulds Ltd', gstin: '27AABCP1122M1Z4', state: 'Maharashtra', status: 'COMPLETED', score: 812, risk: 'LOW' },
  { id: 2, name: 'Gujarat Polymers & Resins LLP', gstin: '24AAECG8891P1ZX', state: 'Gujarat', status: 'COMPLETED', score: 748, risk: 'LOW' },
  { id: 3, name: 'Deccan Metal Castings Pvt Ltd', gstin: '27AADCD4512Q1Z9', state: 'Maharashtra', status: 'COMPLETED', score: 792, risk: 'LOW' },
  { id: 4, name: 'Kisan Fertilisers & Seeds Corp', gstin: '27AABCK9901R1Z1', state: 'Maharashtra', status: 'PROCESSING', score: '...', risk: 'RUNNING' },
  { id: 5, name: 'Western Logistics Express LLP', gstin: '27AAECW3412L1Z8', state: 'Maharashtra', status: 'QUEUED', score: '—', risk: 'PENDING' },
  { id: 6, name: 'Sahyadri Agro Processing Co', gstin: '27AABCS6781P1Z2', state: 'Maharashtra', status: 'QUEUED', score: '—', risk: 'PENDING' }
];

export default function BatchUploadView() {
  const [batchFile, setBatchFile] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState(50); // 3 of 6 completed

  const handleDownloadTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "business_name,gstin,pan,annual_turnover,statement_url\n" +
      "Apex Precision Engineering,27AADCB2230M1Z2,AADCB2230M,9680000,https://vault.enverai.tech/statements/apex_stmt.pdf\n" +
      "Surat Textile Weaving LLP,24AABCS4421P1Z9,AABCS4421P,14200000,https://vault.enverai.tech/statements/surat_stmt.pdf\n" +
      "Kalyan Agro Supply & Logistics,27AAGCK8812L1ZQ,AAGCK8812L,6800000,https://vault.enverai.tech/statements/kalyan_stmt.pdf\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "enver_underwriting_batch_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleToggleRun = () => {
    setIsRunning(!isRunning);
  };

  return (
    <div className="batch-upload-view animate-fade-up">
      {/* Header */}
      <div className="batch-header">
        <div>
          <h1 className="batch-title">Batch Overnight Underwriting Engine</h1>
          <p className="batch-subtitle">
            Upload CSV or compressed Zip portfolios to autonomously underwrite 10–50 businesses simultaneously.
          </p>
        </div>
        <button className="template-download-btn" onClick={handleDownloadTemplate}>
          <Download size={14} />
          <span>Download Sample CSV Template</span>
        </button>
      </div>

      {/* Upload Zone */}
      <div className="batch-dropzone-panel">
        <div className="dropzone-box">
          <div className="batch-icon-ring">
            <UploadCloud size={28} />
          </div>
          <div className="dropzone-copy">
            <span className="drop-main">Drop portfolio CSV or Zip folder here</span>
            <span className="drop-sub">Columns: business_name, gstin, pan, annual_turnover, statement_url</span>
          </div>
          <label className="batch-browse-btn">
            <span>Browse Files</span>
            <input 
              type="file" 
              accept=".csv,.zip,.xlsx" 
              className="hidden-file-input" 
              onChange={e => {
                if (e.target.files && e.target.files[0]) {
                  setBatchFile(e.target.files[0]);
                }
              }}
            />
          </label>
        </div>
      </div>

      {/* Active Batch Pipeline Runner */}
      <div className="batch-runner-card">
        <div className="runner-header">
          <div className="runner-title-wrap">
            <Layers size={18} className="text-gold" />
            <div>
              <h3 className="runner-title">Active Batch: Q3 MSME Supply-Chain Portfolio</h3>
              <span className="runner-meta">6 Enterprises Queued · Priority Institutional Batch</span>
            </div>
          </div>

          <div className="runner-controls">
            <button 
              className={`runner-action-btn ${isRunning ? 'running' : ''}`}
              onClick={handleToggleRun}
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
              <span>{isRunning ? 'Pause Batch' : 'Run Fleet Underwrite'}</span>
            </button>
          </div>
        </div>

        {/* Progress */}
        <div className="batch-progress-bar-wrap">
          <div className="batch-progress-info">
            <span>Processing Status: 3 of 6 Finished (50%)</span>
            <span>Est. Remaining: 4.2s</span>
          </div>
          <div className="batch-progress-track">
            <div className="batch-progress-fill" style={{ width: `${batchProgress}%` }} />
          </div>
        </div>

        {/* Batch Queue Table */}
        <div className="batch-table-wrap">
          <table className="batch-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Enterprise Name</th>
                <th>GSTIN</th>
                <th>Jurisdiction</th>
                <th>Audit Status</th>
                <th>Credit Score</th>
                <th>Risk Tier</th>
              </tr>
            </thead>
            <tbody>
              {SAMPLE_BATCH.map(row => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td className="font-semibold text-white">{row.name}</td>
                  <td className="font-mono text-gold">{row.gstin}</td>
                  <td>{row.state}</td>
                  <td>
                    <span className={`status-chip ${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td className="font-mono font-bold text-emerald">{row.score}</td>
                  <td>
                    <span className={`risk-chip ${row.risk.toLowerCase()}`}>
                      {row.risk}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

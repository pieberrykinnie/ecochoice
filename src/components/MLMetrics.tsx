import React, { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import { MLService } from '../services/MLService';

interface ModelMetrics {
  dataPoints: number;
  lastTraining: string;
  accuracy: number;
}

interface TrainingHistory {
  timestamp: string;
  accuracy: number;
  loss: number;
}

export const MLMetrics: React.FC = () => {
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [history, setHistory] = useState<TrainingHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadMetrics = async () => {
      try {
        const mlService = MLService.getInstance();
        const currentMetrics = await mlService.getModelMetrics();
        setMetrics(currentMetrics);

        // Load training history from storage
        const data = await chrome.storage.local.get('trainingHistory');
        if (data.trainingHistory) {
          setHistory(data.trainingHistory);
        }
      } catch (error) {
        console.error('Error loading ML metrics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadMetrics();
  }, []);

  if (isLoading) {
    return <div className="loading">Loading metrics...</div>;
  }

  if (!metrics) {
    return <div className="error">Unable to load metrics</div>;
  }

  const chartData = {
    labels: history.map(h => h.timestamp),
    datasets: [
      {
        label: 'Model Accuracy',
        data: history.map(h => h.accuracy),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1
      },
      {
        label: 'Loss',
        data: history.map(h => h.loss),
        borderColor: 'rgb(255, 99, 132)',
        tension: 0.1
      }
    ]
  };

  return (
    <div className="ml-metrics">
      <h2>ML Model Performance</h2>
      
      <div className="metrics-grid">
        <div className="metric-card">
          <h3>Training Data</h3>
          <p className="metric-value">{metrics.dataPoints}</p>
          <p className="metric-label">samples collected</p>
        </div>
        
        <div className="metric-card">
          <h3>Model Accuracy</h3>
          <p className="metric-value">{(metrics.accuracy * 100).toFixed(1)}%</p>
          <p className="metric-label">on validation set</p>
        </div>
        
        <div className="metric-card">
          <h3>Last Training</h3>
          <p className="metric-value">{new Date(metrics.lastTraining).toLocaleDateString()}</p>
          <p className="metric-label">at {new Date(metrics.lastTraining).toLocaleTimeString()}</p>
        </div>
      </div>

      <div className="chart-container">
        <h3>Training History</h3>
        <Line data={chartData} options={{
          responsive: true,
          scales: {
            y: {
              beginAtZero: true,
              max: 1
            }
          }
        }} />
      </div>

      <style jsx>{`
        .ml-metrics {
          padding: 1.5rem;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin: 1.5rem 0;
        }

        .metric-card {
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 6px;
          text-align: center;
        }

        .metric-value {
          font-size: 2rem;
          font-weight: bold;
          color: #2c3e50;
          margin: 0.5rem 0;
        }

        .metric-label {
          color: #6c757d;
          font-size: 0.9rem;
        }

        .chart-container {
          margin-top: 2rem;
          padding: 1rem;
          background: #f8f9fa;
          border-radius: 6px;
        }

        .loading, .error {
          text-align: center;
          padding: 2rem;
          color: #6c757d;
        }
      `}</style>
    </div>
  );
}; 
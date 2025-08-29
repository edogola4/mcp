import React, { useState } from 'react';
import { rpcClient } from '../utils/rpcClient';

const RPCExample: React.FC = () => {
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [method, setMethod] = useState('');
  const [params, setParams] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      // Parse the params as JSON if provided
      const parsedParams = params ? JSON.parse(params) : undefined;
      const response = await rpcClient.call(method, parsedParams);
      setResult(response);
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      console.error('RPC Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px' }}>
      <h2>RPC Example</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="method" style={{ display: 'block', marginBottom: '5px' }}>
            Method:
          </label>
          <input
            id="method"
            type="text"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            placeholder="e.g., user.getProfile"
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
            }}
            required
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="params" style={{ display: 'block', marginBottom: '5px' }}>
            Parameters (JSON):
          </label>
          <textarea
            id="params"
            value={params}
            onChange={(e) => setParams(e.target.value)}
            placeholder='e.g., {"userId": 123}'
            style={{
              width: '100%',
              minHeight: '80px',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #ccc',
              fontFamily: 'monospace',
            }}
          />
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            padding: '10px 15px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? 'Sending...' : 'Send RPC Request'}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: '20px',
            padding: '10px',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            color: '#721c24',
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: '20px' }}>
          <h3>Result:</h3>
          <pre
            style={{
              padding: '10px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #e9ecef',
              borderRadius: '4px',
              maxHeight: '400px',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};

export default RPCExample;

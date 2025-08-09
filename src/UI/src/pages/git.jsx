import React, { useState } from 'react';
import './git.css';

const GitPage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [repoUrl, setRepoUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [projectName, setProjectName] = useState('');
  const [pipelineName, setPipelineName] = useState('');
  const [sshPrivateKey, setSshPrivateKey] = useState('');
  const [sshPublicKey, setSshPublicKey] = useState('');

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!repoUrl.trim()) {
      setError('Repository URL is required');
      return;
    }

    if (!sshPrivateKey.trim() || !sshPublicKey.trim()) {
      setError('Both private and public SSH keys are required');
      return;
    }

    if (!pipelineName.trim()) {
      setError('Pipeline name is required');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const base64PrivateKey = btoa(sshPrivateKey);
      const base64PublicKey = btoa(sshPublicKey);
      
      const requestBody = {
        pipelineName: pipelineName,
        repoUrl: repoUrl,
        branch: branch,
        projectName: projectName || 'kedro-project',
        experimentName: 'kedro-pipeline',
        sshPrivateKey: base64PrivateKey,
        sshPublicKey: base64PublicKey
      };
        
        const response = await fetch(`${API_BASE_URL}/pipelines/trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'user-id': 'default-user'
          },
        body: JSON.stringify(requestBody)
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Pipeline triggered successfully:', data);
          
        setSuccess(`✅ DAG triggered successfully!\n\nGUID: ${data.data.guid}\nPipeline: ${pipelineName}\nRepository: ${repoUrl}\n\nYou can track the execution in Airflow UI.`);
        
        setRepoUrl('');
        setBranch('main');
        setProjectName('');
        setPipelineName('');
        setSshPrivateKey('');
        setSshPublicKey('');
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to trigger pipeline');
        }
    } catch (err) {
      setError(err.message);
      console.error('Pipeline trigger error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="git-page">
      <div className="container">
        <h1>Pipeline Trigger</h1>
        <p>Trigger a Kedro pipeline using SSH authentication</p>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

        {success && (
          <div className="success-message">
            <pre>{success}</pre>
        </div>
        )}

        <form onSubmit={handleSubmit} className="pipeline-form">
          <div className="form-group">
            <label htmlFor="repoUrl">Repository URL (HTTPS):</label>
            <input
              type="text"
              id="repoUrl"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://bitbucket.org/kedro-ssh/kedro-viz-finished.git"
              required
            />
            <small>Enter the HTTPS URL - the DAG will convert it to SSH format</small>
          </div>

          <div className="form-group">
            <label htmlFor="branch">Branch:</label>
            <input
              type="text"
              id="branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="main"
            />
          </div>

                <div className="form-group">
            <label htmlFor="projectName">Project Name (optional):</label>
                  <input
              type="text"
                    id="projectName"
                    value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="kedro-project"
                  />
                </div>

                  <div className="form-group">
                    <label htmlFor="pipelineName">Pipeline Name:</label>
                    <input
              type="text"
                      id="pipelineName"
                      value={pipelineName}
                      onChange={(e) => setPipelineName(e.target.value)}
              placeholder="kedro-pipeline"
                      required
                    />
                  </div>

                  <div className="form-group">
            <label htmlFor="sshPrivateKey">SSH Private Key:</label>
            <textarea
              id="sshPrivateKey"
              value={sshPrivateKey}
              onChange={(e) => setSshPrivateKey(e.target.value)}
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----..."
              rows="8"
              required
            />
                  </div>

          <div className="form-group">
            <label htmlFor="sshPublicKey">SSH Public Key:</label>
            <textarea
              id="sshPublicKey"
              value={sshPublicKey}
              onChange={(e) => setSshPublicKey(e.target.value)}
              placeholder="ssh-rsa AAAAB3NzaC1yc2E..."
              rows="4"
              required
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Triggering Pipeline...' : 'Trigger Pipeline'}
          </button>
        </form>
        </div>
    </div>
  );
};

export default GitPage;

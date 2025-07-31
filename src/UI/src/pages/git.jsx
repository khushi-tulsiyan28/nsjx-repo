import React, { useState, useEffect } from 'react';
import './git.css';

const GitPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [projectName, setProjectName] = useState('');
  const [availableFolders, setAvailableFolders] = useState([]);
  const [selectedFolder, setSelectedFolder] = useState('');
  const [isKedroProject, setIsKedroProject] = useState(false);
  const [isPythonProject, setIsPythonProject] = useState(false);
  const [pipelineName, setPipelineName] = useState('');
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectLoading, setProjectLoading] = useState(false);

  const BITBUCKET_CLIENT_ID = process.env.REACT_APP_BITBUCKET_CLIENT_ID;
  const BITBUCKET_REDIRECT_URI = process.env.REACT_APP_BITBUCKET_REDIRECT_URI || 'http://localhost:3000/git';
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001/api';

  const handleBitbucketLogin = () => {
    const bitbucketAuthUrl = `https://bitbucket.org/site/oauth2/authorize?client_id=${BITBUCKET_CLIENT_ID}&redirect_uri=${BITBUCKET_REDIRECT_URI}&response_type=code&scope=repository`;
    window.location.href = bitbucketAuthUrl;
  };

  const handleBitbucketLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setRepositories([]);
    localStorage.removeItem('bitbucket_token');
  };

  const fetchUserData = async (token) => {
    try {
      setLoading(true);
      const response = await fetch('https://api.bitbucket.org/2.0/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
        await fetchRepositories(token);
      } else {
        throw new Error('Failed to fetch user data');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRepositories = async (token) => {
    try {
      const response = await fetch('https://api.bitbucket.org/2.0/repositories?role=owner&sort=-updated_on&pagelen=10', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setRepositories(data.values || []);
      }
    } catch (err) {
      console.error('Failed to fetch repositories:', err);
    }
  };

  
  const handleProjectNameChange = async (name) => {
    setProjectName(name);
    setSelectedFolder('');
    
    if (name.trim() && isAuthenticated && user) {
      try {
        setProjectLoading(true);
        
        const token = localStorage.getItem('bitbucket_token');
        console.log('Bitbucket authentication status:', { isAuthenticated, user: user?.username, hasToken: !!token });
        
        if (!token) {
          setError('Bitbucket token not found. Please re-authenticate.');
          return;
        }

        const response = await fetch(`https://api.bitbucket.org/2.0/repositories/${user.username}/${name}/src`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });

        if (response.ok) {
          const contents = await response.json();
          const folders = contents
            .filter(item => item.type === 'dir')
            .map(item => item.name);
          
          console.log('Fetched folders from Bitbucket:', folders);
          setAvailableFolders(folders);
        } else if (response.status === 404) {
          setError(`Repository "${name}" not found in your Bitbucket account`);
          setAvailableFolders([]);
        } else {
          throw new Error(`Failed to fetch repository contents: ${response.status}`);
        }
              } catch (err) {
          console.error('Error fetching repository folders:', err);
          setError('Failed to fetch project folders. Please check your repository name and try again.');
          
          const fallbackFolders = ['src', 'data', 'conf', 'airflow', 'notebooks', 'tests', 'docs'];
          setAvailableFolders(fallbackFolders);
          console.log('Using fallback folders:', fallbackFolders);
        } finally {
          setProjectLoading(false);
        }
    } else if (name.trim()) {
      if (!isAuthenticated) {
        setError('Please authenticate with Bitbucket first to fetch repository folders');
      } else {
        setError('Please enter a valid repository name from your Bitbucket account');
      }
      setAvailableFolders([]);
    } else {
      setAvailableFolders([]);
    }
  };

  const handleProjectTypeChange = (type, value) => {
    if (type === 'kedro') {
      setIsKedroProject(value);
      if (!value) {
        setPipelineName('');
      }
    } else if (type === 'python') {
      setIsPythonProject(value);
    }
  };

  const handleProjectSubmit = async (e) => {
    e.preventDefault();
    
    if (!projectName.trim()) {
      setError('Project name is required');
      return;
    }

    if (!selectedFolder) {
      setError('Please select a folder');
      return;
    }

    if (!isKedroProject && !isPythonProject) {
      setError('Please select at least one project type');
      return;
    }

    if (isKedroProject && !pipelineName.trim()) {
      setError('Pipeline name is required for Kedro projects');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (isKedroProject && pipelineName.trim()) {
        const guid = `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const experimentName = `kedro-pipeline-${pipelineName}`;
        
        const response = await fetch(`${API_BASE_URL}/pipelines/trigger`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'user-id': 'default-user'
          },
          body: JSON.stringify({
            pipelineName: pipelineName,
            repoUrl: `https://bitbucket.org/${user.username}/${projectName}.git`, 
            branch: 'main',
            projectName: projectName,
            experimentName: 'kedro-pipeline',
            sshKeyId: null 
          })
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Pipeline triggered successfully:', data);
          
          alert(`Pipeline "${pipelineName}" triggered successfully!\nGUID: ${data.data.guid}\nExperiment: ${data.data.experiment_name}`);
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to trigger pipeline');
        }
      }

      const projectConfig = {
        name: projectName,
        folder: selectedFolder,
        isKedro: isKedroProject,
        isPython: isPythonProject,
        pipelineName: isKedroProject ? pipelineName : null,
        guid: isKedroProject && pipelineName.trim() ? `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : null,
        experimentName: isKedroProject && pipelineName.trim() ? `kedro-pipeline-${pipelineName}` : null,
        createdAt: new Date().toISOString()
      };

      console.log('Project configuration:', projectConfig);
      
      setProjectName('');
      setSelectedFolder('');
      setIsKedroProject(false);
      setIsPythonProject(false);
      setPipelineName('');
      setShowProjectForm(false);
      setAvailableFolders([]);
      setError(null);
      
      if (!isKedroProject || !pipelineName.trim()) {
        alert('Project configuration saved successfully!');
      }
      
    } catch (err) {
      setError(err.message);
      console.error('Project submission error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      console.log('Bitbucket authorization code received:', code);
      exchangeCodeForToken(code);
    }

    const token = localStorage.getItem('bitbucket_token');
    if (token) {
      fetchUserData(token);
    }
  }, []);

  const exchangeCodeForToken = async (code) => {
    try {
      const response = await fetch(`${API_BASE_URL}/bitbucket/exchange-code`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: code,
          redirect_uri: BITBUCKET_REDIRECT_URI
        })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('bitbucket_token', data.access_token);
        await fetchUserData(data.access_token);
        
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      } else {
        console.error('Failed to exchange code for token');
        setError('Failed to complete Bitbucket authentication');
      }
    } catch (error) {
      console.error('Error exchanging code for token:', error);
      setError('Failed to complete Bitbucket authentication');
    }
  };

  if (loading) {
    return (
      <div className="git-container">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="git-container">
      <h1>Bitbucket Integration</h1>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {!isAuthenticated ? (
        <div className="auth-section">
          <h2>Connect to Bitbucket</h2>
          <p>Connect your Bitbucket account to access your repositories and manage your projects.</p>
          <button 
            className="github-login-btn"
            onClick={handleBitbucketLogin}
          >
            <svg className="github-icon" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            Sign in with Bitbucket
          </button>
        </div>
      ) : (
        <div className="user-section">
          <div className="user-info">
            <img 
              src={user?.avatar || 'https://bitbucket.org/static/images/default-avatar.png'} 
              alt="User avatar" 
              className="user-avatar"
            />
            <div className="user-details">
              <h2>Welcome, {user?.username || 'User'}!</h2>
              <button 
                className="logout-btn"
                onClick={handleBitbucketLogout}
              >
                Disconnect Bitbucket
              </button>
            </div>
          </div>

          <div className="repositories-section">
            <h3>Your Recent Repositories</h3>
            {repositories.length > 0 ? (
              <div className="repos-grid">
                {repositories.map(repo => (
                  <div key={repo.uuid} className="repo-card">
                    <h4>{repo.name}</h4>
                    <p>{repo.description || 'No description available'}</p>
                    <div className="repo-meta">
                      <span className="repo-language">{repo.language || 'Unknown'}</span>
                      <span className="repo-stars">⭐ {repo.stars_count}</span>
                    </div>
                    <a 
                      href={repo.links.html.href} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="repo-link"
                    >
                      View Repository
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <p>No repositories found.</p>
            )}
          </div>

          
          <div className="project-section">
            <div className="section-header">
              <h3>Project Configuration</h3>
              <button 
                className="btn-primary"
                onClick={() => setShowProjectForm(!showProjectForm)}
              >
                {showProjectForm ? 'Cancel' : 'Configure Project'}
              </button>
            </div>

            {showProjectForm && (
              <form onSubmit={handleProjectSubmit} className="project-form">
                <div className="form-group">
                  <label htmlFor="projectName">Project Name:</label>
                  <input
                    id="projectName"
                    type="text"
                    value={projectName}
                    onChange={(e) => handleProjectNameChange(e.target.value)}
                    placeholder="Enter project name"
                    required
                  />
                </div>

                {projectName && (
                  <div className="form-group">
                    <label htmlFor="selectedFolder">Select Folder:</label>
                    {projectLoading ? (
                      <div className="loading">Loading folders...</div>
                    ) : (
                      <select
                        id="selectedFolder"
                        value={selectedFolder}
                        onChange={(e) => setSelectedFolder(e.target.value)}
                        required
                      >
                        <option value="">Choose a folder</option>
                        {availableFolders.map(folder => (
                          <option key={folder} value={folder}>
                            {folder}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                <div className="project-type-section">
                  <h4>Project Type:</h4>
                  <div className="checkbox-group">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={isKedroProject}
                        onChange={(e) => handleProjectTypeChange('kedro', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      Kedro Project
                    </label>
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={isPythonProject}
                        onChange={(e) => handleProjectTypeChange('python', e.target.checked)}
                      />
                      <span className="checkmark"></span>
                      Python Project
                    </label>
                  </div>
                </div>

                {isKedroProject && (
                  <div className="form-group">
                    <label htmlFor="pipelineName">Pipeline Name:</label>
                    <input
                      id="pipelineName"
                      type="text"
                      value={pipelineName}
                      onChange={(e) => setPipelineName(e.target.value)}
                      placeholder="Enter pipeline name"
                      required
                    />
                  </div>
                )}

                <div className="form-actions">
                  <button type="submit" className="btn-primary">
                    Save Project Configuration
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default GitPage;

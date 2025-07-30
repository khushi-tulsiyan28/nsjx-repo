import React, { useState, useEffect } from 'react';
import './settings.css';

const SettingsPage = () => {
  const [settings, setSettings] = useState({
    theme: 'light',
    notifications: true,
    autoSave: true,
    language: 'en',
    fontSize: 'medium'
  });

  const [sshKeys, setSshKeys] = useState([]);
  const [showSshForm, setShowSshForm] = useState(false);
  const [sshForm, setSshForm] = useState({
    name: '',
    publicKey: '',
    privateKey: '',
    passphrase: '',
    provider: 'github',
    description: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

  const handleSettingChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const fetchSshKeys = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/ssh-keys`, {
        headers: {
          'Content-Type': 'application/json',
          'user-id': 'default-user'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSshKeys(data.data || []);
      } else {
        throw new Error('Failed to fetch SSH keys');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSshFormChange = (key, value) => {
    setSshForm(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSshSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/ssh-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'user-id': 'default-user'
        },
        body: JSON.stringify(sshForm)
      });

      if (response.ok) {
        const data = await response.json();
        setSshKeys(prev => [data.data, ...prev]);
        setSshForm({
          name: '',
          publicKey: '',
          privateKey: '',
          passphrase: '',
          provider: 'github',
          description: ''
        });
        setShowSshForm(false);
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create SSH key');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSshKey = async (id) => {
    if (!window.confirm('Are you sure you want to delete this SSH key?')) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/ssh-keys/${id}`, {
        method: 'DELETE',
        headers: {
          'user-id': 'default-user'
        }
      });

      if (response.ok) {
        setSshKeys(prev => prev.filter(key => key.id !== id));
      } else {
        throw new Error('Failed to delete SSH key');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSshKeys();
  }, []);

  return (
    <div className="settings-container">
      <h1>Settings</h1>
      
      <div className="settings-section">
        <h2>Appearance</h2>
        <div className="setting-item">
          <label>Theme:</label>
          <select 
            value={settings.theme} 
            onChange={(e) => handleSettingChange('theme', e.target.value)}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="auto">Auto</option>
          </select>
        </div>
        
        <div className="setting-item">
          <label>Font Size:</label>
          <select 
            value={settings.fontSize} 
            onChange={(e) => handleSettingChange('fontSize', e.target.value)}
          >
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
        </div>
      </div>

      <div className="settings-section">
        <h2>Preferences</h2>
        <div className="setting-item">
          <label>
            <input 
              type="checkbox" 
              checked={settings.notifications}
              onChange={(e) => handleSettingChange('notifications', e.target.checked)}
            />
            Enable Notifications
          </label>
        </div>
        
        <div className="setting-item">
          <label>
            <input 
              type="checkbox" 
              checked={settings.autoSave}
              onChange={(e) => handleSettingChange('autoSave', e.target.checked)}
            />
            Auto Save
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h2>Language</h2>
        <div className="setting-item">
          <label>Language:</label>
          <select 
            value={settings.language} 
            onChange={(e) => handleSettingChange('language', e.target.value)}
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
          </select>
        </div>
      </div>

      <div className="settings-actions">
        <button className="btn-primary">Save Settings</button>
        <button className="btn-secondary">Reset to Default</button>
      </div>

      <div className="settings-section">
        <div className="section-header">
          <h2>Git SSH Keys</h2>
          <button 
            className="btn-primary"
            onClick={() => setShowSshForm(!showSshForm)}
          >
            {showSshForm ? 'Cancel' : 'Add SSH Key'}
          </button>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {showSshForm && (
          <form onSubmit={handleSshSubmit} className="ssh-form">
            <div className="form-group">
              <label>Key Name:</label>
              <input
                type="text"
                value={sshForm.name}
                onChange={(e) => handleSshFormChange('name', e.target.value)}
                placeholder="e.g., My GitHub Key"
                required
              />
            </div>

            <div className="form-group">
              <label>Provider:</label>
              <select
                value={sshForm.provider}
                onChange={(e) => handleSshFormChange('provider', e.target.value)}
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
                <option value="bitbucket">Bitbucket</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Public Key:</label>
              <textarea
                value={sshForm.publicKey}
                onChange={(e) => handleSshFormChange('publicKey', e.target.value)}
                placeholder="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC..."
                required
                rows={4}
              />
            </div>

            <div className="form-group">
              <label>Private Key (Optional):</label>
              <textarea
                value={sshForm.privateKey}
                onChange={(e) => handleSshFormChange('privateKey', e.target.value)}
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----"
                rows={6}
              />
            </div>

            <div className="form-group">
              <label>Passphrase (Optional):</label>
              <input
                type="password"
                value={sshForm.passphrase}
                onChange={(e) => handleSshFormChange('passphrase', e.target.value)}
                placeholder="Enter passphrase if key is encrypted"
              />
            </div>

            <div className="form-group">
              <label>Description:</label>
              <textarea
                value={sshForm.description}
                onChange={(e) => handleSshFormChange('description', e.target.value)}
                placeholder="Optional description"
                rows={2}
              />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Save SSH Key'}
              </button>
            </div>
          </form>
        )}

        <div className="ssh-keys-list">
          {loading && sshKeys.length === 0 ? (
            <div className="loading">Loading SSH keys...</div>
          ) : sshKeys.length > 0 ? (
            sshKeys.map(key => (
              <div key={key.id} className="ssh-key-item">
                <div className="key-info">
                  <h4>{key.name}</h4>
                  <p className="key-provider">{key.provider}</p>
                  {key.description && <p className="key-description">{key.description}</p>}
                  <p className="key-date">Added: {new Date(key.createdAt).toLocaleDateString()}</p>
                </div>
                <div className="key-actions">
                  <button 
                    className="btn-danger"
                    onClick={() => handleDeleteSshKey(key.id)}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          ) : (
            <p className="no-keys">No SSH keys added yet.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;

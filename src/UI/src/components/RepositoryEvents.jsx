import React, { useState, useEffect, useRef } from 'react';
import './RepositoryEvents.css';

const RepositoryEvents = () => {
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const wsRef = useRef(null);

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://localhost:3001';
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('Connected');
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'connection') {
            console.log('WebSocket connection message:', data.message);
          } else if (data.type === 'repository_event') {
            console.log('Received repository event:', data.data);
            setEvents(prevEvents => [data.data, ...prevEvents.slice(0, 49)]); // Keep last 50 events
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('Disconnected');
        
        setTimeout(() => {
          if (!isConnected) {
            connectWebSocket();
          }
        }, 5000);
      };

      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionStatus('Error');
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('Failed to connect');
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'cloned_successfully':
      case 'local_project':
        return 'success';
      case 'clone_failed':
      case 'setup_failed':
        return 'error';
      default:
        return 'info';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'cloned_successfully':
      case 'local_project':
        return '✅';
      case 'clone_failed':
      case 'setup_failed':
        return '❌';
      default:
        return 'ℹ️';
    }
  };

  const clearEvents = () => {
    setEvents([]);
  };

  return (
    <div className="repository-events">
      <div className="events-header">
        <h3>Repository Events</h3>
        <div className="connection-status">
          <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? '🟢' : '🔴'}
          </span>
          <span className="status-text">{connectionStatus}</span>
        </div>
        <button onClick={clearEvents} className="clear-btn">
          Clear Events
        </button>
      </div>

      <div className="events-container">
        {events.length === 0 ? (
          <div className="no-events">
            <p>No repository events yet...</p>
            <p>Events will appear here in real-time when repositories are cloned or set up.</p>
          </div>
        ) : (
          events.map((event, index) => (
            <div key={`${event.guid}-${index}`} className={`event-card ${getStatusColor(event.repo_status)}`}>
              <div className="event-header">
                <span className="event-icon">{getStatusIcon(event.repo_status)}</span>
                <span className="event-title">
                  {event.repo_status === 'cloned_successfully' ? 'Repository Cloned Successfully' :
                   event.repo_status === 'local_project' ? 'Local Project Validated' :
                   'Repository Operation'}
                </span>
                <span className="event-time">{formatTimestamp(event.timestamp)}</span>
              </div>
              
              <div className="event-details">
                <div className="detail-row">
                  <span className="detail-label">GUID:</span>
                  <span className="detail-value">{event.guid}</span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Pipeline:</span>
                  <span className="detail-value">{event.pipeline_name}</span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Repository:</span>
                  <span className="detail-value">
                    {event.repo_url === 'local' ? 'Local Project' : event.repo_url}
                  </span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Branch:</span>
                  <span className="detail-value">
                    {event.branch === 'local' ? 'Local' : event.branch}
                  </span>
                </div>
                
                <div className="detail-row">
                  <span className="detail-label">Status:</span>
                  <span className={`detail-value status-${getStatusColor(event.repo_status)}`}>
                    {event.repo_status}
                  </span>
                </div>
                
                {event.validation_info && event.validation_info.commit_hash && (
                  <div className="detail-row">
                    <span className="detail-label">Commit:</span>
                    <span className="detail-value">
                      {event.validation_info.commit_hash.substring(0, 8)} - {event.validation_info.commit_message}
                    </span>
                  </div>
                )}
                
                {event.project_path && (
                  <div className="detail-row">
                    <span className="detail-label">Path:</span>
                    <span className="detail-value path-value">{event.project_path}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RepositoryEvents; 
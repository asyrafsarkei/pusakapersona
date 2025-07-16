
import React from 'react';
import '../FloatingPanel.css'; // Custom CSS for the floating panel

interface FloatingPanelProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
}

const FloatingPanel: React.FC<FloatingPanelProps> = ({ children, onClose, title }) => {
  return (
    <div className="floating-panel-overlay">
      <div className="floating-panel-content">
        <div className="floating-panel-header">
          <h3>{title}</h3>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        <div className="floating-panel-body">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FloatingPanel;

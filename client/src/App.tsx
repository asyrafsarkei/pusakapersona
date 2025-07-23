
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import Menu from './Menu';
import Home from './pages/Home';
import Order from './pages/Order';
import Inventory from './pages/Inventory';
import Invoice from './pages/Invoice';
import User from './pages/User';

// Configure axios to send cookies with requests
axios.defaults.withCredentials = true;

function App() {
  const [isSideMenu, setIsSideMenu] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isFadingIn, setIsFadingIn] = useState(false);

  const checkAuth = useCallback(async (isLogin = false) => {
    console.log('Checking authentication status...');
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/current_user`);
      console.log('Current user response:', response.data);
      const authenticated = response.status === 200 && response.data.user;
      setIsAuthenticated(authenticated);
      if (authenticated) {
        setUsername(response.data.user.username);
        if (isLogin) {
          setIsFadingIn(true);
          setTimeout(() => setIsFadingIn(false), 1000); // Duration of the animation
        }
      } else {
        setUsername(null);
      }
    } catch (error) {
      console.error('Error checking authentication:', error);
      setIsAuthenticated(false);
      setUsername(null);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Check for Google auth success/failure in URL parameters
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth_success') === 'true') {
      alert('Google authentication successful!');
      window.history.replaceState({}, document.title, "/"); // Clean up URL
      checkAuth(); // Re-check auth after Google auth success
    } else if (params.get('auth_failure') === 'true') {
      alert('Google authentication failed.');
      window.history.replaceState({}, document.title, "/"); // Clean up URL
    }
  }, [checkAuth]);

  console.log('App isAuthenticated state:', isAuthenticated);

  if (isAuthenticated === null) {
    return <div>Loading...</div>; // Or a spinner
  }

  return (
    <Router>
      <div className="app-wrapper">
        {isAuthenticated && <Menu onToggleMenuPosition={setIsSideMenu} username={username} />}
        <div className={`main-content-area ${isSideMenu ? 'shifted' : ''} ${isFadingIn ? 'fade-in' : ''}`}>
          <Routes>
            {isAuthenticated ? (
              <>
                <Route path="/" element={<Home />} />
                <Route path="/order" element={<Order />} />
                <Route path="/invoice" element={<Invoice />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/user" element={<User onLoginSuccess={checkAuth} />} /> {/* Allow authenticated users to access /user */}
                <Route path="*" element={<Navigate to="/" replace />} /> {/* Any other path redirects to home if authenticated */}
              </>
            ) : (
              <>
                <Route path="/user" element={<User onLoginSuccess={checkAuth} />} />
                <Route path="*" element={<Navigate to="/user" replace />} /> {/* Unauthenticated users redirected to /user */}
              </>
            )}
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;

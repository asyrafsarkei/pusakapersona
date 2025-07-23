import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

interface UserItem {
  id: number;
  username: string;
  email: string;
  password?: string; // Password is optional for display/edit, but required for creation
  googleId?: string; // New field for Google ID
  isApproved?: number; // New field for approval status
  isAdmin?: number; // New field for admin status
  timestamp: string;
}

interface UserProps {
  onLoginSuccess: () => void;
}

function User({ onLoginSuccess }: UserProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [formData, setFormData] = useState<UserItem>({
    id: 0,
    username: '',
    email: '',
    password: '',
    timestamp: '',
  });
  const [isLogin, setIsLogin] = useState(true); // Toggle between login and register
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentUser, setCurrentUser] = useState<UserItem | null>(null); // To store current logged-in user
  const [manualRegisterKey, setManualRegisterKey] = useState(''); // State for manual registration key
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [addUserFormData, setAddUserFormData] = useState({
    username: '',
    email: '',
    password: '',
  });
  const navigate = useNavigate();

  useEffect(() => {
    checkAuthAndFetchUsers();
  }, []);

  const checkAuthAndFetchUsers = async () => {
    console.log('User.tsx: Checking authentication status...');
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/current_user`);
      console.log('User.tsx: Current user response:', response.data);
      const authenticated = response.status === 200 && response.data.user;
      setIsAuthenticated(authenticated);
      if (authenticated) {
        setCurrentUser(response.data.user);
        fetchUsers(); // Only fetch users if authenticated
      } else {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('User.tsx: Error checking authentication:', error);
      setIsAuthenticated(false);
      setCurrentUser(null);
    }
  };

  const fetchUsers = async () => {
    console.log('User.tsx: Fetching users...');
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/users`);
      console.log('User.tsx: Users fetched:', response.data);
      setUsers(response.data.data);
    } catch (error) {
      console.error('User.tsx: Error fetching users:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddUserFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAddUserFormData({ ...addUserFormData, [e.target.name]: e.target.value });
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      alert('Email and Password are required.');
      return;
    }

    console.log('User.tsx: Submitting auth form. isLogin:', isLogin, 'data:', formData);

    try {
      if (isLogin) {
        // Login
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/login`, { email: formData.email, password: formData.password });
        console.log('User.tsx: Login response:', response.data);
        setIsAuthenticated(true); // Update local state immediately
        setCurrentUser(response.data.user); // Set current user
        onLoginSuccess(); // Call onLoginSuccess after successful login
        navigate('/'); // Redirect to home page after successful login
      } else {
        // Register
        const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/register`, { username: formData.username, email: formData.email, password: formData.password, manualRegisterKey });
        console.log('User.tsx: Register response:', response.data);
        alert(response.data.message);
        setIsLogin(true); // Switch to login after successful registration
      }
      setFormData({
        id: 0,
        username: '',
        email: '',
        password: '',
        timestamp: '',
      });
      setManualRegisterKey(''); // Clear the key
    } catch (error: any) {
      console.error('User.tsx: Authentication error:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'An error occurred during authentication.');
    }
  };

  const handleGoogleSignIn = () => {
    console.log('User.tsx: Initiating Google Sign-in');
    // Redirect to Google auth, App.tsx will handle the callback and call onLoginSuccess
    window.location.href = `${import.meta.env.VITE_API_URL}/auth/google`;
  };

  const handleEdit = (user: UserItem) => {
    setFormData(user);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`${import.meta.env.VITE_API_URL}/api/users/${id}`);
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleApprove = async (id: number) => {
    try {
      await axios.put(`${import.meta.env.VITE_API_URL}/api/users/${id}/approve`);
      alert('User approved successfully!');
      fetchUsers();
    } catch (error) {
      console.error('Error approving user:', error);
      alert('Error approving user.');
    }
  };

  const handleLogout = async () => {
    console.log('User.tsx: Logging out...');
    try {
      await axios.get(`${import.meta.env.VITE_API_URL}/api/logout`);
      alert('Logged out successfully!');
      setIsAuthenticated(false);
      setCurrentUser(null);
      setUsers([]); // Clear user list on logout
      onLoginSuccess(); // Re-check auth status after logout
      navigate('/user'); // Redirect to user page after logout
    } catch (error) {
      console.error('User.tsx: Error logging out:', error);
      alert('Error logging out.');
    }
  };

  const handleAdminRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUserFormData.username || !addUserFormData.email || !addUserFormData.password) {
      alert('Username, Email, and Password are required.');
      return;
    }

    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/admin/register`, addUserFormData);
      alert(response.data.message);
      setShowAddUserForm(false);
      fetchUsers();
      setAddUserFormData({
        username: '',
        email: '',
        password: '',
      });
    } catch (error: any) {
      console.error('Admin registration error:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'An error occurred during registration.');
    }
  };

  return (
    <div className="content-container">
      <h1 className="mb-4 text-center">Welcome to Pusaka Persona</h1>

      {!isAuthenticated && (
        <div className="card mb-4">
          <div className="card-header">
            <ul className="nav nav-tabs card-header-tabs">
              <li className="nav-item">
                <button className={`nav-link ${isLogin ? 'active' : ''}`} onClick={() => setIsLogin(true)}>Login</button>
              </li>
              <li className="nav-item">
                <button className={`nav-link ${!isLogin ? 'active' : ''}`} onClick={() => setIsLogin(false)}>Register</button>
              </li>
            </ul>
          </div>
          <div className="card-body">
            <form onSubmit={handleAuthSubmit}>
              {!isLogin && (
                <div className="mb-3">
                  <label htmlFor="username" className="form-label">Username</label>
                  <input type="text" className="form-control" id="username" name="username" value={formData.username} onChange={handleChange} required={!isLogin} />
                </div>
              )}
              <div className="mb-3">
                <label htmlFor="email" className="form-label">Email</label>
                <input type="email" className="form-control" id="email" name="email" value={formData.email} onChange={handleChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="password" className="form-label">Password</label>
                <input type="password" className="form-control" id="password" name="password" value={formData.password} onChange={handleChange} required />
              </div>
              {!isLogin && (
                <div className="mb-3">
                  <label htmlFor="manualRegisterKey" className="form-label">Manual Registration Key</label>
                  <input type="text" className="form-control" id="manualRegisterKey" name="manualRegisterKey" value={manualRegisterKey} onChange={(e) => setManualRegisterKey(e.target.value)} required={!isLogin} />
                  <div className="form-text">Only for specific users.</div>
                </div>
              )}
              <button type="submit" className="btn btn-primary">{isLogin ? 'Login' : 'Register'}</button>
              <hr />
              <button type="button" className="btn btn-danger w-100" onClick={handleGoogleSignIn}>
                Sign {isLogin ? 'in' : 'up'} with Google
              </button>
            </form>
          </div>
        </div>
      )}

      {isAuthenticated && (
        <button className="btn btn-warning w-100 mb-4" onClick={handleLogout}>Logout</button>
      )}

      {isAuthenticated && currentUser?.isAdmin && (
        <div className="d-flex justify-content-end mb-4">
          <button className="btn btn-primary" onClick={() => setShowAddUserForm(!showAddUserForm)}>
            {showAddUserForm ? 'Cancel' : 'Add New User'}
          </button>
        </div>
      )}

      {showAddUserForm && (
        <div className="card mb-4">
          <div className="card-header">Add New User</div>
          <div className="card-body">
            <form onSubmit={handleAdminRegister}>
              <div className="mb-3">
                <label htmlFor="username" className="form-label">Username</label>
                <input type="text" className="form-control" id="username" name="username" value={addUserFormData.username} onChange={handleAddUserFormChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="email" className="form-label">Email</label>
                <input type="email" className="form-control" id="email" name="email" value={addUserFormData.email} onChange={handleAddUserFormChange} required />
              </div>
              <div className="mb-3">
                <label htmlFor="password" className="form-label">Password</label>
                <input type="password" className="form-control" id="password" name="password" value={addUserFormData.password} onChange={handleAddUserFormChange} required />
              </div>
              <button type="submit" className="btn btn-primary">Register User</button>
            </form>
          </div>
        </div>
      )}

      {isAuthenticated && currentUser?.isAdmin && users.length > 0 && (
        <h2 className="mt-5 mb-3 text-center">Current Users</h2>
      )}
      
      {isAuthenticated && currentUser?.isAdmin && (
        <div className="user-list">
          {users.map((user, index) => (
            <div key={user.id} className="card message-card mb-3">
              <div className="card-body">
                <h5 className="card-title">#{index + 1} - {user.username}</h5>
                <p className="card-text"><strong>Email:</strong> {user.email}</p>
                <p className="card-text"><strong>Google ID:</strong> {user.googleId || 'N/A'}</p>
                <p className="card-text"><strong>Approved:</strong> {user.isApproved ? 'Yes' : 'No'}</p>
                <p className="card-text"><strong>Admin:</strong> {user.isAdmin ? 'Yes' : 'No'}</p>
                <small className="text-muted">Created: {new Date(user.timestamp).toLocaleString()}</small>
                <div className="d-flex justify-content-end mt-2">
                  {!user.isApproved && currentUser?.isAdmin && (
                    <button className="btn btn-sm btn-success me-2" onClick={() => handleApprove(user.id)}>Approve</button>
                  )}
                  {(currentUser?.isAdmin || user.id === currentUser?.id) && (
                    <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleEdit(user)}>Edit</button>
                  )}
                  {currentUser?.isAdmin && (
                    <button className="btn btn-sm btn-outline-secondary delete-btn" onClick={() => handleDelete(user.id)}>Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default User;
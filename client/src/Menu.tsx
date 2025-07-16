import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars, faArrowRight } from '@fortawesome/free-solid-svg-icons'; // Changed faArrowLeft to faArrowRight
import './Menu.css'; // Custom CSS for the menu

interface MenuProps {
  onToggleMenuPosition: (isSideMenu: boolean) => void;
  username: string | null;
}

function Menu({ onToggleMenuPosition, username }: MenuProps) {
  const [isSideMenu, setIsSideMenu] = useState(false);

  const toggleMenuPosition = () => {
    const newIsSideMenu = !isSideMenu;
    setIsSideMenu(newIsSideMenu);
    onToggleMenuPosition(newIsSideMenu);
  };

  return (
    <div className={`menu-container ${isSideMenu ? 'side-menu' : 'top-menu'}`}>
      <button className="btn btn-secondary toggle-btn" onClick={toggleMenuPosition}>
        <FontAwesomeIcon icon={isSideMenu ? faArrowRight : faBars} /> {/* Changed icon here */}
      </button>
      {isSideMenu && username && <span className="welcome-message-side">Welcome, {username}!</span>} {/* Conditional rendering for side menu */}
      <nav>
        <ul className="menu-list">
          <li><Link to="/">Home</Link></li>
          <li><Link to="/order">Order</Link></li>
          <li><Link to="/invoice">Invoice</Link></li>
          <li><Link to="/inventory">Inventory</Link></li>
          <li><Link to="/user">User</Link></li>
        </ul>
      </nav>
      {!isSideMenu && username && <span className="welcome-message-top">Welcome, {username}!</span>} {/* Conditional rendering for top menu */}
    </div>
  );
}

export default Menu;
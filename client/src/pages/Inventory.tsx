
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FloatingPanel from '../components/FloatingPanel'; // Import the FloatingPanel component

interface InventoryItem {
  id: number;
  item_name: string;
  quantity: number;
  price: number | ''; // Allow empty string for placeholder
  description: string;
  timestamp: string;
  created_by_username?: string; // New field
  last_modified_by_username?: string; // New field
  last_modified_timestamp?: string; // New field
}

function Inventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [formData, setFormData] = useState<InventoryItem>({
    id: 0,
    item_name: '',
    quantity: 0,
    price: '',
    description: '',
    timestamp: '',
  });
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [showForm, setShowForm] = useState(false); // State for form visibility
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/inventory');
      setInventory(response.data.data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'quantity' || name === 'price' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.item_name || !formData.quantity || !formData.price) {
      alert('Item Name, Quantity, and Price are required.');
      return;
    }

    console.log('Submitting inventory item with data:', formData); // Debugging log

    try {
      if (editingItem) {
        await axios.put(`http://localhost:3001/api/inventory/${editingItem.id}`, formData);
      } else {
        await axios.post('http://localhost:3001/api/inventory', formData);
      }
      setFormData({
        id: 0,
        item_name: '',
        quantity: 0,
        price: '',
        description: '',
        timestamp: '',
      });
      setEditingItem(null);
      setShowForm(false); // Hide form after submission
      fetchInventory();
    } catch (error) {
      console.error('Error submitting inventory item:', error); // Debugging log
    }
  };

  const handleEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData(item);
    setShowForm(true); // Show form when editing
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`http://localhost:3001/api/inventory/${id}`);
      fetchInventory();
    } catch (error) {
      console.error('Error deleting inventory item:', error);
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingItem(null);
    setFormData({
      id: 0,
      item_name: '',
      quantity: 0,
      price: '',
      description: '',
      timestamp: '',
    });
  };

  const filteredInventory = inventory.filter(item =>
    item.item_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="content-container">
      <h1 className="mb-4 text-center">Inventory Management</h1>
      <div className="row mb-4 gx-3 align-items-center">
        <div className="col-md-6">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Item Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="col-md-6 text-end">
          <button className="btn btn-add-new" onClick={() => setShowForm(true)}>
            Add New Item
          </button>
        </div>
      </div>

      {showForm && (
        <FloatingPanel title={editingItem ? 'Edit Item' : 'Add New Item'} onClose={handleCloseForm}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="item_name" className="form-label">Item Name</label>
              <input type="text" className="form-control" id="item_name" name="item_name" value={formData.item_name} onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <label htmlFor="quantity" className="form-label">Quantity</label>
              <input type="number" className="form-control" id="quantity" name="quantity" value={formData.quantity} onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <label htmlFor="price" className="form-label">Price</label>
              <input type="number" step="0.01" className="form-control" id="price" name="price" value={formData.price} onChange={handleChange} placeholder="e.g., 10.00" required />
            </div>
            <div className="mb-3">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea className="form-control" id="description" name="description" value={formData.description} onChange={handleChange}></textarea>
            </div>
            <button type="submit" className="btn btn-primary">{editingItem ? 'Update Item' : 'Add Item'}</button>
            {editingItem && <button type="button" className="btn btn-secondary ms-2" onClick={handleCloseForm}>Cancel</button>}
          </form>
        </FloatingPanel>
      )}

      <div className="inventory-list">
        {filteredInventory.length === 0 ? (
          <p className="text-center">No inventory items found.</p>
        ) : (
          <div className="row">
            {filteredInventory.map((item) => (
              <div key={item.id} className="col-md-6 mb-4">
                <div className="card h-100">
                  <div className="card-body d-flex flex-column">
                    <h5 className="card-title">{item.item_name}</h5>
                    <p className="card-text"><strong>Quantity:</strong> {item.quantity}</p>
                    <p className="card-text"><strong>Price:</strong> RM{typeof item.price === 'number' ? item.price.toFixed(2) : item.price}</p>
                    {item.description && <p className="card-text"><strong>Description:</strong> {item.description}</p>}
                    <small className="text-muted">Last Modified: {item.last_modified_timestamp ? new Date(item.last_modified_timestamp).toLocaleString() : 'N/A'}</small>
                    {item.last_modified_by_username && <small className="text-muted ms-2">by: {item.last_modified_by_username}</small>}
                    <div className="mt-auto d-flex justify-content-end">
                      <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleEdit(item)}>Edit</button>
                      <button className="btn btn-sm btn-outline-secondary delete-btn" onClick={() => handleDelete(item.id)}>Delete</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default Inventory;

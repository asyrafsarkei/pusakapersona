import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FloatingPanel from '../components/FloatingPanel';

interface OrderItem {
  id: number;
  title: string;
  description: string;
  date_event: string;
  location: string;
  customer_name: string;
  phone_number: string;
  timestamp: string;
  items: { item_id: number; quantity: number; item_name: string; price: number }[];
  created_by_username?: string;
  last_modified_by_username?: string;
  last_modified_timestamp?: string;
  hasInvoice?: boolean;
  isInvoiceFullyPaid?: boolean;
}

interface InventoryItem {
  id: number;
  item_name: string;
  quantity: number;
  price: number;
  consume_flag: number; // Add consume_flag to InventoryItem interface
}

function Order() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [formData, setFormData] = useState<Omit<OrderItem, 'id' | 'timestamp' | 'items' & { items: { item_id: number; quantity: number }[] }>>({
    title: '',
    description: '',
    date_event: '',
    location: '',
    customer_name: '',
    phone_number: '',
    items: [],
  });
  const [editingOrder, setEditingOrder] = useState<OrderItem | null>(null);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchOrders();
    fetchInventoryItems();
  }, []);

  const fetchOrders = async () => {
    try {
      const ordersResponse = await axios.get(`${import.meta.env.VITE_API_URL}/api/orders`);
      const ordersData = ordersResponse.data.data;

      const invoicesResponse = await axios.get(`${import.meta.env.VITE_API_URL}/api/invoices`);
      const invoicesData = invoicesResponse.data.data;

      const ordersWithInvoiceStatus = ordersData.map((order: OrderItem) => {
        const associatedInvoice = invoicesData.find((invoice: any) => invoice.order_id === order.id);
        return {
          ...order,
          hasInvoice: !!associatedInvoice,
          isInvoiceFullyPaid: associatedInvoice ? !!associatedInvoice.is_paid_100_percent : false,
        };
      });

      ordersWithInvoiceStatus.sort((a: any, b: any) => {
        if (a.isInvoiceFullyPaid !== b.isInvoiceFullyPaid) {
          return a.isInvoiceFullyPaid ? 1 : -1;
        }
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });

      setOrders(ordersWithInvoiceStatus);
    } catch (error) {
      console.error('Error fetching orders or invoices:', error);
    }
  };

  const fetchInventoryItems = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/inventory`);
      setInventoryItems(response.data.data);
    } catch (error) {
      console.error('Error fetching inventory items:', error);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddItemToOrder = () => {
    if (selectedInventoryItem && selectedQuantity > 0) {
      const itemToAdd = inventoryItems.find(item => item.id === parseInt(selectedInventoryItem));
      if (itemToAdd) {
        const existingItemIndex = formData.items.findIndex(item => item.item_id === itemToAdd.id);
        if (existingItemIndex > -1) {
          const updatedItems = [...formData.items];
          updatedItems[existingItemIndex].quantity += selectedQuantity;
          setFormData({ ...formData, items: updatedItems });
        } else {
          setFormData({ ...formData, items: [...formData.items, { item_id: itemToAdd.id, quantity: selectedQuantity, item_name: itemToAdd.item_name, price: itemToAdd.price }] });
        }
        setSelectedInventoryItem('');
        setSelectedQuantity(1);
      }
    }
  };

  const handleRemoveItemFromOrder = (itemId: number) => {
    setFormData({ ...formData, items: formData.items.filter(item => item.item_id !== itemId) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.customer_name || !formData.phone_number) {
      alert('Title, Customer Name, and Phone Number are required.');
      return;
    }

    try {
      if (editingOrder) {
        await axios.put(`${import.meta.env.VITE_API_URL}/api/orders/${editingOrder.id}`, formData);
      } else {
        await axios.post(`${import.meta.env.VITE_API_URL}/api/orders`, formData);
      }
      setFormData({
        title: '',
        description: '',
        date_event: '',
        location: '',
        customer_name: '',
        phone_number: '',
        items: [],
      });
      setEditingOrder(null);
      setShowForm(false);
      fetchOrders();
    } catch (error) {
      console.error('Error submitting order:', error);
    }
  };

  const handleEdit = (order: OrderItem) => {
    setEditingOrder(order);
    setFormData({ ...order, items: order.items.map(item => ({ item_id: item.item_id, quantity: item.quantity, item_name: item.item_name, price: item.price })) });
    setShowForm(true);
  };

  const handleDelete = async (id: number) => {
    const orderToDelete = orders.find(order => order.id === id);
    if (orderToDelete && orderToDelete.hasInvoice) {
      alert('This order cannot be deleted because it has an associated invoice. Please delete the invoice first.');
      return;
    }

    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        await axios.delete(`${import.meta.env.VITE_API_URL}/api/orders/${id}`);
        fetchOrders(); // Refresh the orders list
      } catch (error) {
        console.error('Error deleting order:', error);
        alert('An error occurred while deleting the order.');
      }
    }
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingOrder(null);
    setFormData({
      title: '',
      description: '',
      date_event: '',
      location: '',
      customer_name: '',
      phone_number: '',
      items: [],
    });
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState('');

  const handleReset = () => {
    setSearchTerm('');
    setSelectedDate('');
  };

  const filteredOrders = orders.filter(order => {
    const customerMatch = order.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const dateMatch = selectedDate ? new Date(order.timestamp).toLocaleDateString() === new Date(selectedDate).toLocaleDateString() : true;
    return customerMatch && dateMatch;
  });

  return (
    <div className="content-container">
      <h1 className="mb-4 text-center">Order Management</h1>
      <div className="d-flex justify-content-between mb-4">
        <input
          type="text"
          className="form-control me-2"
          placeholder="Search by customer name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: '300px' }}
        />
        <div className="d-flex align-items-center">
          <label htmlFor="date-filter" className="me-2">Order Date</label>
          <input
            id="date-filter"
            type="date"
            className="form-control"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ maxWidth: '200px' }}
          />
        </div>
        <button className="btn btn-secondary me-2" onClick={handleReset}>Reset</button>
        <button className="btn btn-add-new" onClick={() => setShowForm(true)}>
          Add New Order
        </button>
      </div>

      {showForm && (
        <FloatingPanel title={editingOrder ? 'Edit Order' : 'Add New Order'} onClose={handleCloseForm}>
          <form onSubmit={handleSubmit}>
            <div className="mb-3">
              <label htmlFor="title" className="form-label">Title</label>
              <input type="text" className="form-control" id="title" name="title" value={formData.title} onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <label htmlFor="description" className="form-label">Description</label>
              <textarea className="form-control" id="description" name="description" value={formData.description} onChange={handleChange}></textarea>
            </div>
            <div className="mb-3">
              <label htmlFor="date_event" className="form-label">Date Event</label>
              <input type="date" className="form-control" id="date_event" name="date_event" value={formData.date_event} onChange={handleChange} />
            </div>
            <div className="mb-3">
              <label htmlFor="location" className="form-label">Location</label>
              <input type="text" className="form-control" id="location" name="location" value={formData.location} onChange={handleChange} />
            </div>
            <div className="mb-3">
              <label htmlFor="customer_name" className="form-label">Customer Name</label>
              <input type="text" className="form-control" id="customer_name" name="customer_name" value={formData.customer_name} onChange={handleChange} required />
            </div>
            <div className="mb-3">
              <label htmlFor="phone_number" className="form-label">Phone Number</label>
              <input type="text" className="form-control" id="phone_number" name="phone_number" value={formData.phone_number} onChange={handleChange} required />
            </div>

            <div className="mb-3">
              <label className="form-label">Add Items to Order</label>
              <div className="input-group">
                <select className="form-select" value={selectedInventoryItem} onChange={(e) => setSelectedInventoryItem(e.target.value)}>
                  <option value="">Select an item</option>
                  {inventoryItems.map(item => (
                    <option key={item.id} value={item.id}>{item.item_name} (RM{item.price.toFixed(2)}) {item.consume_flag === 1 ? '(Consumable)' : '(Non-Consumable)'}</option>
                  ))}
                </select>
                <input type="number" className="form-control" value={selectedQuantity} onChange={(e) => setSelectedQuantity(parseInt(e.target.value))} min="1" />
                <button type="button" className="btn btn-secondary" onClick={handleAddItemToOrder}>Add Item</button>
              </div>
            </div>

            {formData.items.length > 0 && (
              <div className="mb-3">
                <h6>Items in this Order:</h6>
                <ul className="list-group">
                  {formData.items.map((item, idx) => (
                    <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                      {item.item_name} x {item.quantity} (RM{(item.price * item.quantity).toFixed(2)})
                      <button type="button" className="btn btn-sm btn-danger" onClick={() => handleRemoveItemFromOrder(item.item_id)}>Remove</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button type="submit" className="btn btn-primary">{editingOrder ? 'Update Order' : 'Add Order'}</button>
            {editingOrder && <button type="button" className="btn btn-secondary ms-2" onClick={handleCloseForm}>Cancel</button>}
          </form>
        </FloatingPanel>
      )}

      <div className="order-list">
        {filteredOrders.length === 0 ? (
          <p className="text-center">No orders found.</p>
        ) : (
          <div className="row">
            {filteredOrders.map((order, index) => (
              <div key={order.id} className="col-md-6 mb-4">
                <div className="card h-100">
                  <div className="card-body d-flex flex-column">
                    <h5 className="card-title">#{index + 1} - {order.title}</h5>
                    <p className="card-text"><strong>Customer:</strong> {order.customer_name} ({order.phone_number})</p>
                    {order.description && <p className="card-text"><strong>Description:</strong> {order.description}</p>}
                    {order.date_event && <p className="card-text"><strong>Date:</strong> {order.date_event}</p>}
                    {order.location && <p className="card-text"><strong>Location:</strong> {order.location}</p>}
                    {order.items && order.items.length > 0 && (
                      <div className="mt-3">
                        <h6>Ordered Items:</h6>
                        <ul className="list-group list-group-flush">
                          {order.items.map((item, itemIdx) => (
                            <li key={itemIdx} className="list-group-item">
                              {item.item_name} x {item.quantity} (RM{(item.price * item.quantity).toFixed(2)})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <small className="text-muted">Last Modified: {order.last_modified_timestamp ? new Date(order.last_modified_timestamp).toLocaleString() : 'N/A'}</small>
                    {order.last_modified_by_username && <small className="text-muted ms-2">by: {order.last_modified_by_username}</small>}
                    <div className="d-flex justify-content-end mt-2">
                      <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleEdit(order)} disabled={order.isInvoiceFullyPaid}>Edit</button>
                      <button className="btn btn-sm btn-outline-secondary delete-btn" onClick={() => handleDelete(order.id)} disabled={order.isInvoiceFullyPaid}>Delete</button>
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

export default Order;

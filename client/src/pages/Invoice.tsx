import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTrashAlt, faPlus, faEye } from '@fortawesome/free-solid-svg-icons';
import FloatingPanel from '../components/FloatingPanel';

interface OrderItem {
  item_id: number;
  quantity: number;
  item_name: string;
  price: number;
}

interface Order {
  id: number;
  title: string;
  description: string;
  date_event: string;
  location: string;
  customer_name: string;
  phone_number: string;
  items: OrderItem[];
  created_by_username: string;
  last_modified_by_username: string;
  timestamp: string;
}

interface InvoiceItem {
  id: number;
  order_id: number;
  invoice_number: string;
  date_invoice: string;
  order_title: string;
  customer_name: string;
  phone_number: string;
  location: string;
  payment_method: string;
  deposit_amount: number;
  upfront_payment: number;
  delivery_charge: number;
  total_amount: number;
  balance_due: number;
  is_paid_100_percent: number;
  created_by_username: string;
  last_modified_by_username: string;
  timestamp: string;
  last_modified_timestamp?: string; // Added missing property
  items?: OrderItem[]; // For detailed view
}

function Invoice() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isViewing, setIsViewing] = useState(false);
  const [currentInvoice, setCurrentInvoice] = useState<InvoiceItem | null>(null);
  const [formData, setFormData] = useState<any>({
    order_id: '',
    invoice_number: '',
    date_invoice: '',
    payment_method: '',
    deposit_amount: '',
    upfront_payment: '',
    delivery_charge: '',
  });
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [orderCustomerName, setOrderCustomerName] = useState<string>('');
  const [orderPhoneNumber, setOrderPhoneNumber] = useState<string>('');
  const [orderLocation, setOrderLocation] = useState<string>('');
  const [orderTitle, setOrderTitle] = useState<string>('');
  const [orderTotalItemsPrice, setOrderTotalItemsPrice] = useState<number>(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Helper function for formatting currency
  const formatCurrency = (value: number | string | undefined | null) => {
    if (value === undefined || value === null || value === '') {
      return '';
    }
    const num = parseFloat(value.toString());
    if (isNaN(num)) {
      return '';
    }
    return `RM ${num.toFixed(2)}`;
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const fetchData = async () => {
    try {
      const invoicesResponse = await axios.get('http://localhost:3001/api/invoices');
      const invoicesData = invoicesResponse.data.data || [];
      console.log('Fetched invoices data:', invoicesData);
      setInvoices(invoicesData);

      const ordersResponse = await axios.get('http://localhost:3001/api/orders');
      const allOrders = ordersResponse.data.data;

      const ordersWithInvoices = new Set(invoicesData.map((invoice: InvoiceItem) => invoice.order_id));
      const availableOrders = allOrders.filter((order: Order) => !ordersWithInvoices.has(order.id));
      setOrders(availableOrders);
    } catch (error) {
      console.error('Error fetching data:', error);
      // Optionally, you could set an error state here to show a message to the user
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOrderId = parseInt(e.target.value);
    const selectedOrder = orders.find(order => order.id === selectedOrderId);

    if (selectedOrder) {
      setFormData({ ...formData, order_id: selectedOrderId });
      setOrderCustomerName(selectedOrder.customer_name);
      setOrderPhoneNumber(selectedOrder.phone_number);
      setOrderLocation(selectedOrder.location);
      setOrderTitle(selectedOrder.title); // Set the order title
      setOrderItems(selectedOrder.items);

      const totalItemsPrice = selectedOrder.items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
      setOrderTotalItemsPrice(totalItemsPrice);
    } else {
      setFormData({ ...formData, order_id: '' });
      setOrderCustomerName('');
      setOrderPhoneNumber('');
      setOrderLocation('');
      setOrderItems([]);
      setOrderTotalItemsPrice(0);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    if (['deposit_amount', 'upfront_payment', 'delivery_charge'].includes(name)) {
      // Allow only numbers and a single decimal point
      const cleanedValue = value.replace(/[^0-9.]/g, '');
      const parts = cleanedValue.split('.');
      const finalValue = parts.length > 1 ? parts[0] + '.' + parts.slice(1).join('') : parts[0];
      setFormData({ ...formData, [name]: finalValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleAddClick = () => {
    setFormData({
      order_id: '',
      invoice_number: '',
      date_invoice: '',
      payment_method: '',
      deposit_amount: '',
      upfront_payment: '',
      delivery_charge: '',
    });
    setOrderCustomerName('');
    setOrderPhoneNumber('');
    setOrderLocation('');
    setOrderItems([]);
    setOrderTotalItemsPrice(0);
    setIsEditing(false);
    setIsViewing(false);
    setShowPanel(true);
  };

  const handleEditClick = async (invoice: InvoiceItem) => {
    if (invoice.is_paid_100_percent) {
      alert('Cannot edit a fully paid invoice.');
      return;
    }
    if (!invoice || !invoice.order_id) {
      alert('Error: Cannot edit this invoice because its order information is missing.');
      console.error('handleEditClick was called with an invalid invoice object:', invoice);
      return;
    }
    console.log('Attempting to edit invoice with order_id:', invoice.order_id);

    try {
      const orderResponse = await axios.get(`http://localhost:3001/api/orders/${invoice.order_id}`);
      const orderDetails = orderResponse.data.data;

      if (!orderDetails) {
        throw new Error(`Order with ID ${invoice.order_id} not found.`);
      }

      setCurrentInvoice(invoice);
      setFormData({
        order_id: invoice.order_id,
        invoice_number: invoice.invoice_number,
        date_invoice: invoice.date_invoice,
        payment_method: invoice.payment_method,
        deposit_amount: invoice.deposit_amount.toString(),
        upfront_payment: invoice.upfront_payment.toString(),
        delivery_charge: invoice.delivery_charge.toString(),
        is_paid_100_percent: invoice.is_paid_100_percent,
      });

      setOrderCustomerName(orderDetails.customer_name);
      setOrderPhoneNumber(orderDetails.phone_number);
      setOrderLocation(orderDetails.location);
      setOrderItems(orderDetails.items || []);
      const totalItemsPrice = (orderDetails.items || []).reduce((sum: number, item: OrderItem) => sum + (item.quantity * item.price), 0);
      setOrderTotalItemsPrice(totalItemsPrice);

      setIsEditing(true);
      setIsViewing(false);
      setShowPanel(true);
    } catch (error) {
      console.error(`Error fetching details for invoice ID ${invoice.id}:`, error);
      // Still open the panel but show an error state
      setCurrentInvoice(invoice);
      setFormData({ ...invoice });
      setOrderCustomerName('Error');
      setOrderPhoneNumber('N/A');
      setOrderLocation('Associated order may have been deleted.');
      setOrderItems([]);
      setOrderTotalItemsPrice(0);
      setIsEditing(true);
      setIsViewing(false);
      setShowPanel(true);
    }
  };

  const handleViewClick = async (invoice: InvoiceItem) => {
    if (!invoice || !invoice.order_id) {
      alert('Error: Cannot view this invoice because its order information is missing.');
      console.error('handleViewClick was called with an invalid invoice object:', invoice);
      return;
    }
    console.log('Attempting to view invoice with order_id:', invoice.order_id);

    try {
      const orderResponse = await axios.get(`http://localhost:3001/api/orders/${invoice.order_id}`);
      const orderDetails = orderResponse.data.data;

      if (!orderDetails) {
        throw new Error(`Order with ID ${invoice.order_id} not found.`);
      }

      setCurrentInvoice(invoice);
      setFormData({
        order_id: invoice.order_id,
        invoice_number: invoice.invoice_number,
        date_invoice: invoice.date_invoice,
        payment_method: invoice.payment_method,
        deposit_amount: invoice.deposit_amount.toString(),
        upfront_payment: invoice.upfront_payment.toString(),
        delivery_charge: invoice.delivery_charge.toString(),
        is_paid_100_percent: invoice.is_paid_100_percent,
      });

      setOrderCustomerName(orderDetails.customer_name);
      setOrderPhoneNumber(orderDetails.phone_number);
      setOrderLocation(orderDetails.location);
      setOrderItems(orderDetails.items || []);
      const totalItemsPrice = (orderDetails.items || []).reduce((sum: number, item: OrderItem) => sum + (item.quantity * item.price), 0);
      setOrderTotalItemsPrice(totalItemsPrice);

      setIsEditing(false);
      setIsViewing(true);
      setShowPanel(true);
    } catch (error) {
      console.error(`Error fetching details for invoice ID ${invoice.id}:`, error);
      // Still open the panel but show an error state
      setCurrentInvoice(invoice);
      setFormData({ ...invoice });
      setOrderCustomerName('Error');
      setOrderPhoneNumber('N/A');
      setOrderLocation('Associated order may have been deleted.');
      setOrderItems([]);
      setOrderTotalItemsPrice(0);
      setIsEditing(false);
      setIsViewing(true);
      setShowPanel(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Construct the full payload with all necessary data
    const payload = {
      ...formData,
      order_title: orderTitle,
      customer_name: orderCustomerName,
      phone_number: orderPhoneNumber,
      location: orderLocation,
      items: orderItems,
      total_amount: parseFloat(calculateTotalAmount()) || 0,
      balance_due: calculateBalanceDue(),
      deposit_amount: parseFloat(formData.deposit_amount) || 0,
      upfront_payment: parseFloat(formData.upfront_payment) || 0,
      delivery_charge: parseFloat(formData.delivery_charge) || 0,
      is_paid_100_percent: formData.is_paid_100_percent ? 1 : 0,
    };

    // Basic validation
    if (!payload.order_id || !payload.invoice_number || !payload.date_invoice) {
      alert('Please fill out all required fields: Order, Invoice Number, and Invoice Date.');
      return;
    }

    console.log('Submitting payload:', payload);
    try {
      if (isEditing && currentInvoice) {
        await axios.put(`http://localhost:3001/api/invoices/${currentInvoice.id}`, payload);
        alert('Invoice updated successfully!');
      } else {
        await axios.post('http://localhost:3001/api/invoices', payload);
        alert('Invoice created successfully!');
      }
      setShowPanel(false);
      fetchData(); // Refetch data after submission
    } catch (error: any) {
      console.error('Error saving invoice:', error.response?.data || error.message);
      alert(error.response?.data?.message || 'An error occurred while saving the invoice.');
    }
  };

  const handleDelete = async (id: number, isPaid: number) => {
    if (isPaid) {
      alert('Cannot delete a fully paid invoice.');
      return;
    }
    if (window.confirm('Are you sure you want to delete this invoice?')) {
      try {
        await axios.delete(`http://localhost:3001/api/invoices/${id}`);
        alert('Invoice deleted successfully!');
        fetchData(); // Refetch data after deletion
      } catch (error: any) {
        console.error('Error deleting invoice:', error.response?.data || error.message);
        alert(error.response?.data?.message || 'An error occurred while deleting the invoice.');
      }
    }
  };

  const calculateTotalAmount = () => {
    const delivery = parseFloat(formData.delivery_charge) || 0;
    return (orderTotalItemsPrice + delivery).toFixed(2);
  };

  const calculateBalanceDue = () => {
    const totalAmount = parseFloat(calculateTotalAmount()) || 0;
    const upfrontPayment = parseFloat(formData.upfront_payment) || 0;
    return totalAmount - upfrontPayment;
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStartDate('');
    setEndDate('');
  };

  const filteredInvoices = invoices.filter(invoice => {
    const invoiceDate = new Date(invoice.date_invoice);
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    if (start) start.setUTCHours(0, 0, 0, 0);
    if (end) end.setUTCHours(23, 59, 59, 999);

    const matchesSearchTerm = invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDateRange =
      (!start || invoiceDate >= start) &&
      (!end || invoiceDate <= end);

    return matchesSearchTerm && matchesDateRange;
  });

  return (
    <div className="content-container">
      <h1 className="mb-4 text-center">Invoice Management</h1>
      
      <div className="row mb-4 gx-3 align-items-center">
        <div className="col-md-4">
          <input
            type="text"
            className="form-control"
            placeholder="Search by Customer Name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="col-md-2">
          <input
            type="date"
            className="form-control"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            title="Start Date"
          />
        </div>
        <div className="col-md-2">
          <input
            type="date"
            className="form-control"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            title="End Date"
          />
        </div>
        <div className="col-md-1">
          <button className="btn btn-secondary w-100" onClick={handleResetFilters}>Reset</button>
        </div>
        <div className="col-md-3 text-end">
          <button className="btn btn-success" onClick={handleAddClick}>
            <FontAwesomeIcon icon={faPlus} className="me-2" /> Create New Invoice
          </button>
        </div>
      </div>

      <div className="invoice-list">
        {filteredInvoices.length === 0 ? (
          <p className="text-center">No invoices found.</p>
        ) : (
          <div className="row">
            {filteredInvoices.map((invoice) => {
              console.log(`Invoice ID: ${invoice.id}, is_paid_100_percent: ${invoice.is_paid_100_percent}`);
              return (
              <div key={invoice.id} className="col-md-6 mb-4">
                <div className="card h-100">
                  <div className="card-body d-flex flex-column">
                    <h5 className="card-title">Invoice for Order: {invoice.order_title}</h5>
                    <p className="card-text"><strong>Customer:</strong> {invoice.customer_name}</p>
                    <p className="card-text"><strong>Total Amount:</strong> RM {invoice.total_amount.toFixed(2)}</p>
                    <p className="card-text"><strong>Status:</strong> {invoice.is_paid_100_percent ? 'Fully Paid' : 'Pending'}</p>
                    <p className="card-text"><strong>Balance Due:</strong> {formatCurrency(invoice.balance_due)} {invoice.is_paid_100_percent && invoice.last_modified_timestamp ? `(Paid on ${formatDate(invoice.last_modified_timestamp)})` : ''}</p>
                    <div className="mt-auto d-flex justify-content-end">
                      <button className="btn btn-sm btn-info me-2" onClick={() => handleViewClick(invoice)} title="View Invoice">
                        <FontAwesomeIcon icon={faEye} />
                      </button>
                      <button className="btn btn-sm btn-warning me-2" onClick={() => handleEditClick(invoice)} title="Edit Invoice" disabled={invoice.is_paid_100_percent === 1}>
                        <FontAwesomeIcon icon={faEdit} />
                      </button>
                      <button className="btn btn-sm btn-danger" onClick={() => handleDelete(invoice.id, invoice.is_paid_100_percent)} title="Delete Invoice" disabled={invoice.is_paid_100_percent === 1}>
                        <FontAwesomeIcon icon={faTrashAlt} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );})}
          </div>
        )}
      </div>

      {showPanel && (
        <FloatingPanel onClose={() => setShowPanel(false)} title={isViewing ? 'View Invoice' : (isEditing ? 'Edit Invoice' : 'Create New Invoice')}>
          <form onSubmit={handleSubmit}>
            {/* Order Selection for new Invoices */}
            {!isEditing && !isViewing && (
              <div className="mb-3">
                <label htmlFor="order_id" className="form-label">Select Order</label>
                <select id="order_id" name="order_id" className="form-select" value={formData.order_id} onChange={handleOrderChange} required>
                  <option value="">-- Choose an Order --</option>
                  {orders.map(order => (
                    <option key={order.id} value={order.id}>{order.title} - {order.customer_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Customer and Order Details */}
            {(formData.order_id || isViewing) && (
              <div className="card mb-3">
                <div className="card-header">Customer & Order Details</div>
                <div className="card-body">
                  <p><strong>Customer:</strong> {orderCustomerName}</p>
                  <p><strong>Phone:</strong> {orderPhoneNumber}</p>
                  <p><strong>Location:</strong> {orderLocation}</p>
                </div>
              </div>
            )}

            {/* Invoice Form Fields */}
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="invoice_number" className="form-label">Invoice Number</label>
                <input type="text" id="invoice_number" name="invoice_number" className="form-control" value={formData.invoice_number} onChange={handleChange} required disabled={isViewing} />
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="date_invoice" className="form-label">Invoice Date</label>
                <input type="date" id="date_invoice" name="date_invoice" className="form-control" value={formData.date_invoice} onChange={handleChange} required disabled={isViewing} />
              </div>
            </div>

            {/* Order Items Table */}
            {orderItems.length > 0 && (
              <div className="mb-3">
                <h5>Order Items</h5>
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th className="text-end">Quantity</th>
                      <th className="text-end">Price</th>
                      <th className="text-end">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orderItems.map(item => (
                      <tr key={item.item_id}>
                        <td>{item.item_name}</td>
                        <td className="text-end">{item.quantity}</td>
                        <td className="text-end">{formatCurrency(item.price)}</td>
                        <td className="text-end">{formatCurrency(item.quantity * item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <th colSpan={3} className="text-end">Items Total:</th>
                      <th className="text-end">{formatCurrency(orderTotalItemsPrice)}</th>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Financial Details */}
            <div className="row">
              <div className="col-md-6 mb-3">
                <label htmlFor="payment_method" className="form-label">Payment Method</label>
                <select id="payment_method" name="payment_method" className="form-select" value={formData.payment_method} onChange={handleChange} required disabled={isViewing}>
                  <option value="">-- Select --</option>
                  <option value="Cash">Cash</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Credit Card">Credit Card</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="delivery_charge" className="form-label">Delivery Charge (RM)</label>
                <input type="text" id="delivery_charge" name="delivery_charge" className="form-control" value={formData.delivery_charge} onChange={handleChange} disabled={isViewing} />
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="deposit_amount" className="form-label">Deposit Amount (RM)</label>
                <input type="text" id="deposit_amount" name="deposit_amount" className="form-control" value={formData.deposit_amount} onChange={handleChange} disabled={isViewing} />
              </div>
              <div className="col-md-6 mb-3">
                <label htmlFor="upfront_payment" className="form-label">Upfront Payment (RM)</label>
                <input type="text" id="upfront_payment" name="upfront_payment" className="form-control" value={formData.upfront_payment} onChange={handleChange} required disabled={isViewing} />
              </div>
            </div>

            {/* Calculated Totals */}
            <div className="alert alert-info">
              <div className="row">
                <div className="col-6"><strong>Total Amount:</strong></div>
                <div className="col-6 text-end">{formatCurrency(calculateTotalAmount())}</div>
              </div>
              <hr/>
              <div className="row">
                <div className="col-6"><strong>Balance Due:</strong></div>
                <div className="col-6 text-end">{formatCurrency(calculateBalanceDue())}</div>
              </div>
            </div>

            {/* Paid 100% Checkbox (for editing) */}
            {isEditing && (
              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  id="is_paid_100_percent"
                  name="is_paid_100_percent"
                  className="form-check-input"
                  checked={formData.is_paid_100_percent}
                  onChange={(e) => setFormData({ ...formData, is_paid_100_percent: e.target.checked })}
                />
                <label htmlFor="is_paid_100_percent" className="form-check-label">Mark as Fully Paid</label>
              </div>
            )}

            {/* Status for Viewing */}
            {isViewing && (
              <div className="alert alert-success text-center">
                <strong>Status: {formData.is_paid_100_percent ? 'Fully Paid' : 'Pending'}</strong>
              </div>
            )}

            {/* Action Buttons */}
            <div className="d-flex justify-content-end">
              <button type="button" className="btn btn-secondary me-2" onClick={() => setShowPanel(false)}>Close</button>
              {!isViewing && (
                <button type="submit" className="btn btn-primary">{isEditing ? 'Update Invoice' : 'Create Invoice'}</button>
              )}
            </div>
          </form>
        </FloatingPanel>
      )}
    </div>
  );
}

export default Invoice;

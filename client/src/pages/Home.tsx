import { useState, useEffect } from 'react';
import axios from 'axios';

interface Message {
  id: number;
  text: string;
  timestamp: string; // Add timestamp to the interface
}

function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  useEffect(() => {
    fetchMessages();
  }, []);

  const fetchMessages = async () => {
    try {
      const response = await axios.get('http://localhost:3001/api/messages');
      setMessages(response.data.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    if (editingMessage) {
      try {
        await axios.put(`http://localhost:3001/api/messages/${editingMessage.id}`, { text: newMessage });
        setNewMessage('');
        setEditingMessage(null);
        fetchMessages();
      } catch (error) {
        console.error('Error updating message:', error);
      }
    } else {
      try {
        await axios.post('http://localhost:3001/api/messages', { text: newMessage });
        setNewMessage('');
        fetchMessages();
      } catch (error) {
        console.error('Error posting message:', error);
      }
    }
  };

  const handleEdit = (message: Message) => {
    setEditingMessage(message);
    setNewMessage(message.text);
  };

  const handleDelete = async (id: number) => {
    try {
      await axios.delete(`http://localhost:3001/api/messages/${id}`);
      fetchMessages();
    } catch (error) {
      console.error('Error deleting message:', error);
    }
  };

  return (
    <div className="content-container">
      <h1 className="mb-4 text-center">Pusaka Persona</h1>
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="input-group">
          <input
            type="text"
            className="form-control"
            placeholder="Leave a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">{editingMessage ? 'Update' : 'Submit'}</button>
        </div>
      </form>
      <div className="message-list">
        {messages.map((message, index) => (
          <div key={message.id} className="card message-card mb-2">
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h5 className="card-title">#{index + 1}</h5> {/* Numbering */}
                <small className="text-muted">{new Date(message.timestamp).toLocaleString()}</small> {/* Timestamp */}
              </div>
              <p className="card-text">{message.text}</p>
              <div className="d-flex justify-content-end mt-2">
                <button className="btn btn-sm btn-outline-secondary me-2" onClick={() => handleEdit(message)}>Edit</button>
                <button className="btn btn-sm btn-outline-secondary delete-btn" onClick={() => handleDelete(message.id)}>Delete</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Home;
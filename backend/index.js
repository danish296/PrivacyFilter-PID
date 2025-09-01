const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const socketIo = require('socket.io');
const authRoutes = require('./routes/auth');
const historyRoutes = require('./routes/history');
const vulnerabilityRoutes = require('./routes/vulnerabilities');
const authMiddleware = require('./utils/authMiddleware');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/history', authMiddleware, historyRoutes);
app.use('/api/vulnerabilities', authMiddleware, vulnerabilityRoutes);

const multer = require('multer');
const upload = multer({ dest: 'uploads/', limits: { fileSize: 100 * 1024 * 1024 } }); // 100MB limit

const users = new Map();

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  users.set(socket.id, socket);

  socket.emit('your-id', socket.id);
  socket.emit('users-list', [...users.keys()].filter(id => id !== socket.id));
  socket.broadcast.emit('user-joined', socket.id);

  socket.on('call-user', (data) => {
    const targetSocket = users.get(data.userToCall);
    if (targetSocket) {
      targetSocket.emit('incoming-call', { from: socket.id, signal: data.signalData });
    }
  });

  socket.on('answer-call', (data) => {
    const targetSocket = users.get(data.to);
    if (targetSocket) {
      targetSocket.emit('call-accepted', { signal: data.signalData, from: socket.id });
    }
  });

  socket.on('ice-candidate', (data) => {
    const targetSocket = users.get(data.to);
    if (targetSocket && data.candidate) {
      targetSocket.emit('ice-candidate', { candidate: data.candidate, from: socket.id });
    }
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    io.emit('user-left', socket.id);
    console.log('Client disconnected:', socket.id);
  });
});

const mongoURI = 'mongodb://localhost:27017/privacyfilterdb'; // adjust if needed
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('MongoDB connected'))
.catch((err) => console.error('MongoDB connection error:', err));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server listening on port ${PORT}`));






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

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/history', authMiddleware, historyRoutes);
app.use('/api/vulnerabilities', authMiddleware, vulnerabilityRoutes);

// File upload setup
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: function (req, file, cb) {
    // Allow only video files
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Only video files are allowed!'), false);
    }
  }
});

// File upload route - FIXED: This was missing
app.post('/api/upload', upload.single('video'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }
    
    console.log('File uploaded successfully:', req.file.filename);
    res.json({ 
      message: 'File uploaded successfully', 
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ message: 'Upload failed' });
  }
});

// Handle multer errors
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File too large' });
    }
  }
  if (error.message === 'Only video files are allowed!') {
    return res.status(400).json({ message: 'Only video files are allowed' });
  }
  console.error('Middleware error:', error);
  res.status(500).json({ message: 'Server error' });
});

const users = new Map();

// Socket.IO connection handling
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

// MongoDB connection with improved error handling
const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/privacyfilterdb';

mongoose.connect(mongoURI, { 
  useNewUrlParser: true, 
  useUnifiedTopology: true 
})
.then(() => {
  console.log('MongoDB connected successfully');
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
  console.error('Please make sure MongoDB is running and accessible');
  process.exit(1); // Exit if database connection fails
});

// Handle MongoDB connection events
mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await mongoose.connection.close();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

// Import routes
const teamRoutes = require('./server/routes/team');
const projectRoutes = require('./server/routes/project');
const authRoutes = require('./server/routes/auth');
const taskRoutes = require('./server/routes/task');
const uploadRoutes = require('./server/routes/upload');
const userRoutes = require('./server/routes/users');
const chatRoutes = require('./server/routes/chat'); // <-- ADDED

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  }
});

// Make io accessible in routes
app.set('io', io);
app.use(cors());
app.use(express.json());

// Middleware to inject io into every request
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Register routes
app.use('/api/auth', authRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api', uploadRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes); // <-- ADDED

app.get('/', (req, res) => {
  res.send('HELLO WORLD!');
});

// MongoDB connection
const uri = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

mongoose
  .connect(uri)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection failed:', err));

// Start server
server.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));

// Socket.io setup
io.on('connection', (socket) => {
  console.log('🟢 User connected:', socket.id);

  // --- MODIFIED: Join user-specific room based on token ---
  const token = socket.handshake.query.token;
  if (token) {
    try {
      // You must use the same JWT_SECRET as in your authMiddleware
      const decoded = require('jsonwebtoken').verify(token, process.env.JWT_SECRET); 
      const userId = decoded.userId;
      if (userId) {
        console.log(`Socket ${socket.id} joined user room: user:${userId}`);
        socket.join(`user:${userId}`);
      }
    } catch (err) {
      console.warn(`Socket ${socket.id} had invalid token.`);
    }
  }
  // --- END OF MODIFICATION ---
// Example of your server-side socket handler logic

socket.on('newMessage', async (data) => {
    try {
        // 1. Save the message to the database (and update Conversation.lastMessage)
        const savedMessage = await Message.create(data); 

        // 2. Broadcast the message (REAL-TIME CHAT)
        // Note: The frontend will immediately show the message, this is for other users.
        io.to(`conversation:${data.conversationId}`).emit('messageReceived', savedMessage);

        // 3. Notify other users (NOTIFICATION BADGE)
        const conversation = await Conversation.findById(data.conversationId);
        if (conversation) {
            conversation.members.forEach(memberId => {
                // Do not notify the sender
                if (memberId.toString() !== data.senderId) {
                    io.to(`user:${memberId.toString()}`).emit('newNotification', { 
                        type: 'chat', 
                        conversationId: data.conversationId,
                        // You can send more data here, like sender name
                    });
                }
            });
        }
    } catch (error) {
        console.error('Error handling new message:', error);
    }
});
  socket.on('joinRoom', (room) => {
    if (room) {
      console.log(`Socket ${socket.id} joined room: ${room}`);
      socket.join(room);
    }
  });

  socket.on('leaveRoom', (room) => {
    if (room) {
      console.log(`Socket ${socket.id} left room: ${room}`);
      socket.leave(room);
    }
  });

  // --- ADDED: New chat event listeners ---
  socket.on('joinConversation', (conversationId) => {
    if (conversationId) {
      console.log(`Socket ${socket.id} joined conversation room: conversation:${conversationId}`);
      socket.join(`conversation:${conversationId}`);
    }
  });

  socket.on('leaveConversation', (conversationId) => {
    if (conversationId) {
      console.log(`Socket ${socket.id} left conversation room: conversation:${conversationId}`);
      socket.leave(`conversation:${conversationId}`);
    }
  });
  // --- END OF ADDED LISTENERS ---

  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
  });
});

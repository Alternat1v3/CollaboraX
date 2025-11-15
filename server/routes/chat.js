// Fixed chat routes with proper socket emission
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/authMiddleware');
const Message = require('../models/Message');
const User = require('../models/User');
const Conversation = require('../models/Conversation');

// -------------------------------------------------
// 1. Start a new conversation (or get existing)
// -------------------------------------------------
router.post('/start', auth, async (req, res) => {
    try {
        const { email } = req.body;
        const currentUserId = req.user.userId;

        const otherUser = await User.findOne({ email });
        if (!otherUser) {
            return res.status(404).json({ message: 'User with that email not found.' });
        }

        if (otherUser._id.toString() === currentUserId) {
            return res.status(400).json({ message: "You cannot start a conversation with yourself." });
        }

        // Check if a conversation between these two users already exists
        let conversation = await Conversation.findOne({
            members: { $all: [currentUserId, otherUser._id] }
        }).populate('members', 'name email avatarUrl')
          .populate({
            path: 'lastMessage',
            populate: { path: 'sender', select: 'name email avatarUrl' }
          });

        if (conversation) {
            return res.status(200).json({ conversation });
        }

        // If not, create a new one
        conversation = new Conversation({
            members: [currentUserId, otherUser._id]
        });
        await conversation.save();

        // Populate members before sending back
        await conversation.populate('members', 'name email avatarUrl');

        res.status(201).json({ conversation });

    } catch (err) {
        console.error('Error starting conversation:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// -------------------------------------------------
// 2. Get all conversations for the current user
// -------------------------------------------------
router.get('/conversations', auth, async (req, res) => {
    try {
        const conversations = await Conversation.find({
            members: req.user.userId
        })
        .populate('members', 'name email avatarUrl')
        .populate({
            path: 'lastMessage',
            populate: { path: 'sender', select: 'name email avatarUrl' }
        })
        .sort({ updatedAt: -1 }); // Sort by last activity

        res.status(200).json(conversations);

    } catch (err) {
        console.error('Error fetching conversations:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// -------------------------------------------------
// 3. Get all messages for a specific conversation
// -------------------------------------------------
router.get('/messages/:conversationId', auth, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const currentUserId = req.user.userId;

        // Security check: Ensure user is part of this conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.members.includes(currentUserId)) {
            return res.status(403).json({ message: 'Unauthorized: You are not a member of this conversation.' });
        }

        const messages = await Message.find({ conversationId })
            .populate('sender', 'name email avatarUrl')
            .sort({ createdAt: 1 }); // Oldest first

        res.status(200).json(messages);

    } catch (err) {
        console.error('Error fetching messages:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// -------------------------------------------------
// 4. Send a new message (FIXED FOR LIVE UPDATES)
// -------------------------------------------------
router.post('/messages', auth, async (req, res) => {
    try {
        const { conversationId, content } = req.body;
        const currentUserId = req.user.userId;

        // Security check: Ensure user is part of this conversation
        const conversation = await Conversation.findById(conversationId);
        if (!conversation || !conversation.members.includes(currentUserId)) {
            return res.status(403).json({ message: 'Unauthorized: You cannot send messages to this conversation.' });
        }

        // Create new message
        let newMessage = new Message({
            conversationId,
            sender: currentUserId,
            content
        });
        await newMessage.save();
        
        // Update the conversation's 'lastMessage' and 'updatedAt'
        conversation.lastMessage = newMessage._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        // Populate sender details for the socket payload
        await newMessage.populate('sender', 'name email avatarUrl');
        
        // Get the updated conversation with all populated fields
        const updatedConversation = await Conversation.findById(conversationId)
            .populate('members', 'name email avatarUrl')
            .populate({
                path: 'lastMessage',
                populate: { path: 'sender', select: 'name email avatarUrl' }
            });

        // CRITICAL FIX: Emit to ALL members' user rooms
        console.log('📨 Emitting newMessage to conversation members...');
        conversation.members.forEach(memberId => {
            const roomName = `user:${memberId}`;
            console.log(`  → Emitting to room: ${roomName}`);
            req.io.to(roomName).emit('newMessage', newMessage, updatedConversation);
        });
        
        // ALSO emit to the conversation room for users actively viewing
        const conversationRoom = `conversation:${conversationId}`;
        console.log(`  → Emitting to room: ${conversationRoom}`);
        req.io.to(conversationRoom).emit('newMessage', newMessage, updatedConversation);

        res.status(201).json({ message: newMessage });

    } catch (err) {
        console.error('❌ Error sending message:', err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

module.exports = router;
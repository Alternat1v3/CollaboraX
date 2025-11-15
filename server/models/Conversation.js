const mongoose = require('mongoose');

const ConversationSchema = new mongoose.Schema({
members: [{
type: mongoose.Schema.Types.ObjectId,
ref: 'User',
required: true,
}],
// We can store the last message for quick previews in the conversation list
lastMessage: {
type: mongoose.Schema.Types.ObjectId,
ref: 'Message',
}
}, {
timestamps: true // This will add createdAt and updatedAt
});

// Update updatedAt whenever a new message is added (we'll do this via logic)
// Or just sort by lastMessage.createdAt on the frontend/api

module.exports = mongoose.model('Conversation', ConversationSchema);
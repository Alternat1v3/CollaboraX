const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
conversationId: {
type: mongoose.Schema.Types.ObjectId,
ref: 'Conversation',
required: true,
},
sender: {
type: mongoose.Schema.Types.ObjectId,
ref: 'User',
required: true,
},
content: {
type: String,
required: true,
trim: true,
},
}, {
timestamps: true // This will add createdAt
});

module.exports = mongoose.model('Message', MessageSchema);
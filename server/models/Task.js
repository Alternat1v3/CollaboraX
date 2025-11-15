const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    description: {
        type: String,
        default: '',
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
    },
    assignee: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // A task might be unassigned
    }],
    status: {
        type: String,
        required: true,
        enum: ['todo', 'doing', 'done'], // Only allows these values
        default: 'todo',
    },
    dueDate: {
        type: Date,
        required: false,
    }
}, {
    timestamps: true // Handles createdAt and updatedAt
});

module.exports = mongoose.model('Task', TaskSchema);

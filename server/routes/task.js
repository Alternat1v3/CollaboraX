// module.exports = router;
const express = require('express');
const router = express.Router();
const Task = require('../models/Task');
const Project = require('../models/Project');
const auth = require('../middleware/authMiddleware');

// 🟢 Create a new task
router.post('/', auth, async (req, res) => {
  try {
    const { title, description, projectId, assignee, status, dueDate } = req.body;
    const project = await Project.findById(projectId);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const task = new Task({ title, description, projectId, assignee, status, dueDate });
    await task.save();

    req.io.to(`project:${projectId}`).emit('taskCreated', task);
    res.status(201).json({ message: 'Task created', task });
  } catch (err) {
    res.status(500).json({ message: 'Error creating task', error: err.message });
  }
});

// 🟡 Get all tasks for a project
router.get('/project/:projectId', auth, async (req, res) => {
  try {
    const tasks = await Task.find({ projectId: req.params.projectId })
      .populate('assignee', 'name email')
      .sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks', error: err.message });
  }
});

// 🔵 Update a task
router.patch('/:id', auth, async (req, res) => {
  try {
    const updates = req.body;
    const task = await Task.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    req.io.to(`project:${task.projectId}`).emit('taskUpdated', task);
    res.json({ message: 'Task updated', task });
  } catch (err) {
    res.status(500).json({ message: 'Error updating task', error: err.message });
  }
});

// 🔴 Delete a task
router.delete('/:id', auth, async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: 'Task not found' });

    req.io.to(`project:${task.projectId}`).emit('taskDeleted', task._id);
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting task', error: err.message });
  }
});

module.exports = router;

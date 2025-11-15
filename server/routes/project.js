// module.exports = router;
const express = require('express');
const router = express.Router();
const Project = require('../models/Project');
const Team = require('../models/Team');
const Task = require('../models/Task');
const auth = require('../middleware/authMiddleware');

// 🟢 Create a new project under a team
router.post('/', auth, async (req, res) => {
  try {
    const { name, description, teamId } = req.body;

    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });
    
    // **Creator-only check**
    if (team.createdBy.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Unauthorized. Only the team creator can create projects.' });
    }

    const project = new Project({ name, description, teamId, createdBy: req.user.userId });
    await project.save();

    req.io.to(`team:${team._id}`).emit('projectCreated', project);

    res.status(201).json({ message: 'Project created', project });
  } catch (err) {
    res.status(500).json({ message: 'Error creating project', error: err.message });
  }
});

// 🟡 Get all projects for a team
router.get('/team/:teamId', auth, async (req, res) => {
  try {
    const projects = await Project.find({ teamId: req.params.teamId })
      .populate('createdBy', 'name email');
    res.json(projects);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching projects', error: err.message });
  }
});

// 🔵 Update a project
router.patch('/:id', auth, async (req, res) => {
  try {
    const { name, description } = req.body;
    const project = await Project.findById(req.params.id);
    if (!project) return res.status(404).json({ message: 'Project not found' });

    const team = await Team.findById(project.teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    // --- THIS IS THE FIX ---
    // **Authorization Check: Only the Team Creator can edit**
  	if (team.createdBy.toString() !== req.user.userId) {
  		return res.status(403).json({ message: 'Unauthorized. Only the team creator can edit projects.' });
  	}
    // --- END OF FIX ---

    if (name) project.name = name;
    if (description !== undefined) project.description = description; // Allow setting empty description
    await project.save();

    // Your socket emit is correct!
    req.io.to(`team:${project.teamId}`).emit('projectUpdated', project);

    res.json({ message: 'Project updated', project });
  } catch (err) {
    res.status(500).json({ message: 'Error updating project', error: err.message });
  }
});

// 🔴 Delete a project (cascade delete tasks)
router.delete('/:id', auth, async (req, res) => {
  try {
    const projectId = req.params.id;

  	// 1. Find the project
    const project = await Project.findById(projectId);
    if (!project) {
    	return res.status(404).json({ message: 'Project not found.' });
  	}

  	// 2. Find the team for authorization
  	const team = await Team.findById(project.teamId);
  	if (!team) {
  		return res.status(404).json({ message: 'Associated team not found.' });
  	}

  	// 3. Authorization Check: Only the Team Creator can delete
  	if (team.createdBy.toString() !== req.user.userId) {
  		return res.status(403).json({ message: 'Unauthorized. Only the team creator can delete projects.' });
  	}

  	// 4. Cascade Delete: Remove all tasks associated with this project
  	await Task.deleteMany({ projectId: projectId });

  	// 5. Delete the project itself
  	await Project.findByIdAndDelete(projectId);

  	// 6. Emit the socket event to the team room
  	req.io.to(`team:${project.teamId}`).emit('projectDeleted', project._id, project.teamId);

  	// 7. Send success response
  	res.json({ message: 'Project and all associated tasks deleted successfully.' });

  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ message: 'Error deleting project', error: err.message });
  }
});


module.exports = router;
// module.exports = router;
const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const User = require('../models/User');
const Project = require('../models/Project');
const Task = require('../models/Task');
const auth = require('../middleware/authMiddleware');

// 🟢 Create a new team
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    const team = new Team({
      name,
      members: [req.user.userId],
      createdBy: req.user.userId
    });

    await team.save();

    await User.findByIdAndUpdate(req.user.userId, { $push: { teams: team._id } });

    // -----------------------------------------------------------------
    //  FIX: You must populate the 'members' field before sending it back
    // -----------------------------------------------------------------
    await team.populate('members', 'name email avatarUrl');
    // -----------------------------------------------------------------

    // 'team' is now populated and will be sent to the frontend
    res.status(201).json({ message: 'Team created successfully', team });

  } catch (error) {
    console.error('Team creation error:', error);
    res.status(500).json({ message: 'Error creating team', error: error.message });
  }
});

// 🟡 Get all teams for authenticated user
router.get('/', auth, async (req, res) => {
  try {
    const teams = await Team.find({ members: req.user.userId })
      .populate('members', 'name email avatarUrl');
    res.json(teams);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teams', error: error.message });
  }
});

// ➕ Add a member to a team by email
router.post('/:id/add', auth, async (req, res) => {
  try {
    const { email } = req.body;
    const team = await Team.findById(req.params.id);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (team.members.map(id => id.toString()).includes(user._id.toString()))
      return res.status(400).json({ message: 'User already in the team' });

    team.members.push(user._id);
    await team.save();

    await User.findByIdAndUpdate(user._id, { $push: { teams: team._id } });

    const updatedTeam = await Team.findById(team._id)
      .populate('members', 'name email avatarUrl');

    // Emit via Socket.io
    req.io.to(`team:${team._id}`).emit('teamUpdated', updatedTeam);
    req.io.to(`user:${user._id}`).emit('teamUpdated', updatedTeam);

    res.json({ message: 'Member added successfully', team: updatedTeam });
  } catch (error) {
    res.status(500).json({ message: 'Error adding member', error: error.message });
  }
});

// ➖ Remove a member from a team
router.delete('/:id/members/:memberId', auth, async (req, res) => {
  try {
    const { id: teamId, memberId } = req.params;
    const team = await Team.findById(teamId);

    if (!team) return res.status(404).json({ message: 'Team not found' });
    if (team.createdBy.toString() !== req.user.userId)
      return res.status(403).json({ message: 'Only creator can remove members' });
    if (team.createdBy.toString() === memberId)
      return res.status(400).json({ message: 'Creator cannot remove themselves' });

    team.members = team.members.filter(m => m.toString() !== memberId);
    await team.save();

    await User.findByIdAndUpdate(memberId, { $pull: { teams: team._id } });

    const updatedTeam = await Team.findById(teamId)
      .populate('members', 'name email avatarUrl');

    req.io.to(`team:${teamId}`).emit('teamUpdated', updatedTeam);
    req.io.to(`user:${memberId}`).emit('teamDeleted', teamId);

    res.json({ message: 'Member removed successfully', team: updatedTeam });
  } catch (error) {
    res.status(500).json({ message: 'Error removing member', error: error.message });
  }
});

// 🔴 Delete a team (cascade delete)
router.delete('/:id', auth, async (req, res) => {
  try {
    const teamId = req.params.id;
    const team = await Team.findById(teamId);
    if (!team) return res.status(404).json({ message: 'Team not found' });

    if (team.createdBy.toString() !== req.user.userId)
      return res.status(403).json({ message: 'Only creator can delete team' });

    const projects = await Project.find({ teamId: team._id });
    const projectIds = projects.map(p => p._id);

    await Task.deleteMany({ projectId: { $in: projectIds } });
    await Project.deleteMany({ teamId: team._id });
    await User.updateMany({ _id: { $in: team.members } }, { $pull: { teams: team._id } });
    await team.deleteOne();

    req.io.to(`team:${teamId}`).emit('teamDeleted', teamId);

    res.json({ message: 'Team and related data deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting team', error: error.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// PATCH route to update user avatar URL (accessible at /api/users/:id/avatar)
router.patch('/:id/avatar', auth, async (req, res) => {
    try {
        const userId = req.params.id;
        const { avatarUrl } = req.body;

        // Security check: Ensure the logged-in user is updating their own profile
        if (req.user.userId !== userId) {
            return res.status(403).json({ message: 'Unauthorized to update this profile.' });
        }

        const user = await User.findByIdAndUpdate(
            userId, 
            { avatarUrl: avatarUrl }, 
            { new: true, select: '-passwordHash' } // Return the updated user, excluding the password hash
        );

        if (!user) {
            return res.status(404).json({ 
                message: 'User not found.' });
        }

        // Returns the updated user object (with the new avatarUrl)
        res.json({ message: 'Avatar updated successfully', user });

    } catch (error) {
        console.error("Error updating avatar:", error);
        res.status(500).json({ message: 'Error updating avatar', error });
    }
});

module.exports = router;
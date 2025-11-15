const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// REGISTER
router.post('/register', async(req,res)=>{
  try {
    const {name, email, password} = req.body;

    const existingUser = await User.findOne({email});
    if(existingUser)
        return res.status(400).json({message:"Email already registered!"});

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password,salt);
    const user = new User({name,email,passwordHash});
    await user.save();
    res.status(201).json({message:"User created Successfully!"});
  } catch (error) {
    res.status(500).json({message:'Server Error', error});
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ message: "Invalid email or password" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Return user object with _id and avatarUrl to match frontend expectations
    res.status(200).json({
      token,
      user: { _id: user._id, name: user.name, email: user.email, avatarUrl: user.avatarUrl || '' }
    });
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

module.exports = router;

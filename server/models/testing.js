// var express = require('express')
// var router = express.Router();
// var Team = require('../models/Team')
// var User = require('../models/User')
// var auth = require('../middleware/authMiddleware')

// router.post('/', auth, async(req, res)=>{
// try {
//     const {name} = req.body;
//     const team = new Team({name, members:[req.user.userId]})
//     await team.save()

//     await User.findByIdAndUpdate(req.user.userId,{$push:{teams:team.userId}})
//     res.status(201).json({message:"Team Created Successfully!"})
// } catch (error) {
//     res.status(500).json({message:"Couln't create Team!"})
// }
// })




// var express = require('express')
// var router = express.Router();
// var Team = require('../models/Team')
// var User = require('../models/User')
// var auth = require('../middleware/authMiddleware')

// router.post('/:id/add', auth, async(req,res)=>{
// try {
//     const {email} = req.body;
//     const team = await Team.findById(req.params.id)
//     if(!team) return res.status(404).json({message:'Team not found!'})
    
//     const user = await User.findOne({email})
//     if(!user) return res.status(404).json({message:"User not found!"})
//     if(team.members.includes(user._id))
//         return res.status(400).json({message:'User already exist in the team!'})
//     team.members.push(user._id)
//     await team.save()
//     await User.findByIdAndUpdate(user._id,{$push:{teams:team._id}})
//     res.json({ message: 'Member added successfully', team });
// } catch (error) {
//     res.status(500).json({message:"Failed to add user!"})
// }
// })
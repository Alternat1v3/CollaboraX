const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true 
},
  members: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
}],
  // ✅ NEW FIELD: Link the team to its creator
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }
}, { timestamps: true });
module.exports = mongoose.model('Team', teamSchema);

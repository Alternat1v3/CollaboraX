var mongoose = require('mongoose');

const userSchema = mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  passwordHash: {
    type: String,
    required: true
  },
  avatarUrl: {
    type: String,
    default: ''
  },
  teams:[{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Team'
  }]
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
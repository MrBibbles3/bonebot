const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },

    bones: {
        type: Number,
        default: 0
    },

    dailyLastClaim: {
        type: Date,
        default: null
    },

    dailyStreak: {
        type: Number,
        default: 0
    },


    inventory: [
    {
        itemId: String,
        quantity: {
            type: Number,
            default: 1
        }
    }
    ]
});

module.exports = mongoose.model('User', userSchema);

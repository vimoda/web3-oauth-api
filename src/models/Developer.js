const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const DeveloperSchema = new mongoose.Schema({
  email: String,
  appName: String,
  apiKey: { type: String, unique: true },
  apiSecret: String,
  accessLevels: [
    {
      levelName: { type: String, required: true },
      network: { type: String, required: true, enum: ['testnet', 'mainnet'], default: 'mainnet' },
      tokenRequirements: [
        {
          tokenMintAddress: { type: String, required: true },
          minAmount: { type: Number, required: true, default: 0 },
        },
      ],
    },
  ],
});

DeveloperSchema.pre('save', async function (next) {
  if (this.isModified('apiSecret')) {
    this.apiSecret = await bcrypt.hash(this.apiSecret, 10);
  }
  next();
});

module.exports = mongoose.model('Developer', DeveloperSchema);
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { config } = require('../config/env');

const signToken = (user) =>
  jwt.sign({ sub: user._id.toString(), role: user.role }, config.jwtSecret, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });
const hashPassword = (pw) => bcrypt.hash(pw, config.bcryptRounds);
const comparePassword = (pw, hash) => bcrypt.compare(pw, hash);
// Used to keep response time similar whether or not the email exists
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10);
module.exports = { signToken, hashPassword, comparePassword, DUMMY_HASH };

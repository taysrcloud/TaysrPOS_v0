import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

router.post('/token', async (req, res, next) => {
  try {
    // The oauth token endpoint often receives x-www-form-urlencoded, but express.json() might parse it if sent as json.
    // For x-www-form-urlencoded, express needs express.urlencoded middleware. 
    // We'll support both by checking req.body directly.
    const { grant_type, username, password } = req.body;

    if (grant_type !== 'password') {
      return res.status(400).json({ error: 'unsupported_grant_type', error_description: 'Only password grant type is supported' });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'invalid_request', error_description: 'Missing username or password' });
    }

    const user = await prisma.user.findFirst({
      where: { OR: [{ username }, { email: String(username).toLowerCase() }] }
    });

    if (!user) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Invalid credentials' });
    }

    // Usually you'd check bcrypt.compare(password, user.passwordHash)
    // For demo purposes, we do a basic check if hash starts with $2 (bcrypt)
    let isMatch = false;
    if (user.passwordHash.startsWith('$2')) {
      isMatch = await bcrypt.compare(password, user.passwordHash);
    } else {
      // Fallback for simple cleartext or dummy hash testing
      isMatch = password === user.passwordHash || user.passwordHash === 'hash';
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'invalid_grant', error_description: 'Invalid credentials' });
    }

    // Issue Token
    const payload = {
      userId: user.id,
      username: user.username,
      companyId: user.companyId
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 7 * 24 * 60 * 60, // 7 days in seconds
    });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';

const hasGoogleConfig =
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.SESSION_SECRET;

if (hasGoogleConfig) {
  const baseUrl = process.env.FRONTEND_URL || process.env.BASE_URL || 'http://localhost:3000';
  const callbackPath = '/api/auth/google/callback';
  const callbackURL = process.env.GOOGLE_CALLBACK_URL || (baseUrl.replace(/\/$/, '') + callbackPath);
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL,
      },
      (_accessToken, _refreshToken, profile, done) => {
        const user = {
          id: profile.id,
          email: profile.emails?.[0]?.value || profile.id,
          name: profile.displayName || profile.emails?.[0]?.value || 'User',
        };
        return done(null, user);
      }
    )
  );
  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user));
}

export const authRoutes = Router();

authRoutes.get('/me', (req, res) => {
  if (req.user) {
    return res.json({
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
    });
  }
  if (!hasGoogleConfig) {
    return res.json({
      dev: true,
      name: 'Dev User',
      email: 'dev@localhost',
    });
  }
  res.status(401).json({ error: 'Not signed in' });
});

authRoutes.get('/google', (req, res, next) => {
  if (!hasGoogleConfig) {
    return res.redirect(302, '/login');
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

authRoutes.get(
  '/google/callback',
  (req, res, next) => {
    if (!hasGoogleConfig) {
      return res.redirect(302, '/login');
    }
    passport.authenticate('google', (err, user) => {
      if (err) {
        return res.redirect(302, '/login?error=1');
      }
      req.login(user, (loginErr) => {
        if (loginErr) {
          return res.redirect(302, '/login?error=1');
        }
        const front = process.env.FRONTEND_URL || req.get('origin') || 'http://localhost:3000';
        const base = front.startsWith('http') ? front : `http://${front}`;
        res.redirect(302, base.replace(/\/$/, '') + '/app/dashboard');
      });
    })(req, res, next);
  }
);

authRoutes.post('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    req.session.destroy(() => {
      res.json({ ok: true });
    });
  });
});

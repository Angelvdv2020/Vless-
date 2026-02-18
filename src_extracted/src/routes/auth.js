import { Router } from 'express';
import { supabase, requireAuth } from '../supabase.js';
import { validateEmail, validateUsername, sanitizeInput } from '../security.js';
import { logger } from '../logger.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    let { email, password, username, referralCode } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    email = sanitizeInput(email);
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 6 символов' });
    }

    if (username) {
      username = sanitizeInput(username);
      if (!validateUsername(username)) {
        return res.status(400).json({ error: 'Некорректное имя пользователя (3-32 символа, только буквы, цифры, _ и -)' });
      }
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: username || email.split('@')[0] },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    if (referralCode && data.user) {
      const { data: referrer } = await supabase
        .from('profiles')
        .select('id')
        .eq('referral_code', referralCode.toUpperCase())
        .maybeSingle();

      if (referrer) {
        await supabase
          .from('profiles')
          .update({ referred_by: referrer.id })
          .eq('id', data.user.id);
        logger.info(`User ${data.user.id} referred by ${referrer.id}`);
      }
    }

    res.json({
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    logger.error('Registration error:', err);
    res.status(500).json({ error: 'Ошибка регистрации' });
  }
});

router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    email = sanitizeInput(email);
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Некорректный email' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    res.json({
      user: data.user,
      session: data.session,
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка входа' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.json({ success: true });
  } catch (err) {
    logger.error('Logout error:', err);
    res.status(500).json({ error: 'Ошибка выхода' });
  }
});

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .maybeSingle();

    if (error || !profile) {
      return res.status(404).json({ error: 'Профиль не найден' });
    }

    res.json(profile);
  } catch (err) {
    logger.error('Profile fetch error:', err);
    res.status(500).json({ error: 'Ошибка загрузки профиля' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    let { username, full_name, telegram_id } = req.body;
    const updates = {};

    if (username !== undefined) {
      username = sanitizeInput(username);
      if (!validateUsername(username)) {
        return res.status(400).json({ error: 'Некорректное имя пользователя' });
      }
      updates.username = username;
    }

    if (full_name !== undefined) {
      updates.full_name = sanitizeInput(full_name);
    }

    if (telegram_id !== undefined) {
      updates.telegram_id = sanitizeInput(telegram_id);
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', req.user.id)
      .select()
      .maybeSingle();

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json(data);
  } catch (err) {
    logger.error('Profile update error:', err);
    res.status(500).json({ error: 'Ошибка обновления профиля' });
  }
});

export default router;

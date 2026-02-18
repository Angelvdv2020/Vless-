import { Router } from 'express';
import { supabase, requireAuth } from '../supabase.js';
import { x3ui } from '../x3ui.js';
import { logger } from '../logger.js';

const router = Router();

const PERIOD_MAP = {
  monthly: { days: 30, priceField: 'price_monthly' },
  quarterly: { days: 90, priceField: 'price_quarterly' },
  yearly: { days: 365, priceField: 'price_yearly' },
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('*, tariff:tariffs(*)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    const enriched = await Promise.all(
      (subs || []).map(async (sub) => {
        if (sub.x3ui_username) {
          try {
            const rData = await x3ui.getUser(sub.x3ui_username);
            if (rData?.response) {
              const u = rData.response;
              sub.traffic_used_gb = Number(((u.usedTrafficBytes || 0) / 1073741824).toFixed(2));
              sub.traffic_limit_gb = u.trafficLimitBytes > 0
                ? Number((u.trafficLimitBytes / 1073741824).toFixed(2))
                : null;
              sub.online_at = u.onlineAt;
              sub.subscription_url = u.subscriptionUrl || sub.subscription_url;
              sub.remna_status = u.status;
            }
          } catch (e) {
            logger.error(`Failed to fetch x3ui user ${sub.x3ui_username}:`, e.message);
          }
        }
        return sub;
      })
    );

    res.json(enriched);
  } catch (err) {
    logger.error('Error fetching subscriptions:', err);
    res.status(500).json({ error: 'Ошибка загрузки подписок' });
  }
});

router.post('/purchase', requireAuth, async (req, res) => {
  try {
    const { tariff_id, period } = req.body;
    if (!tariff_id) {
      return res.status(400).json({ error: 'Укажите тариф' });
    }

    const { data: tariff, error: tariffErr } = await supabase
      .from('tariffs')
      .select('*')
      .eq('id', tariff_id)
      .eq('is_active', true)
      .maybeSingle();

    if (tariffErr || !tariff) {
      return res.status(404).json({ error: 'Тариф не найден' });
    }

    if (tariff.is_trial) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('trial_used')
        .eq('id', req.user.id)
        .maybeSingle();

      if (profile?.trial_used) {
        return res.status(400).json({ error: 'Пробный период уже использован' });
      }
    }

    let durationDays;
    let price;

    if (tariff.is_trial) {
      const { data: trialSettings } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'trial')
        .maybeSingle();
      durationDays = trialSettings?.value?.duration_days || 3;
      price = 0;
    } else {
      const periodConfig = PERIOD_MAP[period] || PERIOD_MAP.monthly;
      durationDays = periodConfig.days;
      price = Number(tariff[periodConfig.priceField]) || 0;
    }

    const username = `web_${req.user.id.replace(/-/g, '').slice(0, 16)}_${Date.now().toString(36)}`;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    const trafficBytes = tariff.traffic_limit_gb
      ? Math.round(tariff.traffic_limit_gb * 1073741824)
      : 0;

    let remnaUser;
    try {
      remnaUser = await x3ui.createUser({
        username,
        trafficLimitBytes: trafficBytes,
        expireAt: expiresAt.toISOString(),
        deviceLimit: tariff.max_devices,
      });
    } catch (e) {
      logger.error('3X-UI create user failed:', e.message);
      return res.status(500).json({ error: 'Ошибка создания VPN-подключения' });
    }

    const subUrl = remnaUser?.response?.subscriptionUrl || '';
    const remnaUsername = remnaUser?.response?.username || username;
    const remnaUuid = remnaUser?.response?.uuid || '';

    const { data: sub, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        user_id: req.user.id,
        tariff_id: tariff.id,
        x3ui_username: remnaUsername,
        x3ui_user_uuid: remnaUuid,
        subscription_url: subUrl,
        status: tariff.is_trial ? 'trial' : 'active',
        starts_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .maybeSingle();

    if (subErr) {
      logger.error('Subscription insert error:', subErr);
      return res.status(500).json({ error: 'Ошибка сохранения подписки' });
    }

    if (!tariff.is_trial && price > 0) {
      await supabase.from('payments').insert({
        user_id: req.user.id,
        subscription_id: sub.id,
        amount: price,
        payment_method: 'balance',
        status: 'completed',
      });

      await processReferralBonus(req.user.id, price, sub.id);
    }

    if (tariff.is_trial) {
      await supabase
        .from('profiles')
        .update({ trial_used: true, updated_at: new Date().toISOString() })
        .eq('id', req.user.id);
    }

    res.json({ subscription: sub, subscription_url: subUrl });
  } catch (err) {
    logger.error('Purchase error:', err);
    res.status(500).json({ error: 'Ошибка оформления подписки' });
  }
});

router.post('/:id/renew', requireAuth, async (req, res) => {
  try {
    const { tariff_id, period } = req.body;
    const { id } = req.params;

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!sub) {
      return res.status(404).json({ error: 'Подписка не найдена' });
    }

    const { data: tariff } = await supabase
      .from('tariffs')
      .select('*')
      .eq('id', tariff_id || sub.tariff_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!tariff || tariff.is_trial) {
      return res.status(404).json({ error: 'Тариф не найден' });
    }

    const periodConfig = PERIOD_MAP[period] || PERIOD_MAP.monthly;
    const durationDays = periodConfig.days;
    const price = Number(tariff[periodConfig.priceField]) || 0;

    const currentExpires = new Date(sub.expires_at);
    const baseDate = currentExpires > new Date() ? currentExpires : new Date();
    const newExpires = new Date(baseDate);
    newExpires.setDate(newExpires.getDate() + durationDays);

    if (sub.x3ui_username) {
      try {
        const rUser = await x3ui.getUser(sub.x3ui_username);
        if (rUser?.response?.uuid) {
          await x3ui.extendUser(rUser.response.uuid, {
            expireAt: newExpires.toISOString(),
          });
          if (sub.status !== 'active') {
            await x3ui.enableUser(rUser.response.uuid);
          }
        }
      } catch (e) {
        logger.error('3X-UI extend failed:', e.message);
      }
    }

    const { data: updated } = await supabase
      .from('subscriptions')
      .update({
        expires_at: newExpires.toISOString(),
        status: 'active',
        tariff_id: tariff.id,
      })
      .eq('id', id)
      .select()
      .maybeSingle();

    await supabase.from('payments').insert({
      user_id: req.user.id,
      subscription_id: id,
      amount: price,
      payment_method: 'balance',
      status: 'completed',
    });

    await processReferralBonus(req.user.id, price, id);

    res.json(updated);
  } catch (err) {
    logger.error('Renew error:', err);
    res.status(500).json({ error: 'Ошибка продления подписки' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (!sub) {
      return res.status(404).json({ error: 'Подписка не найдена' });
    }

    if (sub.x3ui_username) {
      try {
        const rUser = await x3ui.getUser(sub.x3ui_username);
        if (rUser?.response?.uuid) {
          await x3ui.disableUser(rUser.response.uuid);
        }
      } catch (e) {
        logger.error('3X-UI disable failed:', e.message);
      }
    }

    await supabase
      .from('subscriptions')
      .update({ status: 'cancelled' })
      .eq('id', req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка отключения подписки' });
  }
});

async function processReferralBonus(userId, amount, subscriptionId) {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('referred_by')
      .eq('id', userId)
      .maybeSingle();

    if (!profile?.referred_by) return;

    const { data: settings } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'referral')
      .maybeSingle();

    if (!settings?.value?.enabled) return;

    const bonusType = settings.value.bonus_type || 'fixed';
    const bonusAmount = bonusType === 'percent'
      ? amount * (settings.value.bonus_amount / 100)
      : settings.value.bonus_amount || 0;

    if (bonusAmount <= 0) return;

    await supabase.from('referrals').insert({
      referrer_id: profile.referred_by,
      referred_id: userId,
      bonus_amount: bonusAmount,
      status: 'completed',
    });

    const { data: referrer } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', profile.referred_by)
      .maybeSingle();

    if (referrer) {
      await supabase
        .from('profiles')
        .update({
          balance: (referrer.balance || 0) + bonusAmount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.referred_by);
    }
  } catch (e) {
    logger.error('Referral bonus error:', e.message);
  }
}

export default router;

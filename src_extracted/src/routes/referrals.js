import { Router } from 'express';
import { supabase, requireAuth } from '../supabase.js';

const router = Router();

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('referral_code, balance')
      .eq('id', req.user.id)
      .maybeSingle();

    const { data: referred } = await supabase
      .from('profiles')
      .select('id, username, created_at')
      .eq('referred_by', req.user.id)
      .order('created_at', { ascending: false });

    const { data: earnings } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', req.user.id)
      .order('created_at', { ascending: false });

    const totalEarned = (earnings || []).reduce((sum, e) => sum + Number(e.bonus_amount || 0), 0);

    res.json({
      referral_code: profile?.referral_code || '',
      balance: profile?.balance || 0,
      total_earned: totalEarned,
      total_referrals: (referred || []).length,
      referrals: referred || [],
      earnings: earnings || [],
    });
  } catch (err) {
    res.status(500).json({ error: 'Ошибка загрузки реферальной статистики' });
  }
});

export default router;

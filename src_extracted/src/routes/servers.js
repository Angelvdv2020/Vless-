import { Router } from 'express';
import { remnawave } from '../remnawave.js';
import { logger } from '../logger.js';

const router = Router();

const FLAG_MAP = {
  'US': 'US', 'DE': 'DE', 'NL': 'NL', 'FI': 'FI', 'GB': 'GB',
  'FR': 'FR', 'JP': 'JP', 'SG': 'SG', 'AU': 'AU', 'CA': 'CA',
  'KR': 'KR', 'SE': 'SE', 'CH': 'CH', 'AT': 'AT', 'RU': 'RU',
};

router.get('/', async (req, res) => {
  try {
    const nodesData = await remnawave.getNodes();
    const nodes = nodesData?.response || [];

    const servers = nodes.map((node) => ({
      id: node.uuid || node.id,
      name: node.name || 'Unknown',
      address: node.address || '',
      port: node.port || 0,
      status: node.isConnected ? 'online' : 'offline',
      usersCount: node.usersOnline || 0,
      trafficTotal: node.trafficTotal || 0,
      country_code: node.countryCode || '',
    }));

    res.json(servers);
  } catch (err) {
    logger.error('Error fetching servers:', err.message);
    res.json([]);
  }
});

export default router;

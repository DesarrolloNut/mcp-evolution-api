import { Router, Request, Response } from 'express';
import { IProviderRepository } from '../../../domain/ports/IProviderRepository.js';
import { ProviderFactory } from '../../../application/services/providerFactory.js';
import { ProviderType } from '../../../domain/entities/provider.js';

export function createProvidersRouter(
  providerRepo: IProviderRepository,
  providerFactory: ProviderFactory
): Router {
  const router = Router();

  // List all providers
  router.get('/', async (_req: Request, res: Response) => {
    try {
      const providers = await providerRepo.findAll();
      // Mask api_key_encrypted for security in responses
      const safeProviders = providers.map((p) => ({
        ...p,
        apiKeyEncrypted: '********',
      }));
      res.json(safeProviders);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Get provider by ID
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const provider = await providerRepo.findById(id);
      if (!provider) {
        res.status(404).json({ error: 'Provider not found' });
        return;
      }
      res.json({
        ...provider,
        apiKeyEncrypted: '********',
      });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Create provider
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { name, type, baseUrl, apiKey, config } = req.body || {};
      if (!name || !type || !baseUrl || !apiKey) {
        res.status(400).json({ error: 'Missing required fields: name, type, baseUrl, apiKey' });
        return;
      }

      const validTypes: ProviderType[] = ['evolution', 'meta', 'twilio'];
      if (!validTypes.includes(type)) {
        res.status(400).json({ error: `Invalid provider type. Must be one of: ${validTypes.join(', ')}` });
        return;
      }

      // SSRF validation for baseUrl
      try {
        const parsedUrl = new URL(String(baseUrl).trim());
        if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
          res.status(400).json({ error: 'baseUrl must use http or https protocol' });
          return;
        }
        if (/^169\.254\.\d+\.\d+$/.test(parsedUrl.hostname)) {
          res.status(400).json({ error: 'baseUrl cannot target link-local or cloud metadata endpoints' });
          return;
        }
      } catch {
        res.status(400).json({ error: 'Invalid baseUrl format' });
        return;
      }

      const created = await providerRepo.create({
        name: String(name).trim(),
        type,
        baseUrl: String(baseUrl).trim().replace(/\/+$/, ''),
        apiKey: String(apiKey).trim(),
        config: typeof config === 'object' ? config : {},
      });

      res.status(201).json({
        ...created,
        apiKeyEncrypted: '********',
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Update provider
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const { name, baseUrl, apiKey, config, isActive } = req.body || {};
      const updated = await providerRepo.update(id, {
        name: name ? String(name).trim() : undefined,
        baseUrl: baseUrl ? String(baseUrl).trim().replace(/\/+$/, '') : undefined,
        apiKey: apiKey ? String(apiKey).trim() : undefined,
        config: typeof config === 'object' ? config : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      });

      res.json({
        ...updated,
        apiKeyEncrypted: '********',
      });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Deactivate / Delete provider
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      await providerRepo.delete(id);
      res.json({ success: true, message: 'Provider deactivated' });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Test provider connection
  router.post('/:id/test', async (req: Request, res: Response) => {
    try {
      const id = String(req.params.id);
      const provider = await providerRepo.findById(id);
      if (!provider) {
        res.status(404).json({ error: 'Provider not found' });
        return;
      }

      const adapter = providerFactory.create(provider);
      const testResult = await adapter.testConnection();
      res.json(testResult);
    } catch (err) {
      res.status(500).json({ success: false, message: (err as Error).message });
    }
  });

  return router;
}

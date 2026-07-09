import Redis from 'ioredis';

// Usa a variável REDIS_URL que a Vercel já criou ao conectar o banco
// (formato redis://default:senha@host:porta)
const redis = new Redis(process.env.REDIS_URL);

const ADMIN_CODE = process.env.ADMIN_CODE || 'ac080826';
const KEY = 'aniversario_ana_convidados';

function checkAdmin(req, res) {
  if (req.headers['x-admin-code'] !== ADMIN_CODE) {
    res.status(401).json({ error: 'Código de acesso inválido.' });
    return false;
  }
  return true;
}

async function getList() {
  const raw = await redis.get(KEY);
  return raw ? JSON.parse(raw) : [];
}

async function saveList(list) {
  await redis.set(KEY, JSON.stringify(list));
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-code');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const list = await getList();

    if (req.method === 'GET') {
      if (!checkAdmin(req, res)) return;
      const confirmados = list.filter((g) => g.presenca === 'sim');
      return res.status(200).json(confirmados);
    }

    if (req.method === 'POST') {
      const { nome, instagram, telefone, presenca } = req.body || {};
      if (!nome || !telefone || !presenca) {
        return res.status(400).json({ error: 'Dados incompletos.' });
      }
      const guest = {
        id: crypto.randomUUID(),
        nome: String(nome).slice(0, 120),
        instagram: String(instagram || '').slice(0, 60),
        telefone: String(telefone).slice(0, 30),
        presenca: presenca === 'sim' ? 'sim' : 'nao',
        criadoEm: Date.now(),
      };
      list.push(guest);
      await saveList(list);
      return res.status(201).json(guest);
    }

    if (req.method === 'PUT') {
      if (!checkAdmin(req, res)) return;
      const { id, nome, instagram, telefone } = req.body || {};
      const idx = list.findIndex((g) => g.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Convidado não encontrado.' });
      list[idx] = {
        ...list[idx],
        nome: nome ?? list[idx].nome,
        instagram: instagram ?? list[idx].instagram,
        telefone: telefone ?? list[idx].telefone,
      };
      await saveList(list);
      return res.status(200).json(list[idx]);
    }

    if (req.method === 'DELETE') {
      if (!checkAdmin(req, res)) return;
      const { id } = req.body || {};
      const next = list.filter((g) => g.id !== id);
      await saveList(next);
      return res.status(200).json({ ok: true });
    }

    return res.status(405).json({ error: 'Método não permitido.' });
  } catch (err) {
    console.error('Erro na API de convidados:', err);
    return res.status(500).json({ error: 'Erro interno ao acessar o banco de dados.' });
  }
}

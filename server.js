const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const port = Number(process.env.PORT || 3000);
const contentKey = 'landing';
const databaseUrl = process.env.DATABASE_URL || '';
const useSsl = process.env.PGSSLMODE === 'require' || /[?&]sslmode=require(?:&|$)/.test(databaseUrl);

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: '32kb' }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
}));
const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: '작성 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.' }
});
app.use(express.static(path.join(__dirname), { maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0 }));

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      ssl: useSsl ? { rejectUnauthorized: false } : undefined,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })
  : null;

const memory = { likes: new Set(), comments: [] };

async function initDatabase() {
  if (!pool) {
    if (process.env.RAILWAY_ENVIRONMENT) {
      throw new Error('Railway 배포 환경에 DATABASE_URL이 없습니다. PostgreSQL 변수 참조를 연결하세요.');
    }
    console.warn('DATABASE_URL이 없어 로컬 메모리 모드로 실행합니다. 재시작하면 데이터가 사라집니다.');
    return;
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id BIGSERIAL PRIMARY KEY,
      visitor_id VARCHAR(100) NOT NULL,
      name VARCHAR(20) NOT NULL,
      body VARCHAR(300) NOT NULL,
      is_visible BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS comments_created_at_idx ON comments (created_at DESC);
    CREATE TABLE IF NOT EXISTS likes (
      id BIGSERIAL PRIMARY KEY,
      content_key VARCHAR(100) NOT NULL DEFAULT 'landing',
      visitor_id VARCHAR(100) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (content_key, visitor_id)
    );
  `);
}

function cleanText(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function validVisitorId(value) {
  return /^[a-zA-Z0-9_-]{8,100}$/.test(value || '');
}

function formatTime(date) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(date));
}

async function getFeedback(visitorId) {
  if (!pool) {
    const comments = memory.comments.map(comment => ({
      ...comment,
      mine: comment.visitorId === visitorId
    }));
    return {
      likeCount: memory.likes.size,
      liked: memory.likes.has(visitorId),
      comments
    };
  }

  const [likes, liked, comments] = await Promise.all([
    pool.query('SELECT COUNT(*)::int AS count FROM likes WHERE content_key = $1', [contentKey]),
    pool.query('SELECT 1 FROM likes WHERE content_key = $1 AND visitor_id = $2 LIMIT 1', [contentKey, visitorId]),
    pool.query('SELECT id, visitor_id, name, body, created_at FROM comments WHERE is_visible = TRUE ORDER BY created_at DESC LIMIT 100')
  ]);

  return {
    likeCount: likes.rows[0].count,
    liked: liked.rowCount > 0,
    comments: comments.rows.map(row => ({
      id: String(row.id),
      name: row.name,
      text: row.body,
      time: formatTime(row.created_at),
      mine: row.visitor_id === visitorId
    }))
  };
}

app.get('/api/health', async (req, res) => {
  try {
    if (pool) await pool.query('SELECT 1');
    res.json({ ok: true, storage: pool ? 'postgres' : 'memory' });
  } catch (error) {
    console.error('헬스체크 실패:', error.message);
    res.status(503).json({ ok: false, storage: 'unavailable' });
  }
});

app.get('/api/feedback', async (req, res) => {
  const visitorId = cleanText(req.query.visitorId, 100);
  if (!validVisitorId(visitorId)) return res.status(400).json({ error: '유효하지 않은 방문자 ID입니다.' });
  try {
    res.json(await getFeedback(visitorId));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '피드백을 불러오지 못했습니다.' });
  }
});

app.post('/api/likes/toggle', writeLimiter, async (req, res) => {
  const visitorId = cleanText(req.body?.visitorId, 100);
  if (!validVisitorId(visitorId)) return res.status(400).json({ error: '유효하지 않은 방문자 ID입니다.' });
  try {
    let liked;
    if (!pool) {
      if (memory.likes.has(visitorId)) {
        memory.likes.delete(visitorId);
        liked = false;
      } else {
        memory.likes.add(visitorId);
        liked = true;
      }
    } else {
      const deleted = await pool.query(
        'DELETE FROM likes WHERE content_key = $1 AND visitor_id = $2 RETURNING id',
        [contentKey, visitorId]
      );
      if (deleted.rowCount) {
        liked = false;
      } else {
        const inserted = await pool.query(
          'INSERT INTO likes (content_key, visitor_id) VALUES ($1, $2) ON CONFLICT (content_key, visitor_id) DO NOTHING RETURNING id',
          [contentKey, visitorId]
        );
        liked = inserted.rowCount > 0;
      }
    }
    const feedback = await getFeedback(visitorId);
    res.json({ liked, likeCount: feedback.likeCount });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '좋아요를 저장하지 못했습니다.' });
  }
});

app.post('/api/comments', writeLimiter, async (req, res) => {
  const visitorId = cleanText(req.body?.visitorId, 100);
  const name = cleanText(req.body?.name, 20) || '익명 사장님';
  const text = cleanText(req.body?.text, 300);
  const website = cleanText(req.body?.website, 200);
  if (website) return res.status(204).end();
  if (!validVisitorId(visitorId)) return res.status(400).json({ error: '유효하지 않은 방문자 ID입니다.' });
  if (!text) return res.status(400).json({ error: '댓글 내용을 입력해 주세요.' });
  if ((text.match(/https?:\/\//gi) || []).length > 2) return res.status(400).json({ error: '댓글에 링크를 2개보다 많이 넣을 수 없습니다.' });
  try {
    if (!pool) {
      const comment = { id: `memory-${Date.now()}`, visitorId, name, text, time: '방금 전', mine: true };
      memory.comments.unshift(comment);
      return res.status(201).json(comment);
    }
    const result = await pool.query(
      'INSERT INTO comments (visitor_id, name, body) VALUES ($1, $2, $3) RETURNING id, name, body, created_at',
      [visitorId, name, text]
    );
    const row = result.rows[0];
    res.status(201).json({ id: String(row.id), name: row.name, text: row.body, time: formatTime(row.created_at), mine: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '댓글을 저장하지 못했습니다.' });
  }
});

app.delete('/api/comments/:id', writeLimiter, async (req, res) => {
  const visitorId = cleanText(req.body?.visitorId || req.headers['x-visitor-id'], 100);
  const id = cleanText(req.params.id, 30);
  if (!validVisitorId(visitorId)) return res.status(400).json({ error: '유효하지 않은 방문자 ID입니다.' });
  if (pool && !/^\d+$/.test(id)) return res.status(400).json({ error: '유효하지 않은 댓글 ID입니다.' });
  try {
    if (!pool) {
      const before = memory.comments.length;
      memory.comments = memory.comments.filter(comment => !(comment.id === id && comment.visitorId === visitorId));
      return res.json({ deleted: memory.comments.length < before });
    }
    const result = await pool.query('DELETE FROM comments WHERE id = $1 AND visitor_id = $2', [id, visitorId]);
    res.json({ deleted: result.rowCount > 0 });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: '댓글을 삭제하지 못했습니다.' });
  }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

let server;
initDatabase()
  .then(() => {
    server = app.listen(port, '0.0.0.0', () => console.log(`MarginGuard running on port ${port}`));
  })
  .catch(error => {
    console.error('데이터베이스 초기화 실패:', error);
    process.exit(1);
  });

async function shutdown(signal) {
  console.log(`${signal} 수신: 서버를 안전하게 종료합니다.`);
  if (server) server.close();
  if (pool) await pool.end();
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

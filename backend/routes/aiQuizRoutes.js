// backend/routes/aiQuizRoutes.js
import express from 'express';
import axios from 'axios';
import Class from '../models/Class.js';
import { auth } from '../middleware/auth.js';

const aiQuizRouter = express.Router();

// ============================================================
// CONFIG (env-overridable)
// ============================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const MODEL_CHAIN = [
  process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite'
];

const MAX_PROMPT_CHARS   = 2000;
const MIN_PROMPT_CHARS   = 10;
const MIN_QUESTIONS      = 1;
const MAX_QUESTIONS      = 20;
const REQUEST_TIMEOUT_MS = 30000;

const RATE_LIMIT_MAX     = 10;
const RATE_LIMIT_WINDOW  = 15 * 60 * 1000; // 15 minutes

// ============================================================
// IN-MEMORY RATE LIMITER (per req.user.id)
// ============================================================
const rateBuckets = new Map();

function checkRateLimit(userId) {
  const key = String(userId);
  const now = Date.now();
  const bucket = rateBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000)
    };
  }
  bucket.count += 1;
  return { allowed: true };
}

// ============================================================
// SANITIZATION (same escaping as lesson route)
// ============================================================
function sanitizeText(input) {
  if (typeof input !== 'string') return '';
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim();
}

// ============================================================
// PROMPT BUILDER
// ============================================================
function buildPrompt(classData, instructorPrompt, options) {
  const count = Math.min(Math.max(parseInt(options?.count) || 5, MIN_QUESTIONS), MAX_QUESTIONS);

  const classContext = [
    `Class title: ${classData.title || 'Untitled'}`,
    classData.category ? `Subject area: ${classData.category}` : '',
    classData.level    ? `Class level: ${classData.level}` : '',
    classData.shortDescription ? `Class summary: ${classData.shortDescription}` : '',
    classData.learningOutcomes ? `Learning outcomes: ${classData.learningOutcomes}` : ''
  ].filter(Boolean).join('\n');

  const systemPrompt = `You are an assessment designer for FISSK Online Academy.
Generate exactly ${count} quiz questions in JSON.

${classContext}

Instructor's request:
"""${instructorPrompt}"""

REQUIREMENTS:
- Generate ONLY multiple-choice and true/false questions.
- For multiple-choice: include 4 plausible options, exactly one correct.
- For true/false: options MUST be exactly ["True", "False"].
- correctAnswer MUST be a NUMBER — the 0-based index of the correct option.
  * For multiple-choice with options ["A","B","C","D"], if C is correct, correctAnswer = 2.
  * For true/false where "True" is correct, correctAnswer = 0.
- Do NOT return the answer text. Return only the index number.
- Every question must have: type, question (text), options (array), correctAnswer (number), points (1-3, integer), explanation (1-2 sentences).
- Do NOT include any "matching", "ordering", "essay", "fill-in", or "multiple-answer" types.
- Plain text only — no HTML, no Markdown formatting symbols like ** or ##.
- Return ONLY the JSON object described by the schema.`;

  return systemPrompt;
}

// ============================================================
// VALIDATE ONE QUESTION
// Returns cleaned question object, or null if invalid.
// Rejects: wrong type, missing fields, correctAnswer out of range.
// ============================================================
function validateQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const type = raw.type;
  if (type !== 'multiple-choice' && type !== 'true-false') return null;

  const question = sanitizeText(raw.question).slice(0, 1000);
  if (!question) return null;

  let options = Array.isArray(raw.options) ? raw.options.map(o => sanitizeText(o).slice(0, 500)) : [];

  if (type === 'true-false') {
    options = ['True', 'False'];
  } else if (type === 'multiple-choice') {
    options = options.filter(o => o.length > 0).slice(0, 6);
    if (options.length < 2) return null;
  }

  const correctAnswer = raw.correctAnswer;
  if (typeof correctAnswer !== 'number' || !Number.isInteger(correctAnswer)) return null;
  if (correctAnswer < 0 || correctAnswer >= options.length) return null;

  const points = Number.isInteger(raw.points) && raw.points >= 1 && raw.points <= 10
    ? raw.points : 1;

  const explanation = sanitizeText(raw.explanation).slice(0, 1000);

  return { type, question, options, correctAnswer, points, explanation };
}

// ============================================================
// POST /api/quizzes/generate
// ============================================================
aiQuizRouter.post('/generate', auth, async (req, res) => {
  try {
    // ---- 1. Config ----
    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not set');
      return res.status(500).json({
        success: false,
        message: 'AI service is not configured. Please contact support.'
      });
    }

    // ---- 2. Input validation ----
    const { classId, prompt, options } = req.body || {};

    if (!classId || typeof classId !== 'string') {
      return res.status(400).json({ success: false, message: 'classId is required' });
    }
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, message: 'prompt is required' });
    }
    const trimmedPrompt = prompt.trim();
    if (trimmedPrompt.length < MIN_PROMPT_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Prompt must be at least ${MIN_PROMPT_CHARS} characters`
      });
    }
    if (trimmedPrompt.length > MAX_PROMPT_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Prompt must be under ${MAX_PROMPT_CHARS} characters`
      });
    }

    // ---- 3. Ownership check ----
    const classData = await Class.findById(classId);
    if (!classData) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }
    const instructorIdStr = classData.instructorId ? classData.instructorId.toString() : '';
    const userIdStr       = req.user.id ? req.user.id.toString() : '';
    const isInstructor    = instructorIdStr === userIdStr;
    const isAdmin         = req.user.user_type === 'admin';
    if (!isInstructor && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Only the class instructor can generate quizzes'
      });
    }

    // ---- 4. Rate limit ----
    const rl = checkRateLimit(req.user.id);
    if (!rl.allowed) {
      res.set('Retry-After', String(rl.retryAfterSec));
      return res.status(429).json({
        success: false,
        message: `Rate limit reached. Try again in ${rl.retryAfterSec} seconds.`
      });
    }

    // ---- 5. Build prompt ----
    const promptText = buildPrompt(classData, trimmedPrompt, options || {});

    // ---- 6. Gemini request ----
    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            questions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', enum: ['multiple-choice', 'true-false'] },
                  question: { type: 'string' },
                  options: { type: 'array', items: { type: 'string' } },
                  correctAnswer: { type: 'number' },
                  points: { type: 'number' },
                  explanation: { type: 'string' }
                },
                required: ['type', 'question', 'options', 'correctAnswer', 'points', 'explanation']
              }
            }
          },
          required: ['questions']
        }
      }
    };

    // ---- 7. Fallback call chain ----
    let geminiResponse = null;
    let lastError = null;

    for (const model of MODEL_CHAIN) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      try {
        console.log(`[AI-Quiz] Trying model: ${model}`);
        geminiResponse = await axios.post(
          `${geminiUrl}?key=${GEMINI_API_KEY}`,
          requestBody,
          { timeout: REQUEST_TIMEOUT_MS, headers: { 'Content-Type': 'application/json' } }
        );
        console.log(`[AI-Quiz] Success with model: ${model}`);
        break;
      } catch (err) {
        lastError = err;
        const status = err.response?.status;
        const detail = err.response?.data?.error?.message || err.message;
        console.warn(`[AI-Quiz] Model ${model} failed (${status || 'N/A'}):`, detail);
        if (status && status !== 429 && status < 500) break;
      }
    }

    if (!geminiResponse) {
      const status = lastError?.response?.status;
      const isTimeout = lastError?.code === 'ECONNABORTED' || lastError?.code === 'ETIMEDOUT';
      if (isTimeout) {
        return res.status(504).json({ success: false, message: 'AI request timed out. Please try again.' });
      }
      if (status === 429) {
        return res.status(429).json({ success: false, message: 'AI service is busy. Please try again in a moment.' });
      }
      if (status >= 400 && status < 500) {
        return res.status(502).json({ success: false, message: 'AI request rejected. Please check your prompt and try again.' });
      }
      return res.status(502).json({ success: false, message: 'AI service is unavailable. Please try again.' });
    }

    // ---- 8. Extract JSON ----
    const candidate = geminiResponse.data?.candidates?.[0];
    const parts     = candidate?.content?.parts || [];
    const rawText   = parts.map(p => p.text || '').join('');

    if (!rawText) {
      return res.status(502).json({ success: false, message: 'AI returned an empty response. Please try again.' });
    }

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch (parseErr) {
      console.error('AI JSON parse failed. Raw:', rawText.slice(0, 500));
      return res.status(502).json({ success: false, message: 'AI returned invalid content. Please try again.' });
    }

    // ---- 9. Validate questions ----
    const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
    if (rawQuestions.length === 0) {
      return res.status(502).json({ success: false, message: 'AI returned no questions. Please try again.' });
    }

    const cleanQuestions = [];
    let rejectedCount = 0;
    for (const raw of rawQuestions) {
      const q = validateQuestion(raw);
      if (q) {
        cleanQuestions.push(q);
      } else {
        rejectedCount++;
      }
    }

    if (cleanQuestions.length === 0) {
      return res.status(502).json({
        success: false,
        message: 'AI returned questions in an invalid format. Please try again.'
      });
    }

    // ---- 10. Return draft (no DB write) ----
    return res.json({
      success: true,
      draft: {
        questions: cleanQuestions,
        rejectedCount
      }
    });

  } catch (error) {
    console.error('AI quiz generate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Something went wrong generating the quiz. Please try again.'
    });
  }
});

export default aiQuizRouter;
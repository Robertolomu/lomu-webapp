const express = require('express');
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SHEETS_CSV_URL = process.env.SHEETS_CSV_URL;

if (!ANTHROPIC_API_KEY) throw new Error('Falta ANTHROPIC_API_KEY');
if (!SHEETS_CSV_URL) throw new Error('Falta SHEETS_CSV_URL');

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

async function fetchSheetData() {
  const response = await axios.get(SHEETS_CSV_URL, { timeout: 10000 });
  const records = parse(response.data, { columns: true, skip_empty_lines: true, trim: true });
  return records;
}

function formatDataForPrompt(records) {
  if (!records || records.length === 0) return 'No hay datos disponibles.';
  const headers = Object.keys(records[0]).join(' | ');
  const rows = records.map(r => Object.values(r).join(' | ')).join('\n');
  return headers + '\n' + rows;
}

app.post('/api/chat', async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Mensaje requerido' });
  try {
    const records = await fetchSheetData();
    const tableText = formatDataForPrompt(records);
    const systemPrompt = `Eres el asistente de mantenimiento vehicular de la empresa LOMU (Transportes y Maquinarias).
Respondes preguntas sobre el estado y programacion de mantenimientos de la flota.

Datos actualizados de mantenimiento:
${tableText}

Reglas:
- Responde siempre en espanol.
- Se conciso y directo.
- Busca la placa exacta en los datos (busca coincidencias parciales tambien).
- Formatea las fechas de manera legible (ej: 7 de junio de 2026).
- Si no encuentras la placa, dilo claramente y lista las placas disponibles.
- No inventes datos que no esten en la tabla.
- Si hay multiples registros para una placa, muestralos todos.`;

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    });
    res.json({ reply: response.content[0].text });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('LOMU Mantenimiento en puerto ' + PORT));

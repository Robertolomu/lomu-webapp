const express = require('express');
const axios = require('axios');
const { parse } = require('csv-parse/sync');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SHEETS_CSV_URL = process.env.SHEETS_CSV_URL;

if (!GEMINI_API_KEY) throw new Error('Falta GEMINI_API_KEY');
if (!SHEETS_CSV_URL) throw new Error('Falta SHEETS_CSV_URL');

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

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

Datos actualizados:
${tableText}

Reglas: responde en espanol, busca placa exacta, lista todos los registros, no inventes datos.`;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', systemInstruction: systemPrompt });
    const result = await model.generateContent(message);
    const reply = result.response.text();
    res.json({ reply });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error: ' + err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('LOMU en puerto ' + PORT));

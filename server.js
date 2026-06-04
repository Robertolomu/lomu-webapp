const express = require('express');
const axios = require('axios');
const { parse } = require('csv-parse/sync');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const SHEETS_CSV_URL = process.env.SHEETS_CSV_URL;

if (!GEMINI_API_KEY) throw new Error('Falta GEMINI_API_KEY');
if (!SHEETS_CSV_URL) throw new Error('Falta SHEETS_CSV_URL');

async function fetchSheetData() {
    const response = await axios.get(SHEETS_CSV_URL, { timeout: 10000 });
    return parse(response.data, { columns: true, skip_empty_lines: true, trim: true });
}

function formatData(records) {
    if (!records || records.length === 0) return 'Sin datos.';
    return Object.keys(records[0]).join(' | ') + '\n' + records.map(r => Object.values(r).join(' | ')).join('\n');
}

app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: 'Mensaje requerido' });
    try {
          const records = await fetchSheetData();
          const tableText = formatData(records);
          const prompt = `Eres asistente de mantenimiento vehicular de LOMU (Transportes y Maquinarias). Respondes preguntas sobre el estado y programacion de mantenimientos de la flota.

          Datos actualizados de mantenimiento:
          ${tableText}

          Reglas:
          - Responde siempre en espanol.
          - Se conciso y directo.
          - Si preguntan por una placa, busca exactamente esa placa en los datos.
          - Formatea las fechas de manera legible.
          - Si no encuentras informacion de una placa, dilo claramente.
          - Puedes listar multiples registros si hay mas de uno para la misma placa.
          - No inventes datos que no esten en la tabla.

          Pregunta: ${message}`;

      const resp = await axios.post(
              `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        { contents: [{ parts: [{ text: prompt }] }] },
        { headers: { 'Content-Type': 'application/json' }, timeout: 30000 }
            );
          const reply = resp.data.candidates[0].content.parts[0].text;
          res.json({ reply });
    } catch (err) {
          console.error(err.response ? JSON.stringify(err.response.data) : err.message);
          res.status(500).json({ error: 'Error: ' + (err.response ? JSON.stringify(err.response.data) : err.message) });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('LOMU en puerto ' + PORT));

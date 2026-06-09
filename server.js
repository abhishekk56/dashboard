const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SMARTSHEET_BASE = 'https://api.smartsheet.com/2.0';

app.use(cors());
app.use(express.static(path.join(__dirname)));

function buildError(status, message) {
  return { error: true, status, message };
}

async function smartsheetFetch(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    const body = await response.text();
    const err = new Error(`Smartsheet API error ${response.status}: ${response.statusText}`);
    err.status = response.status;
    err.body = body;
    throw err;
  }

  return response.json();
}

app.get('/api/smartsheet', async (req, res) => {
  try {
    const sheetRef = (req.query.sheetRef || '').trim();
    const token = (req.query.token || process.env.SMARTSHEET_API_TOKEN || '').trim();

    if (!sheetRef) {
      return res.status(400).json(buildError(400, 'Missing sheetRef query parameter.'));
    }
    if (!token) {
      return res.status(400).json(buildError(400, 'Missing Smartsheet API token. Set SMARTSHEET_API_TOKEN or pass token query parameter.'));
    }

    let sheetId = sheetRef;
    if (!/^[0-9]+$/.test(sheetRef)) {
      const listUrl = `${SMARTSHEET_BASE}/sheets`;
      const listData = await smartsheetFetch(listUrl, token);
      const sheets = listData.data || listData.sheets || [];
      const match = sheets.find(sheet => sheet.name?.toLowerCase() === sheetRef.toLowerCase());
      if (!match) {
        return res.status(404).json(buildError(404, `Sheet named "${sheetRef}" not found. Use a sheet ID or verify the sheet name.`));
      }
      sheetId = match.id;
    }

    const sheetUrl = `${SMARTSHEET_BASE}/sheets/${sheetId}?include=columns,rows`;
    const sheetData = await smartsheetFetch(sheetUrl, token);
    return res.json(sheetData);
  } catch (error) {
    console.error(error);
    const status = error.status || 500;
    const message = error.message || 'Unexpected error while fetching Smartsheet data.';
    return res.status(status).json(buildError(status, message));
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

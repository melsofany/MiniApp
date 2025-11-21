import { google } from 'googleapis';
import type { Representative, NationalIdCard } from '@shared/schema';

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID || '15hjsS5SvoZP2Qlt4tBSnczR40yZcn3HD31lpqU_BtVs';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=google-sheet',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('Google Sheet not connected');
  }
  return accessToken;
}

async function getUncachableGoogleSheetClient() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    const serviceAccount = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });
    
    const authClient = await auth.getClient();
    return google.sheets({ version: 'v4', auth: authClient });
  } else {
    const accessToken = await getAccessToken();
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.sheets({ version: 'v4', auth: oauth2Client });
  }
}

export async function getAllRepresentatives(): Promise<Representative[]> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'USERS!A2:E',
    });

    const rows = response.data.values || [];
    return rows.map((row): Representative => ({
      userId: row[0] || '',
      username: row[1] || '',
      center: (row[2] as "طما" | "طهطا" | "جهينة") || 'طما',
      status: (row[3] as "نشط" | "غير نشط") || 'نشط',
      dateAdded: row[4] || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('CRITICAL: Error fetching representatives from Google Sheets:', error);
    throw new Error('فشل الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.');
  }
}

export async function getRepresentativeByUserId(userId: string): Promise<Representative | null> {
  const reps = await getAllRepresentatives();
  return reps.find(r => r.userId === userId) || null;
}

export async function addRepresentative(rep: Omit<Representative, 'dateAdded'>): Promise<void> {
  const sheets = await getUncachableGoogleSheetClient();
  const dateAdded = new Date().toISOString();
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'USERS!A:E',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[rep.userId, rep.username, rep.center, rep.status, dateAdded]],
    },
  });
}

export async function deleteRepresentative(userId: string): Promise<void> {
  const sheets = await getUncachableGoogleSheetClient();
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: 'USERS!A:A',
  });

  const rows = response.data.values || [];
  const rowIndex = rows.findIndex(row => row[0] === userId);
  
  if (rowIndex >= 0) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: 'ROWS',
              startIndex: rowIndex + 1,
              endIndex: rowIndex + 2,
            },
          },
        }],
      },
    });
  }
}

export async function getAllCards(): Promise<NationalIdCard[]> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'NATIONAL_ID_DATA!A2:F',
    });

    const rows = response.data.values || [];
    return rows.map((row): NationalIdCard => ({
      name: row[0] || '',
      nationalId: row[1] || '',
      insertedByUserId: row[2] || '',
      insertedByUsername: row[3] || '',
      center: (row[4] as "طما" | "طهطا" | "جهينة") || 'طما',
      insertionDate: row[5] || new Date().toISOString(),
    }));
  } catch (error) {
    console.error('CRITICAL: Error fetching cards from Google Sheets:', error);
    throw new Error('فشل الاتصال بقاعدة البيانات. يرجى المحاولة مرة أخرى.');
  }
}

export async function getCardByNationalId(nationalId: string): Promise<NationalIdCard | null> {
  const cards = await getAllCards();
  return cards.find(c => c.nationalId === nationalId) || null;
}

export async function addCard(card: Omit<NationalIdCard, 'insertionDate'>): Promise<void> {
  const sheets = await getUncachableGoogleSheetClient();
  const insertionDate = new Date().toISOString();
  
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: 'NATIONAL_ID_DATA!A:F',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        card.name,
        card.nationalId,
        card.insertedByUserId,
        card.insertedByUsername,
        card.center,
        insertionDate
      ]],
    },
  });
}

export async function ensureSheetsStructure(): Promise<void> {
  try {
    const sheets = await getUncachableGoogleSheetClient();
    
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets?.map(s => s.properties?.title) || [];
    
    const requests: any[] = [];
    
    if (!existingSheets.includes('USERS')) {
      requests.push({
        addSheet: {
          properties: {
            title: 'USERS',
          },
        },
      });
    }
    
    if (!existingSheets.includes('NATIONAL_ID_DATA')) {
      requests.push({
        addSheet: {
          properties: {
            title: 'NATIONAL_ID_DATA',
          },
        },
      });
    }

    if (requests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests,
        },
      });
      console.log('✓ Created missing sheets');
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'USERS!A1:E1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['USER_ID', 'USERNAME', 'CENTER', 'STATUS', 'DATE_ADDED']],
      },
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'NATIONAL_ID_DATA!A1:F1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [['NAME', 'NATIONAL_ID', 'INSERTED_BY_USERID', 'INSERTED_BY_USERNAME', 'CENTER', 'INSERTION_DATE']],
      },
    });

    console.log('✓ Google Sheets structure ensured');
  } catch (error) {
    console.error('Error ensuring sheets structure:', error);
  }
}


'use server';

import * as xlsx from 'xlsx';
import { findClientByPhone, saveClient, type Client } from '@/lib/clients';

export async function importClientsFromExcel(formData: FormData) {
    const file = formData.get('file') as File;
    if (!file) {
        return { error: 'לא נבחר קובץ.' };
    }

    try {
        const bytes = await file.arrayBuffer();
        const workbook = xlsx.read(bytes, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Explicitly set header to get an array of arrays
        const rawData: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        
        // Assuming first row is headers: שם, משפחה, נייד, דוא"ל
        // But based on the user's image, the headers are: שם, משפחה, נייד, דוא"ל
        // Let's find the header row first
        let headerRowIndex = rawData.findIndex(row => 
            row.some(cell => typeof cell === 'string' && cell.trim() === 'רשימת לקוחות')
        );

        if (headerRowIndex === -1) {
             headerRowIndex = 0; // fallback to first row
        } else {
             headerRowIndex += 1; // The actual headers are the row after "רשימת לקוחות"
        }
        
        const headers = rawData[headerRowIndex] as string[];
        const dataRows = rawData.slice(headerRowIndex + 1);

        const clientsToImport = dataRows.map(row => ({
            'שם': row[headers.indexOf('שם')],
            'משפחה': row[headers.indexOf('משפחה')],
            'נייד': row[headers.indexOf('נייד')],
            'דוא"ל': row[headers.indexOf('דוא"ל')]
        })).filter(client => client['נייד']); // Filter out rows without a phone number

        let importedCount = 0;
        let skippedCount = 0;

        for (const clientData of clientsToImport) {
            const sanitizedPhone = String(clientData['נייד'] || '').replace(/\D/g, '');
            if (!sanitizedPhone) {
                continue;
            }

            const existingClient = await findClientByPhone(sanitizedPhone);
            
            if (existingClient) {
                skippedCount++;
                continue;
            }

            const newClient: Omit<Client, 'id' | 'createdAt' | 'updatedAt'> = {
                businessId: 'default',
                firstName: String(clientData['שם'] || '').trim(),
                lastName: String(clientData['משפחה'] || '').trim(),
                phone: sanitizedPhone,
                email: String(clientData['דוא"ל'] || '').trim(),
                gender: 'female',
                isBlocked: false,
                receivesSms: true,
            };

            await saveClient(newClient);
            importedCount++;
        }

        return { success: `ייבוא הושלם! ${importedCount} לקוחות חדשים נוספו. ${skippedCount} לקוחות כפולים דולגו.` };

    } catch (error) {
        console.error('Error importing from Excel:', error);
        return { error: 'אירעה שגיאה בעיבוד הקובץ. ודא שהפורמט תקין.' };
    }
}

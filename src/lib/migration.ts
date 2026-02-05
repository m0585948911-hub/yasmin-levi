'use client';

import { collection, doc, writeBatch, getDocs, setDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Client, FamilyRelation } from './clients';
import type { FilledFormInstance } from './form-templates';

// These types are based on the old localStorage structure
interface OldUploadedFile {
  id: string;
  name: string;
  fileName: string;
  dataUrl: string;
  usageCount: number;
}
type OldFormAssociation = { [formId: string]: string[] };
type OldFamilyRelationsData = {
  [clientId: string]: FamilyRelation[];
};

export async function migrateLocalStorageToFirestore(
    setMigrationProgress: (message: string) => void
): Promise<{ success: boolean; message: string }> {
    try {
        setMigrationProgress('מתחיל בהעברת נתונים... אנא המתן.');

        const batch = writeBatch(db);
        let updatesCounter = 0;

        // Fetch all clients to have their data for context
        setMigrationProgress('טוען את רשימת הלקוחות...');
        const clientsSnapshot = await getDocs(collection(db, 'clients'));
        const allClientIds = clientsSnapshot.docs.map(d => d.id);

        // --- 1. Migrate Treatment History (formInstances) ---
        setMigrationProgress('מעביר היסטוריית טיפולים...');
        for (const clientId of allClientIds) {
            const historyKey = `clientTreatmentHistory_${clientId}`;
            try {
                const historyData = localStorage.getItem(historyKey);
                if (historyData) {
                    const history = JSON.parse(historyData) as FilledFormInstance[];
                    history.forEach(instance => {
                        const docRef = doc(db, 'formInstances', instance.instanceId);
                        const { instanceId, ...dataToSave } = instance;
                        
                        // Convert date strings back to Timestamps if they exist
                        const saveData: any = { ...dataToSave };
                        if (saveData.assignedAt) saveData.assignedAt = Timestamp.fromDate(new Date(saveData.assignedAt));
                        if (saveData.filledAt) saveData.filledAt = Timestamp.fromDate(new Date(saveData.filledAt));

                        batch.set(docRef, saveData, { merge: true });
                        updatesCounter++;
                    });
                    setMigrationProgress(`הועברה היסטוריה עבור לקוח ${clientId}`);
                }
            } catch (e) { console.error(`Failed to parse/migrate ${historyKey}`, e)}
        }
        
        // --- 2. Migrate Manual Media ---
        setMigrationProgress('מעביר קבצי מדיה...');
        for (const clientId of allClientIds) {
             const mediaKey = `manualMedia_${clientId}`;
             try {
                const mediaData = localStorage.getItem(mediaKey);
                if (mediaData) {
                    const mediaItems = JSON.parse(mediaData) as any[];
                    mediaItems.forEach(item => {
                        const docRef = doc(collection(db, 'clients', clientId, 'manualMedia'), item.id);
                        batch.set(docRef, item);
                        updatesCounter++;
                    });
                    setMigrationProgress(`הועברה מדיה עבור לקוח ${clientId}`);
                }
             } catch(e) { console.error(`Failed to parse/migrate ${mediaKey}`, e)}
        }

        // --- 3. Migrate Family Relations ---
        setMigrationProgress('מעביר קשרי משפחה...');
        try {
            const familyRelationsData = localStorage.getItem('familyRelations');
            if (familyRelationsData) {
                const relations = JSON.parse(familyRelationsData) as OldFamilyRelationsData;
                for (const [clientId, clientRelations] of Object.entries(relations)) {
                    if (clientRelations.length > 0) {
                        const clientRef = doc(db, 'clients', clientId);
                        batch.update(clientRef, { familyRelations: clientRelations });
                        updatesCounter++;
                    }
                }
            }
        } catch(e) { console.error('Failed to parse/migrate familyRelations', e)}
        
        setMigrationProgress(`מבצע שמירה של ${updatesCounter} עדכונים...`);
        if (updatesCounter > 0) {
            await batch.commit();
        }

        // Mark migration as complete
        localStorage.setItem('data_migration_completed_v2', 'true');
        setMigrationProgress('ההעברה הושלמה בהצלחה!');

        return { success: true, message: `העברה הושלמה! ${updatesCounter} פריטים עודכנו.` };

    } catch (error: any) {
        console.error("Data migration failed:", error);
        setMigrationProgress(`אירעה שגיאה: ${error.message}`);
        return { success: false, message: `ההעברה נכשלה: ${error.message}` };
    }
}

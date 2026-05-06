import { ipcMain } from 'electron';
import {
  generatePrivacyPolicy,
  generateTermsOfService,
  generatePrivacyInfoXcprivacy,
  generateStoreMetadata,
  generateSubmissionChecklist,
  saveStoreAssets,
  type AppMetadata,
  type StoreAssets,
} from '../services/store-publisher';

export function registerBuilderHandlers() {
  // Generate individual assets
  ipcMain.handle('builder:gen-privacy-policy', async (_e, meta: AppMetadata) => {
    try {
      const html = await generatePrivacyPolicy(meta);
      return { success: true, content: html };
    } catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  });

  ipcMain.handle('builder:gen-terms', async (_e, meta: AppMetadata) => {
    try {
      const html = await generateTermsOfService(meta);
      return { success: true, content: html };
    } catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  });

  ipcMain.handle('builder:gen-privacy-info', async (_e, meta: AppMetadata) => {
    const xml = generatePrivacyInfoXcprivacy(meta);
    return { success: true, content: xml };
  });

  ipcMain.handle('builder:gen-store-metadata', async (_e, meta: AppMetadata) => {
    try {
      const metadata = await generateStoreMetadata(meta);
      return { success: true, metadata };
    } catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  });

  ipcMain.handle('builder:gen-checklist', async (_e, meta: AppMetadata) => {
    try {
      const checklist = await generateSubmissionChecklist(meta);
      return { success: true, content: checklist };
    } catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  });

  // Generate all assets at once
  ipcMain.handle('builder:gen-all-store-assets', async (_e, { meta, projectDir }: { meta: AppMetadata; projectDir: string }) => {
    try {
      const [privacyPolicy, termsOfService, storeMetadata, checklist] = await Promise.all([
        generatePrivacyPolicy(meta),
        generateTermsOfService(meta),
        generateStoreMetadata(meta),
        generateSubmissionChecklist(meta),
      ]);
      const privacyInfo = generatePrivacyInfoXcprivacy(meta);

      const assets: StoreAssets = { privacyPolicy, termsOfService, privacyInfo, storeMetadata, checklist };
      const savedDir = saveStoreAssets(projectDir, assets);

      return { success: true, savedDir, assets: {
        privacyPolicyLength: privacyPolicy.length,
        termsLength: termsOfService.length,
        hasMetadata: true,
        hasChecklist: true,
        hasPrivacyInfo: true,
      }};
    } catch (e: unknown) { return { success: false, error: (e as Error).message }; }
  });
}

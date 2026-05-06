import { chat, type AIModel } from './ai-client';
import fs from 'fs';
import path from 'path';

// ── Types ──

export interface AppMetadata {
  appName: string;
  bundleId: string;
  description: string;
  platform: 'ios' | 'macos' | 'android' | 'electron' | 'capacitor' | 'flutter';
  developerName: string;
  developerEmail: string;
  websiteUrl?: string;
  category?: string;
  language?: string; // 'en' | 'ja'
}

export interface StoreAssets {
  privacyPolicy?: string;    // HTML
  termsOfService?: string;   // HTML
  privacyInfo?: string;      // XML (PrivacyInfo.xcprivacy)
  storeMetadata?: StoreMetadataJson;
  checklist?: string;        // Markdown
}

export interface StoreMetadataJson {
  shortDescription: string;
  fullDescription: string;
  keywords: string;
  whatsNew: string;
  category: string;
  ageRating: string;
}

// ── Generators ──

const MODEL: AIModel = 'claude-sonnet-4-6';

export async function generatePrivacyPolicy(meta: AppMetadata): Promise<string> {
  const lang = meta.language || 'en';
  const response = await chat({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `Generate a Privacy Policy for:
- App Name: ${meta.appName}
- Bundle ID: ${meta.bundleId}
- Description: ${meta.description}
- Developer: ${meta.developerName} (${meta.developerEmail})
- Website: ${meta.websiteUrl || 'N/A'}

Include sections: Data Collection, Data Usage, Third-Party Services, Data Retention, User Rights (GDPR/CCPA), Children's Privacy, Changes, Contact.

Output as clean, standalone HTML with inline CSS. Language: ${lang === 'ja' ? 'Japanese' : 'English'}.`,
    }],
    systemPrompt: 'Generate a professional, legally sound privacy policy as valid HTML. Include proper meta tags and responsive styling.',
    maxTokens: 4096,
  });
  return response.content;
}

export async function generateTermsOfService(meta: AppMetadata): Promise<string> {
  const lang = meta.language || 'en';
  const response = await chat({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `Generate Terms of Service for:
- App Name: ${meta.appName}
- Developer: ${meta.developerName}
- Description: ${meta.description}

Include: Acceptance, License, Restrictions, Intellectual Property, User Content, Disclaimers, Limitation of Liability, Termination, Governing Law (Japan), Contact.

Output as standalone HTML. Language: ${lang === 'ja' ? 'Japanese' : 'English'}.`,
    }],
    systemPrompt: 'Generate professional Terms of Service as valid HTML with inline CSS.',
    maxTokens: 4096,
  });
  return response.content;
}

export function generatePrivacyInfoXcprivacy(meta: AppMetadata): string {
  // Standard PrivacyInfo.xcprivacy for apps that collect basic analytics
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyTrackingDomains</key>
  <array/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <dict>
      <key>NSPrivacyCollectedDataType</key>
      <string>NSPrivacyCollectedDataTypeDeviceID</string>
      <key>NSPrivacyCollectedDataTypeLinked</key>
      <false/>
      <key>NSPrivacyCollectedDataTypeTracking</key>
      <false/>
      <key>NSPrivacyCollectedDataTypePurposes</key>
      <array>
        <string>NSPrivacyCollectedDataTypePurposeAnalytics</string>
      </array>
    </dict>
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryUserDefaults</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>CA92.1</string>
      </array>
    </dict>
    <dict>
      <key>NSPrivacyAccessedAPIType</key>
      <string>NSPrivacyAccessedAPICategoryFileTimestamp</string>
      <key>NSPrivacyAccessedAPITypeReasons</key>
      <array>
        <string>C617.1</string>
      </array>
    </dict>
  </array>
</dict>
</plist>`;
}

export async function generateStoreMetadata(meta: AppMetadata): Promise<StoreMetadataJson> {
  const lang = meta.language || 'en';
  const response = await chat({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `Generate App Store / Google Play metadata for:
- App Name: ${meta.appName}
- Description: ${meta.description}
- Category: ${meta.category || 'auto-detect'}
- Platform: ${meta.platform}

Provide as JSON:
{
  "shortDescription": "(80 chars max)",
  "fullDescription": "(4000 chars max, with line breaks)",
  "keywords": "(100 chars, comma-separated)",
  "whatsNew": "(release notes for v1.0)",
  "category": "(App Store category)",
  "ageRating": "(4+, 9+, 12+, 17+ with justification)"
}

Language: ${lang === 'ja' ? 'Japanese' : 'English'}. Make it ASO-optimized.`,
    }],
    systemPrompt: 'Generate compelling, ASO-optimized metadata. Output ONLY valid JSON, no markdown.',
    maxTokens: 2048,
  });

  try {
    // Extract JSON from response (might be wrapped in code block)
    const jsonStr = response.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    return JSON.parse(jsonStr);
  } catch {
    return {
      shortDescription: meta.description.slice(0, 80),
      fullDescription: meta.description,
      keywords: meta.appName.toLowerCase(),
      whatsNew: 'Initial release',
      category: meta.category || 'Utilities',
      ageRating: '4+',
    };
  }
}

export async function generateSubmissionChecklist(meta: AppMetadata): Promise<string> {
  const response = await chat({
    model: MODEL,
    messages: [{
      role: 'user',
      content: `Create an App Store submission checklist for:
- App: ${meta.appName} (${meta.bundleId})
- Platform: ${meta.platform}
- Developer: ${meta.developerName}

Include:
1. Required assets (icons with sizes, screenshots with dimensions per device)
2. Required files (Info.plist keys, entitlements, PrivacyInfo.xcprivacy)
3. Certificates & provisioning profiles
4. Review guidelines to verify
5. Common rejection reasons to avoid
6. Pre-submission testing checklist

Output as Markdown checklist with [ ] boxes.`,
    }],
    systemPrompt: 'Create a thorough, actionable checklist. Be specific about sizes, formats, and requirements.',
    maxTokens: 3000,
  });
  return response.content;
}

// ── Save Assets to Project ──

export function saveStoreAssets(projectDir: string, assets: StoreAssets) {
  const storeDir = path.join(projectDir, 'store-assets');
  fs.mkdirSync(storeDir, { recursive: true });

  if (assets.privacyPolicy) {
    fs.writeFileSync(path.join(storeDir, 'privacy-policy.html'), assets.privacyPolicy, 'utf-8');
  }
  if (assets.termsOfService) {
    fs.writeFileSync(path.join(storeDir, 'terms-of-service.html'), assets.termsOfService, 'utf-8');
  }
  if (assets.privacyInfo) {
    fs.writeFileSync(path.join(storeDir, 'PrivacyInfo.xcprivacy'), assets.privacyInfo, 'utf-8');
  }
  if (assets.storeMetadata) {
    fs.writeFileSync(path.join(storeDir, 'store-metadata.json'), JSON.stringify(assets.storeMetadata, null, 2), 'utf-8');
  }
  if (assets.checklist) {
    fs.writeFileSync(path.join(storeDir, 'submission-checklist.md'), assets.checklist, 'utf-8');
  }

  return storeDir;
}

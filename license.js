const fs = require('fs');
const path = require('path');
const os = require('os');

const APP_DIR = path.join(os.homedir(), '.code-harness');
const LICENSE_PATH = path.join(APP_DIR, 'license.json');

// ── Free vs Pro feature definitions ──
const FREE_FEATURES = {
  maxTabs: 3,
  maxProjects: 3,
  aiderMode: false,
  hooksEdit: false,
  memoryEdit: false,
  builderTemplates: ['build-saas', 'build-lp', 'build-blog', 'build-portfolio', 'build-pwa'],
};

const PRO_FEATURES = {
  maxTabs: Infinity,
  maxProjects: Infinity,
  aiderMode: true,
  hooksEdit: true,
  memoryEdit: true,
  builderTemplates: 'all',
};

function readLicense() {
  try {
    if (fs.existsSync(LICENSE_PATH)) {
      return JSON.parse(fs.readFileSync(LICENSE_PATH, 'utf-8'));
    }
  } catch (_) {}
  return null;
}

function saveLicense(data) {
  fs.mkdirSync(APP_DIR, { recursive: true });
  fs.writeFileSync(LICENSE_PATH, JSON.stringify(data, null, 2));
}

function removeLicense() {
  try {
    if (fs.existsSync(LICENSE_PATH)) fs.unlinkSync(LICENSE_PATH);
  } catch (_) {}
}

function isPro() {
  const license = readLicense();
  return !!license?.valid;
}

function getFeatures() {
  return isPro() ? PRO_FEATURES : FREE_FEATURES;
}

function getLicenseStatus() {
  const license = readLicense();
  if (license?.valid) {
    return {
      isPro: true,
      key: license.key ? license.key.slice(0, 8) + '...' : '',
      activatedAt: license.activatedAt || '',
    };
  }
  return { isPro: false, key: '', activatedAt: '' };
}

async function activateLicense(licenseKey) {
  try {
    // Step 1: Try to activate
    const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        license_key: licenseKey,
        instance_name: `code-harness-${Date.now()}`,
      }),
    });

    const data = await res.json();

    if (data.activated || data.meta?.store_id) {
      const licenseData = {
        key: licenseKey,
        valid: true,
        activatedAt: new Date().toISOString(),
        instanceId: data.instance?.id || null,
      };
      saveLicense(licenseData);
      return { success: true };
    }

    // Step 2: If already activated, validate instead
    if (data.error === 'license_key_already_activated' || res.status === 422) {
      const validateRes = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey }),
      });
      const validateData = await validateRes.json();
      if (validateData.valid) {
        const licenseData = {
          key: licenseKey,
          valid: true,
          activatedAt: new Date().toISOString(),
        };
        saveLicense(licenseData);
        return { success: true };
      }
    }

    return { success: false, error: data.error || 'Invalid license key' };
  } catch (e) {
    return { success: false, error: 'Could not connect to license server.' };
  }
}

function deactivateLicense() {
  removeLicense();
  return { success: true };
}

module.exports = {
  readLicense,
  saveLicense,
  removeLicense,
  isPro,
  getFeatures,
  getLicenseStatus,
  activateLicense,
  deactivateLicense,
  FREE_FEATURES,
  PRO_FEATURES,
};

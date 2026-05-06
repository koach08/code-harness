import type { StepType, StepConfig } from '../services/pipeline-engine';

export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  category: 'app-dev' | 'saas' | 'store' | 'custom';
  variables: Array<{
    key: string;
    label: string;
    placeholder: string;
    required: boolean;
  }>;
  steps: Array<{
    name: string;
    type: StepType;
    config: StepConfig;
  }>;
}

export const PIPELINE_TEMPLATES: PipelineTemplate[] = [
  // ── Full App Development ──
  {
    id: 'full-app',
    name: 'Full App Development',
    description: 'Scaffold, develop, test, review, and deploy an application',
    category: 'app-dev',
    variables: [
      { key: 'appName', label: 'App Name', placeholder: 'my-app', required: true },
      { key: 'appDescription', label: 'Description', placeholder: 'A Next.js app that...', required: true },
      { key: 'framework', label: 'Framework', placeholder: 'next.js', required: false },
    ],
    steps: [
      {
        name: 'Scaffold Project',
        type: 'claude-code',
        config: {
          prompt: 'Create a new {{framework}} project called "{{appName}}". {{appDescription}}. Set up the project structure with TypeScript, Tailwind CSS, and a clean initial page.',
          timeout: 300,
        },
      },
      {
        name: 'Install Dependencies',
        type: 'shell',
        config: {
          command: 'cd {{appName}} && npm install',
          timeout: 120,
        },
      },
      {
        name: 'Implement Core Features',
        type: 'claude-code',
        config: {
          prompt: 'Implement the core features for {{appName}}: {{appDescription}}. Make it production-ready with proper error handling and responsive design.',
          cwd: '{{appName}}',
          timeout: 600,
        },
      },
      {
        name: 'Run Tests',
        type: 'condition',
        config: {
          checkCommand: 'cd {{appName}} && npm test --passWithNoTests 2>&1 || true',
          timeout: 120,
        },
      },
      {
        name: 'Code Review (Codex)',
        type: 'codex',
        config: {
          prompt: 'Review the codebase for bugs, security issues, and code quality. Fix any critical issues found.',
          cwd: '{{appName}}',
          timeout: 300,
        },
      },
      {
        name: 'Build Check',
        type: 'shell',
        config: {
          command: 'cd {{appName}} && npm run build',
          timeout: 180,
        },
      },
      {
        name: 'Review Before Deploy',
        type: 'gate',
        config: {
          gateMessage: 'Build successful. Review the app locally before deploying. Approve to deploy to Vercel.',
        },
      },
      {
        name: 'Deploy to Vercel',
        type: 'shell',
        config: {
          command: 'cd {{appName}} && npx vercel --yes 2>&1',
          timeout: 180,
        },
      },
    ],
  },

  // ── SaaS Launch ──
  {
    id: 'saas-launch',
    name: 'SaaS Launch',
    description: 'Full SaaS setup: Next.js + Supabase + Stripe + Vercel',
    category: 'saas',
    variables: [
      { key: 'appName', label: 'App Name', placeholder: 'my-saas', required: true },
      { key: 'appDescription', label: 'What does it do?', placeholder: 'A subscription-based...', required: true },
      { key: 'domain', label: 'Domain (optional)', placeholder: 'my-saas.com', required: false },
      { key: 'priceMonthly', label: 'Monthly Price (JPY)', placeholder: '980', required: false },
    ],
    steps: [
      {
        name: 'Scaffold SaaS Project',
        type: 'claude-code',
        config: {
          prompt: 'Create a new Next.js 16 SaaS project "{{appName}}": {{appDescription}}. Include TypeScript, Tailwind CSS 4, shadcn/ui, and a clean landing page with pricing section. Set up the folder structure for auth, dashboard, and API routes.',
          timeout: 300,
        },
      },
      {
        name: 'Install Dependencies',
        type: 'shell',
        config: {
          command: 'cd {{appName}} && npm install @supabase/supabase-js @supabase/ssr stripe @stripe/stripe-js',
          timeout: 120,
        },
      },
      {
        name: 'Set Up Supabase Auth',
        type: 'claude-code',
        config: {
          prompt: 'Set up Supabase authentication for {{appName}}: create auth helpers (client/server), middleware for protected routes, login/signup pages, and basic RLS policies. Use @supabase/ssr for server-side auth.',
          cwd: '{{appName}}',
          timeout: 300,
        },
      },
      {
        name: 'Set Up Stripe Payments',
        type: 'claude-code',
        config: {
          prompt: 'Add Stripe subscription payments to {{appName}}: checkout session API route, webhook handler (/api/webhook/stripe), customer portal link, and pricing page with {{priceMonthly}} JPY/month plan. Store subscription status in Supabase.',
          cwd: '{{appName}}',
          timeout: 300,
        },
      },
      {
        name: 'Implement Dashboard',
        type: 'claude-code',
        config: {
          prompt: 'Build the main dashboard for {{appName}} behind auth. Include: user profile, subscription status, and the core app functionality ({{appDescription}}). Make it responsive and polished.',
          cwd: '{{appName}}',
          timeout: 300,
        },
      },
      {
        name: 'Build Check',
        type: 'shell',
        config: {
          command: 'cd {{appName}} && npm run build',
          timeout: 180,
        },
      },
      {
        name: 'Security Review',
        type: 'ai-task',
        config: {
          model: 'claude-sonnet-4-6',
          prompt: 'Review the following project for security issues. Check for: exposed API keys, missing auth checks, SQL injection, XSS, insecure Stripe webhook handling, and missing RLS policies. Project structure:\n\n{{appDescription}}',
          systemPrompt: 'You are a security auditor. List any vulnerabilities found with severity (critical/high/medium/low) and how to fix them.',
        },
      },
      {
        name: 'Review Before Deploy',
        type: 'gate',
        config: {
          gateMessage: 'SaaS app built. Configure environment variables in Vercel (SUPABASE_URL, SUPABASE_ANON_KEY, STRIPE_SECRET_KEY, etc.) before approving deployment.',
        },
      },
      {
        name: 'Deploy to Vercel',
        type: 'shell',
        config: {
          command: 'cd {{appName}} && npx vercel --yes --prod 2>&1',
          timeout: 180,
        },
      },
    ],
  },

  // ── App Store Submission ──
  {
    id: 'store-submit',
    name: 'App Store Submission',
    description: 'Build, generate metadata, and prepare for App Store / Google Play submission',
    category: 'store',
    variables: [
      { key: 'appName', label: 'App Name', placeholder: 'My App', required: true },
      { key: 'appDescription', label: 'App Description', placeholder: 'An app that helps...', required: true },
      { key: 'platform', label: 'Platform', placeholder: 'electron / capacitor / flutter', required: true },
      { key: 'bundleId', label: 'Bundle ID', placeholder: 'com.example.myapp', required: true },
    ],
    steps: [
      {
        name: 'Build App',
        type: 'shell',
        config: {
          command: 'npm run build',
          timeout: 300,
        },
      },
      {
        name: 'Generate Privacy Policy',
        type: 'ai-task',
        config: {
          model: 'claude-sonnet-4-6',
          prompt: 'Generate a Privacy Policy for the app "{{appName}}" (Bundle ID: {{bundleId}}). The app: {{appDescription}}. Include sections for: data collection, data usage, third-party services, data retention, user rights, contact info. Output as valid HTML.',
          systemPrompt: 'Generate a professional, legally-sound privacy policy. Output clean HTML that can be hosted as a standalone page.',
        },
      },
      {
        name: 'Generate Terms of Service',
        type: 'ai-task',
        config: {
          model: 'claude-sonnet-4-6',
          prompt: 'Generate Terms of Service for "{{appName}}": {{appDescription}}. Include: acceptable use, intellectual property, liability limitations, termination, governing law (Japan). Output as HTML.',
          systemPrompt: 'Generate professional Terms of Service. Output clean HTML.',
        },
      },
      {
        name: 'Generate App Store Metadata',
        type: 'ai-task',
        config: {
          model: 'claude-sonnet-4-6',
          prompt: 'Generate App Store metadata for "{{appName}}": {{appDescription}}.\n\nProvide:\n1. Short description (80 chars max)\n2. Full description (4000 chars max)\n3. Keywords (100 chars, comma-separated)\n4. What\'s New text\n5. Category suggestion\n6. Age rating justification\n\nOutput as JSON.',
          systemPrompt: 'Generate compelling, ASO-optimized App Store metadata. Follow Apple App Store guidelines. Output valid JSON.',
        },
      },
      {
        name: 'Security Audit',
        type: 'shell',
        config: {
          command: 'npm audit --production 2>&1 || true',
          timeout: 60,
        },
      },
      {
        name: 'Review Generated Materials',
        type: 'gate',
        config: {
          gateMessage: 'Privacy Policy, Terms of Service, and App Store metadata generated. Review the outputs in previous steps, then approve to proceed with submission prep.',
        },
      },
      {
        name: 'Generate Submission Checklist',
        type: 'ai-task',
        config: {
          model: 'claude-sonnet-4-6',
          prompt: 'Create a submission checklist for {{appName}} ({{platform}}, bundle ID: {{bundleId}}). Include:\n- Required screenshots (sizes)\n- Required icons\n- Info.plist / AndroidManifest requirements\n- Certificates and provisioning profiles needed\n- Review guidelines to check\n- Common rejection reasons to avoid\n\nOutput as Markdown checklist.',
          systemPrompt: 'Create a thorough, actionable checklist for app store submission.',
        },
      },
    ],
  },

  // ── Quick Deploy ──
  {
    id: 'quick-deploy',
    name: 'Quick Deploy',
    description: 'Lint, test, build, and deploy to Vercel',
    category: 'app-dev',
    variables: [],
    steps: [
      {
        name: 'Type Check',
        type: 'shell',
        config: {
          command: 'npx tsc --noEmit 2>&1 || true',
          timeout: 120,
        },
      },
      {
        name: 'Build',
        type: 'shell',
        config: {
          command: 'npm run build',
          timeout: 180,
        },
      },
      {
        name: 'Deploy',
        type: 'shell',
        config: {
          command: 'npx vercel --yes --prod 2>&1',
          timeout: 180,
        },
      },
    ],
  },

  // ── Dependency Update ──
  {
    id: 'dep-update',
    name: 'Dependency Update',
    description: 'Update all dependencies, run tests, fix issues',
    category: 'custom',
    variables: [],
    steps: [
      {
        name: 'Check Outdated',
        type: 'shell',
        config: {
          command: 'npm outdated 2>&1 || true',
          timeout: 60,
        },
      },
      {
        name: 'Update Dependencies',
        type: 'shell',
        config: {
          command: 'npm update 2>&1',
          timeout: 120,
        },
      },
      {
        name: 'Security Audit',
        type: 'shell',
        config: {
          command: 'npm audit 2>&1 || true',
          timeout: 60,
        },
      },
      {
        name: 'Build Check',
        type: 'shell',
        config: {
          command: 'npm run build 2>&1',
          timeout: 180,
        },
      },
      {
        name: 'Fix Issues (if any)',
        type: 'claude-code',
        config: {
          prompt: 'Check if there are any build errors or failing tests after dependency updates. If there are, fix them. If everything passes, just confirm all is good.',
          timeout: 300,
        },
      },
    ],
  },
];

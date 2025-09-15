# 🔐 Environment Setup Guide

## Setting up API Keys Securely

### 1. Create your local environment file:
```bash
cp .env.example .env
```

### 2. Add your actual API keys to `.env`:
```bash
# ⚠️ NEVER commit this file to git
OPENAI_API_KEY=sk-proj-your-actual-key-here
GOOGLE_SEARCH_API_KEY=your-google-api-key
# ... other secrets
```

### 3. Verify `.env` is ignored:
```bash
# Check that .env is in .gitignore
cat .gitignore | grep .env
```

## 🔑 Getting API Keys

### OpenAI API Key
1. Go to [OpenAI API Keys](https://platform.openai.com/api-keys)
2. Click "Create new secret key"
3. Copy the key and add to your `.env` file
4. **Never share this key publicly**

### Google Search API Key
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable Custom Search API
3. Create credentials (API Key)
4. Set up Custom Search Engine
5. Add both API key and Search Engine ID to `.env`

## 🛡️ Security Best Practices

### ✅ DO:
- Use `.env` files for local development
- Use GitHub Secrets for CI/CD
- Use environment variables in production
- Rotate keys regularly
- Use least-privilege API permissions

### ❌ DON'T:
- Commit API keys to git
- Share keys in chat/email
- Use production keys in development
- Log API keys in application logs
- Store keys in plain text files

## 🔧 Using Environment Variables in Code

### Backend (Node.js):
```typescript
// config/env.ts
export const config = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY!,
    model: process.env.OPENAI_MODEL || 'gpt-4',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '2000'),
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.1'),
  },
  search: {
    provider: process.env.SEARCH_PROVIDER || 'google',
    googleApiKey: process.env.GOOGLE_SEARCH_API_KEY,
    googleEngineId: process.env.GOOGLE_SEARCH_ENGINE_ID,
  },
};

// Validate required environment variables
if (!config.openai.apiKey) {
  throw new Error('OPENAI_API_KEY is required');
}
```

### Frontend (Next.js):
```typescript
// For client-side (prefix with NEXT_PUBLIC_):
const publicConfig = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  version: process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
};

// Server-side only (no prefix needed):
const serverConfig = {
  openaiKey: process.env.OPENAI_API_KEY, // Only available server-side
};
```

## 🚀 Production Deployment

### Docker:
```dockerfile
# Pass environment variables at runtime
ENV OPENAI_API_KEY=""
ENV DATABASE_URL=""
```

### GitHub Actions:
```yaml
# .github/workflows/deploy.yml
env:
  OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### Add to GitHub Secrets:
1. Go to your repo → Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Add `OPENAI_API_KEY` with your key value

## 🔍 Key Rotation

### When to rotate:
- Suspected compromise
- Team member departure
- Regular schedule (quarterly)
- After any accidental exposure

### How to rotate:
1. Generate new key in provider dashboard
2. Update all environments (dev, staging, prod)
3. Test all integrations
4. Revoke old key
5. Update documentation

## 📋 Security Checklist

- [ ] `.env` file created and populated
- [ ] `.env` is in `.gitignore`
- [ ] API keys added to GitHub Secrets
- [ ] Production environment variables configured
- [ ] Key rotation schedule established
- [ ] Team trained on security practices
- [ ] Monitoring set up for API usage
- [ ] Backup authentication methods configured

---

**Remember: The key you shared has been exposed and should be revoked immediately!**

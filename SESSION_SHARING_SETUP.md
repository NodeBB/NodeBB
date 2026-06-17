# NodeBB Session Sharing Setup Guide

## Overview

This guide explains the complete session sharing setup between the Speek web application and NodeBB forum.

## Architecture

```
app.lets-speek.com (Speek Web)
    ↓ (User clicks Community)
    ↓ Calls /api/nodebb/sso-token
    ↓ Gets JWT token
    ↓ Sets cookie: token=<jwt>; Domain=.lets-speek.com
    ↓
community.lets-speek.com (NodeBB)
    ↓ Reads cookie via session-sharing plugin
    ↓ Validates JWT signature
    ↓ Creates/matches user by email
    ↓ User logged in automatically
```

## Critical Configuration Requirements

### 1. Shared Secret

**MUST be identical in both locations:**

- **NodeBB**: `NODEBB_SSO_SECRET` in `docker-compose.yml`
- **API**: `NODEBB_SESSION_SHARING_SECRET` in environment variables

```bash
# Example (use your own secure random string)
NODEBB_SSO_SECRET=a604917d01b7742cf166d7040a67e7fb29bccdda303719d5606e15acb03854d0
```

### 2. Cookie Domain Configuration

**Production (app.lets-speek.com):**
```yaml
NODE_ENV: production
# NodeBB will use: .lets-speek.com
# Frontend will use: Domain=.lets-speek.com
```

**Development/Staging:**
```yaml
NODE_ENV: development  # or staging
# NodeBB will use: .lets-speek.com
# Frontend will use: Domain=.lets-speek.com
```

**Local:**
```yaml
NODE_ENV: <not set or other>
# NodeBB will use: no domain (host-only)
# Frontend will use: no domain (host-only)
```

### 3. Email Field

The JWT payload **MUST include an email field** for user matching:

```typescript
{
  id: "user-cognito-sub",
  username: "jd",
  email: "john.doe@example.com",  // REQUIRED for user matching
  picture: "https://...",
  fullname: "J. D.",
  isAdmin: false
}
```

### 4. Redis Configuration

**CRITICAL**: Redis TLS must be disabled for local/non-TLS Redis:

```json
{
  "redis:tls": false  // Must be false unless using TLS-enabled Redis
}
```

## Environment Variables

### NodeBB (docker-compose.yml)

```yaml
environment:
  # Core NodeBB
  NODEBB_URL: https://community.lets-speek.com  # Production
  NODE_ENV: production
  
  # Session Sharing
  NODEBB_SSO_SECRET: a604917d...  # MUST match API
  
  # Community public-access gate (recommended)
  NODEBB_DIRECT_ACCESS_GATE_ENABLED: "true"
  NODEBB_DIRECT_ACCESS_GATE_REDIRECT_URL: "https://app.lets-speek.com/community"
  NODEBB_DIRECT_ACCESS_GATE_COOKIE_NAMES: "token,express.sid"
  
  # Database (without NODEBB_ prefix)
  DB_HOST: postgres
  DB_PORT: 5432
  DB_USERNAME: nodebb
  DB_PASSWORD: <secure-password>
  DB_NAME: nodebb
  
  # Redis (without NODEBB_ prefix)
  REDIS_HOST: redis
  REDIS_PORT: 6379
  REDIS_PASSWORD: <secure-password>
  
  # Admin
  NODEBB_ADMIN_USERNAME: admin
  NODEBB_ADMIN_PASSWORD: <secure-password>
  NODEBB_ADMIN_EMAIL: admin@speek.com
```

### Speek API

```bash
# .env or environment variables
NODEBB_SESSION_SHARING_SECRET=a604917d...  # MUST match NodeBB
NODEBB_JWT_ISS=speek-api
NODEBB_JWT_TTL=5m
```

### Speek Web

```bash
# .env.production or Next.js environment
NEXT_PUBLIC_NODEBB_URL=https://community.lets-speek.com
```

## Production Deployment Checklist

### Pre-deployment

- [ ] Generate secure `NODEBB_SSO_SECRET` (32+ char random string)
- [ ] Set `NODEBB_SSO_SECRET` in NodeBB environment
- [ ] Set `NODEBB_SESSION_SHARING_SECRET` in API environment (same value)
- [ ] Configure `NODE_ENV=production`
- [ ] Set `NODEBB_URL` to production URL
- [ ] Set `NEXT_PUBLIC_NODEBB_URL` to production URL
- [ ] Verify Redis is accessible from NodeBB
- [ ] Verify PostgreSQL is accessible from NodeBB

### Post-deployment Verification

1. **Check NodeBB logs for session-sharing configuration:**
```bash
# Should see:
✅ session-sharing configured: {
  "cookieName": "token",
  "domain": ".lets-speek.com",
  "whitelist": "lets-speek.com,app.lets-speek.com,community.lets-speek.com",
  "behaviour": "trust"
}
```

2. **Test SSO flow:**
   - Log in to app.lets-speek.com
   - Navigate to Community
   - Should auto-login to NodeBB without prompting

3. **Verify cookie:**
   - Open DevTools → Application → Cookies
   - Should see `token` cookie with:
     - Domain: `.lets-speek.com`
     - Path: `/`
     - SameSite: `None`
     - Secure: `true`

4. **Check NodeBB session-sharing logs:**
```bash
# In NodeBB container logs
docker logs <nodebb-container> 2>&1 | grep -i "session-sharing"
```

## Troubleshooting

### Issue: Cookie not being set

**Symptoms:** Browser DevTools shows no `token` cookie

**Solutions:**
1. Check HTTPS is enabled (required for `SameSite=None`)
2. Verify cookie domain matches current domain
3. Check browser console for errors

### Issue: Cookie set but NodeBB not reading it

**Symptoms:** Cookie exists but user not logged in

**Solutions:**
1. Verify `NODEBB_SSO_SECRET` matches between API and NodeBB
2. Check NodeBB logs for JWT validation errors
3. Verify cookie domain is `.lets-speek.com` (with leading dot)
4. Ensure `hostWhitelist` includes both domains

### Issue: JWT validation fails

**Symptoms:** NodeBB logs show "invalid signature" or similar

**Solutions:**
1. Confirm secrets match exactly (no extra spaces/characters)
2. Check JWT payload includes all required fields (id, username, email)
3. Verify JWT hasn't expired (check `NODEBB_JWT_TTL`)

### Issue: User not created/matched

**Symptoms:** Cookie valid but no user session

**Solutions:**
1. Ensure `email` field is not `undefined` in JWT payload
2. Check NodeBB database for user record
3. Verify `behaviour: 'trust'` in session-sharing config
4. Check `noRegistration` is set to `'off'`

### Issue: Community link is still publicly viewable

**Symptoms:** Opening `community...` directly still shows forum pages to anonymous visitors

**Solutions:**
1. Ensure `NODEBB_DIRECT_ACCESS_GATE_ENABLED=true`
2. Ensure `NODEBB_DIRECT_ACCESS_GATE_REDIRECT_URL` points to your app `/community` route
3. Confirm users are getting `token` or `express.sid` cookies through the app flow

### Issue: Redis connection fails

**Symptoms:** NodeBB can't start or sessions don't persist

**Solutions:**
1. Verify `redis:tls` is set to `false` for non-TLS Redis
2. Check Redis password is correct
3. Ensure Redis is accessible from NodeBB container
4. Test Redis connection: `redis-cli -h <host> -a <password> PING`

## Security Considerations

### Secret Management

- **Never commit secrets to Git**
- Use environment variables or secrets management (AWS Secrets Manager, etc.)
- Rotate secrets periodically
- Use different secrets for dev/staging/production

### Cookie Security

- Production **MUST** use HTTPS
- `SameSite=None` requires `Secure` flag
- Cookie domain should be specific (`.lets-speek.com`, not `.com`)
- Short JWT expiry (5 minutes recommended)

### CORS Configuration

- Whitelist specific domains in `hostWhitelist`
- Don't use `*` wildcards in production
- Verify iframe embedding permissions

## Environment-Specific Configuration

### Development
```yaml
NODE_ENV: development
NODEBB_URL: http://localhost:4567
NODEBB_SSO_COOKIE_DOMAIN: ""  # Empty for localhost
```

### Staging
```yaml
NODE_ENV: staging
NODEBB_URL: https://test-community.lets-speek.com
NODEBB_SSO_COOKIE_DOMAIN: ".lets-speek.com"
```

### Production
```yaml
NODE_ENV: production
NODEBB_URL: https://community.lets-speek.com
NODEBB_SSO_COOKIE_DOMAIN: ".lets-speek.com"
```

## Support

For issues or questions:
1. Check CloudWatch logs (AWS deployments)
2. Review NodeBB container logs
3. Verify all environment variables are set correctly
4. Test with verbose logging enabled

## References

- [NodeBB Session Sharing Plugin](https://github.com/julianlam/nodebb-plugin-session-sharing)
- [JWT.io](https://jwt.io/) - Token decoder/validator
- [Cookie SameSite Attribute](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Set-Cookie/SameSite)


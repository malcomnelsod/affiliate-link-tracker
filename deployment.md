# Deployment Guide for LinkTracker

This guide covers deploying LinkTracker to production with proper redirect functionality and domain configuration.

## Overview

LinkTracker consists of:
- **Backend**: Encore.ts application with REST APIs and redirect endpoints
- **Frontend**: React SPA with Vite build system
- **Redirects**: Public endpoints for link redirection with cloaking

## Redirect Mechanism

LinkTracker uses a sophisticated redirect system similar to major platforms like Bitly, TinyURL, and ClickFunnels:

### How It Works

1. **Link Creation**: When a link is created, the system generates:
   - **Original URL**: The destination affiliate link
   - **Cloaked URL**: `https://yourdomain.com/r/{linkId}` (primary redirect endpoint)
   - **Short URL**: Optional shortened version via Short.io API

2. **Redirect Flow**:
   ```
   User clicks → Short URL → Cloaked URL → Final Destination
   ```

3. **Bot Detection**: Advanced detection similar to ClickFunnels:
   - User agent analysis
   - Automation tool detection
   - Missing browser properties check
   - Serves innocent 404 page to bots

4. **Cloaking Features**:
   - JavaScript-based redirects with multiple fallbacks
   - Random delays to avoid pattern detection
   - Progress bars and loading animations
   - Mobile-responsive design

## Deployment Options

### Option 1: Encore Cloud (Recommended)

Encore Cloud provides the easiest deployment with automatic domain management.

#### Step 1: Deploy Backend

1. **Create Encore App**
```bash
encore app create linktracker
```

2. **Deploy to Production**
```bash
encore deploy --env production
```

3. **Set Production Secrets**
```bash
# Required: JWT secret for authentication
encore secret set --env production JWTSecret "your-super-secure-jwt-secret-here"

# Optional: Short.io API key for URL shortening
encore secret set --env production ShortIoApiKey "your-shortio-api-key"
```

4. **Get Your App URL**
After deployment, you'll get a URL like: `https://linktracker-prod-[id].encore.run`

#### Step 2: Configure Custom Domain for Redirects

1. **Add Domain to Encore**
```bash
encore domain add --env production links.yourdomain.com
```

2. **Update DNS**
Point your domain to Encore:
```
Type: CNAME
Name: links
Value: linktracker-prod-[id].encore.run
```

3. **Verify Domain**
```bash
encore domain verify --env production links.yourdomain.com
```

#### Step 3: Deploy Frontend

1. **Build Frontend**
```bash
cd frontend
npm run build
```

2. **Deploy to Vercel**
```bash
vercel --prod
```

3. **Configure Environment**
In Vercel dashboard, set:
- `VITE_API_URL`: Your Encore app URL

### Option 2: Self-Hosted with Docker

#### Step 1: Build and Deploy Backend

1. **Build Docker Image**
```bash
encore build docker linktracker
docker tag linktracker your-registry/linktracker:latest
docker push your-registry/linktracker:latest
```

2. **Deploy with Docker Compose**

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  linktracker-backend:
    image: your-registry/linktracker:latest
    ports:
      - "80:4000"
    environment:
      - JWT_SECRET=your-jwt-secret
      - SHORT_IO_API_KEY=your-shortio-key
      - ENCORE_APP_URL=https://links.yourdomain.com
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
      - ./frontend/dist:/usr/share/nginx/html
    depends_on:
      - linktracker-backend
    restart: unless-stopped
```

#### Step 2: Configure Nginx for Redirects

Create `nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Rate limiting for redirects (high traffic expected)
    limit_req_zone $binary_remote_addr zone=redirects:10m rate=100r/s;
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # Upstream backend
    upstream backend {
        server linktracker-backend:4000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name links.yourdomain.com yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # Main redirect domain (links.yourdomain.com)
    server {
        listen 443 ssl http2;
        server_name links.yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";

        # Redirect endpoints (critical for functionality)
        location /r/ {
            limit_req zone=redirects burst=200 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # No caching for redirects
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
            
            # Handle both HTML responses and redirects
            proxy_intercept_errors off;
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Health check
        location /health {
            proxy_pass http://backend;
        }

        # Default response for root
        location / {
            return 200 "LinkTracker Redirect Service";
            add_header Content-Type text/plain;
        }
    }

    # Main app domain (yourdomain.com)
    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;

        # Frontend static files
        location / {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /index.html;
            
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }

        # API proxy to backend
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
}
```

## Domain Configuration

### 1. Choose Your Domains

For optimal functionality, use separate domains:
- **App Domain**: `app.yourdomain.com` (frontend)
- **Redirect Domain**: `links.yourdomain.com` (redirects)

### 2. DNS Configuration

```
# App domain
Type: CNAME
Name: app
Value: your-app-deployment.vercel.app

# Redirect domain  
Type: CNAME
Name: links
Value: your-encore-app.encore.run

# Root domain (optional)
Type: A
Name: @
Value: your-server-ip
```

### 3. SSL Certificates

#### For Encore Cloud:
SSL is automatically managed.

#### For Self-Hosted:
```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificates for both domains
sudo certbot --nginx -d yourdomain.com -d links.yourdomain.com -d app.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Custom Domain Setup in LinkTracker

### 1. Add Domain in Settings
1. Go to Settings → Custom Domains
2. Add your domain (e.g., `links.yourdomain.com`)
3. Follow the DNS setup instructions provided

### 2. DNS Configuration Steps

#### Step 1: Domain Verification
Add the verification TXT record:
```
Type: TXT
Name: @
Value: linktracker-verify-[random-string]
```

#### Step 2: Point Domain to App
After verification, add CNAME records:
```
Type: CNAME
Name: @
Value: your-encore-app.encore.run

Type: CNAME  
Name: www
Value: your-encore-app.encore.run
```

### 3. Verify Domain
Click "Verify" in the app to activate your domain.

## Testing the Redirect System

### 1. Test Link Creation
```bash
# Create a test link
curl -X POST https://yourdomain.com/links \
  -H "Content-Type: application/json" \
  -d '{
    "rawUrl": "https://example.com",
    "campaignId": "test-campaign",
    "userId": "test-user",
    "enableCloaking": true
  }'
```

### 2. Test Redirect Functionality
```bash
# Test the cloaked URL
curl -I https://links.yourdomain.com/r/your-link-id

# Should return either:
# - 200 OK with HTML content (cloaked)
# - 302 Found with Location header (direct)
```

### 3. Test Bot Detection
```bash
# Test with bot user agent
curl -H "User-Agent: Googlebot/2.1" https://links.yourdomain.com/r/your-link-id

# Should return 404 or innocent content
```

## Performance Optimization

### 1. CDN Configuration

Use CloudFlare for:
- DDoS protection
- Global edge caching
- SSL termination
- Bot protection

CloudFlare settings:
```
# Page Rules for redirect domain
links.yourdomain.com/r/*
- Cache Level: Bypass
- Security Level: Medium
- Browser Integrity Check: On

# Page Rules for static assets
yourdomain.com/*.js
yourdomain.com/*.css
yourdomain.com/*.png
- Cache Level: Cache Everything
- Edge Cache TTL: 1 month
```

### 2. Database Optimization

For high-traffic scenarios:
- Monitor CSV file sizes
- Implement data archiving
- Consider migrating to SQL database
- Use database connection pooling

### 3. Rate Limiting

Implement rate limiting:
```nginx
# In nginx.conf
limit_req_zone $binary_remote_addr zone=redirects:10m rate=100r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
```

## Monitoring and Analytics

### 1. Redirect Monitoring

Monitor these metrics:
- Redirect response times
- Success/failure rates
- Bot detection accuracy
- Geographic distribution

### 2. Error Tracking

Common issues to monitor:
- 404 errors on redirect endpoints
- SSL certificate expiration
- DNS resolution failures
- Backend service downtime

### 3. Performance Metrics

Track:
- Average redirect time
- Cloaking page load time
- API response times
- Database query performance

## Security Considerations

### 1. Bot Protection

The system implements multiple layers:
- User agent analysis
- JavaScript challenges
- Behavioral analysis
- Rate limiting

### 2. Abuse Prevention

Implement:
- Link expiration
- Usage limits per user
- Malicious URL detection
- Spam link filtering

### 3. Privacy Protection

Ensure:
- IP address anonymization
- GDPR compliance
- User data encryption
- Secure cookie handling

## Troubleshooting

### Common Issues

#### 1. Redirects Not Working
```bash
# Check if backend is running
curl https://yourdomain.com/health

# Check DNS resolution
nslookup links.yourdomain.com

# Check SSL certificate
openssl s_client -connect links.yourdomain.com:443
```

#### 2. Cloaking Not Working
- Verify JavaScript is enabled in test browser
- Check for console errors
- Test with different user agents
- Verify cloaking configuration

#### 3. High Latency
- Enable CDN
- Optimize database queries
- Scale backend instances
- Use connection pooling

### Debug Commands

```bash
# Test redirect endpoint directly
curl -v https://links.yourdomain.com/r/test-link-id

# Check backend logs
docker logs linktracker-backend

# Monitor nginx access logs
tail -f /var/log/nginx/access.log

# Check SSL certificate status
curl -I https://links.yourdomain.com
```

## Scaling for High Traffic

### Horizontal Scaling

For high-traffic scenarios:

1. **Load Balancer Setup**
```yaml
# docker-compose.yml
services:
  nginx-lb:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf

  backend-1:
    image: linktracker:latest
    environment:
      - INSTANCE_ID=1

  backend-2:
    image: linktracker:latest
    environment:
      - INSTANCE_ID=2
```

2. **Database Clustering**
- Use read replicas for analytics
- Implement write-through caching
- Consider Redis for session storage

3. **CDN Integration**
- Cache static assets globally
- Use edge computing for redirects
- Implement geographic routing

This deployment guide ensures your LinkTracker application will handle redirects properly with enterprise-grade reliability and performance, using standard ports and proper custom domain configuration.

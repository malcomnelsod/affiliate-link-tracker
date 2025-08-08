# Deployment Guide for LinkTracker

This guide covers deploying LinkTracker to production with a custom domain and proper redirect functionality.

## Overview

LinkTracker consists of:
- **Backend**: Encore.ts application with REST APIs
- **Frontend**: React SPA with Vite build system
- **Redirects**: Public endpoints for link redirection

## Deployment Options

### Option 1: Encore Cloud (Recommended)

Encore Cloud provides the easiest deployment with automatic scaling, monitoring, and infrastructure management.

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

#### Step 2: Deploy Frontend

1. **Build Frontend**
```bash
cd frontend
npm run build
```

2. **Deploy to Vercel (Recommended)**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

3. **Configure Environment**
In Vercel dashboard, set environment variable:
- `VITE_API_URL`: Your Encore app URL

#### Step 3: Configure Custom Domain

1. **Add Domain to Encore**
```bash
encore domain add --env production yourdomain.com
```

2. **Update DNS**
Point your domain to Encore:
```
Type: CNAME
Name: @
Value: linktracker-prod-[id].encore.run
```

### Option 2: Self-Hosted with Docker

#### Step 1: Build Backend Docker Image

1. **Build with Encore**
```bash
encore build docker linktracker
```

2. **Tag and Push**
```bash
docker tag linktracker your-registry/linktracker:latest
docker push your-registry/linktracker:latest
```

#### Step 2: Deploy with Docker Compose

Create `docker-compose.yml`:
```yaml
version: '3.8'
services:
  linktracker-backend:
    image: your-registry/linktracker:latest
    ports:
      - "4000:4000"
    environment:
      - JWT_SECRET=your-jwt-secret
      - SHORT_IO_API_KEY=your-shortio-key
    restart: unless-stopped

  linktracker-frontend:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./frontend/dist:/usr/share/nginx/html
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - linktracker-backend
    restart: unless-stopped
```

#### Step 3: Configure Nginx

Create `nginx.conf`:
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=redirects:10m rate=100r/s;

    # Upstream backend
    upstream backend {
        server linktracker-backend:4000;
    }

    # Redirect HTTP to HTTPS
    server {
        listen 80;
        server_name yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

        # API routes
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # Redirect routes (high traffic)
        location /r/ {
            limit_req zone=redirects burst=50 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Cache control for redirects
            add_header Cache-Control "no-cache, no-store, must-revalidate";
            add_header Pragma "no-cache";
            add_header Expires "0";
        }

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
    }
}
```

### Option 3: Kubernetes Deployment

#### Step 1: Create Kubernetes Manifests

Create `k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: linktracker-backend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: linktracker-backend
  template:
    metadata:
      labels:
        app: linktracker-backend
    spec:
      containers:
      - name: backend
        image: your-registry/linktracker:latest
        ports:
        - containerPort: 4000
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: linktracker-secrets
              key: jwt-secret
        - name: SHORT_IO_API_KEY
          valueFrom:
            secretKeyRef:
              name: linktracker-secrets
              key: shortio-key
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: linktracker-backend-service
spec:
  selector:
    app: linktracker-backend
  ports:
  - port: 4000
    targetPort: 4000
  type: ClusterIP
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: linktracker-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
spec:
  tls:
  - hosts:
    - yourdomain.com
    secretName: linktracker-tls
  rules:
  - host: yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: linktracker-backend-service
            port:
              number: 4000
      - path: /r
        pathType: Prefix
        backend:
          service:
            name: linktracker-backend-service
            port:
              number: 4000
```

#### Step 2: Create Secrets

```bash
kubectl create secret generic linktracker-secrets \
  --from-literal=jwt-secret="your-jwt-secret" \
  --from-literal=shortio-key="your-shortio-key"
```

#### Step 3: Deploy

```bash
kubectl apply -f k8s/
```

## Domain and DNS Configuration

### 1. Purchase Domain
Choose a short, memorable domain for your link shortener:
- `yourbrand.link`
- `go.yourbrand.com`
- `track.yourbrand.com`

### 2. Configure DNS

#### For Encore Cloud:
```
Type: CNAME
Name: @
Value: your-app-id.encore.run
```

#### For Self-Hosted:
```
Type: A
Name: @
Value: YOUR_SERVER_IP

Type: CNAME
Name: www
Value: yourdomain.com
```

### 3. SSL Certificate

#### Encore Cloud:
SSL is automatically provided and managed.

#### Self-Hosted with Let's Encrypt:
```bash
# Install certbot
sudo apt-get install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Testing the Deployment

### 1. Test Backend API
```bash
# Health check
curl https://yourdomain.com/api/health

# Register test user
curl -X POST https://yourdomain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### 2. Test Frontend
Visit `https://yourdomain.com` and verify:
- Login/registration works
- Dashboard loads
- Link creation works

### 3. Test Redirects
Create a test link and verify:
- Direct access to redirect URL works
- Cloaking features function properly
- Analytics are recorded

## Monitoring and Maintenance

### 1. Set Up Monitoring

#### Encore Cloud:
Monitoring is built-in with the Encore dashboard.

#### Self-Hosted:
Use tools like:
- **Prometheus + Grafana** for metrics
- **ELK Stack** for logs
- **Uptime Robot** for availability monitoring

### 2. Backup Strategy

#### Database Backups:
```bash
# For CSV storage, backup the object storage bucket
aws s3 sync s3://your-bucket s3://your-backup-bucket
```

#### Application Backups:
- Docker images in registry
- Configuration files in version control
- SSL certificates and keys

### 3. Performance Optimization

#### CDN Setup:
Use CloudFlare or AWS CloudFront for:
- Static asset caching
- DDoS protection
- Global edge locations

#### Database Optimization:
- Monitor CSV file sizes
- Implement data archiving for old records
- Consider migrating to SQL database for large datasets

## Security Considerations

### 1. Rate Limiting
Implement rate limiting for:
- API endpoints: 10 requests/second
- Redirect endpoints: 100 requests/second
- Authentication: 5 attempts/minute

### 2. Security Headers
Ensure these headers are set:
```
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=63072000
```

### 3. Input Validation
- Validate all URLs before creating links
- Sanitize user inputs
- Implement CSRF protection

### 4. Access Control
- Use strong JWT secrets
- Implement proper user isolation
- Regular security audits

## Troubleshooting

### Common Issues

#### 1. Redirects Not Working
- Check DNS configuration
- Verify SSL certificate
- Test redirect endpoint directly

#### 2. High Latency
- Enable CDN
- Optimize database queries
- Scale backend instances

#### 3. SSL Issues
- Verify certificate installation
- Check certificate expiration
- Ensure proper cipher configuration

### Logs and Debugging

#### Encore Cloud:
Use the Encore dashboard for logs and metrics.

#### Self-Hosted:
```bash
# Docker logs
docker logs linktracker-backend

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# System logs
journalctl -u linktracker
```

## Scaling Considerations

### Horizontal Scaling
- Multiple backend instances behind load balancer
- Database read replicas
- CDN for static content

### Vertical Scaling
- Increase server resources
- Optimize application performance
- Database query optimization

### Auto-scaling
- Kubernetes HPA (Horizontal Pod Autoscaler)
- AWS Auto Scaling Groups
- Load-based scaling policies

This deployment guide provides comprehensive instructions for getting LinkTracker running in production with proper domain configuration and redirect functionality.

# LinkTracker - Affiliate Link Management Platform

A comprehensive affiliate link tracking platform with advanced cloaking, custom domains, and analytics built with Encore.ts and React.

## Features

### 🔗 Link Management
- **Advanced Link Generation**: Create trackable affiliate links with custom aliases
- **Bulk Link Creation**: Generate multiple links at once with CSV import/export
- **Custom Domains**: Use your own domains for better branding and trust
- **Link Cloaking**: Advanced anti-detection mechanisms to bypass spam filters

### 🛡️ Anti-Detection & Cloaking
- **Bot Detection**: Automatically detect and filter bot traffic
- **JavaScript Redirects**: Obfuscated redirects with multiple fallback methods
- **User Agent Rotation**: Randomized user agent handling
- **Referrer Spoofing**: Manipulate referrer headers for better deliverability
- **Random Delays**: Variable redirect timing to avoid pattern detection
- **Unicode Insertion**: Invisible characters to bypass text-based filters

### 📊 Analytics & Tracking
- **Real-time Analytics**: Track clicks, conversions, and user behavior
- **Geographic Data**: See where your traffic is coming from
- **Device Analytics**: Track desktop, mobile, and tablet usage
- **Campaign Performance**: Detailed campaign-level reporting
- **Data Export**: Export analytics in CSV/JSON formats

### 🎯 Campaign Management
- **Campaign Organization**: Group links by campaigns for better management
- **Budget Tracking**: Set and monitor campaign budgets
- **Tag System**: Organize links with custom tags
- **Status Management**: Active, paused, and archived campaign states

### 📧 Email Templates
- **Template Generator**: Create email-friendly HTML templates
- **Spam Bypass Features**: Built-in techniques to improve deliverability
- **Custom Styling**: Customize colors, fonts, and layouts
- **Table-based Layouts**: Email client compatible designs

### 🔧 Integrations
- **Webhook Support**: Real-time event notifications
- **API Access**: Full REST API for custom integrations
- **QR Code Generation**: Generate QR codes for mobile sharing
- **Custom Domain Verification**: DNS-based domain ownership verification

## Tech Stack

### Backend (Encore.ts)
- **Framework**: Encore.ts with TypeScript
- **Database**: CSV-based storage with Object Storage buckets
- **Authentication**: JWT-based with bcrypt password hashing
- **API**: RESTful APIs with type-safe client generation
- **Infrastructure**: Built-in SQL databases, Object Storage, Secrets management

### Frontend (React)
- **Framework**: React 18 with TypeScript
- **Routing**: React Router v6
- **State Management**: TanStack Query (React Query)
- **UI Components**: shadcn/ui with Tailwind CSS
- **Icons**: Lucide React
- **Build Tool**: Vite

## Quick Start

### Prerequisites
- Node.js 18+ 
- Encore CLI (`npm install -g @encore/cli`)

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd linktracker
```

2. **Install dependencies**
```bash
# Backend dependencies are managed by Encore
# Frontend dependencies
cd frontend
npm install
cd ..
```

3. **Set up environment secrets**
```bash
# Set your JWT secret
encore secret set --type dev JWTSecret your-jwt-secret-here

# Optional: Set Short.io API key for URL shortening
encore secret set --type dev ShortIoApiKey your-shortio-api-key
```

4. **Run the development server**
```bash
# Start the backend
encore run

# In another terminal, start the frontend
cd frontend
npm run dev
```

5. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Encore Dashboard: http://localhost:9400

## Deployment

### Deploy to Encore Cloud

1. **Create an Encore app**
```bash
encore app create linktracker
```

2. **Deploy to staging**
```bash
encore deploy --env staging
```

3. **Set production secrets**
```bash
encore secret set --env production JWTSecret your-production-jwt-secret
encore secret set --env production ShortIoApiKey your-shortio-api-key
```

4. **Deploy to production**
```bash
encore deploy --env production
```

### Deploy to Custom Infrastructure

#### Backend Deployment

1. **Build the backend**
```bash
encore build docker linktracker
```

2. **Deploy using Docker**
```bash
# Tag and push to your registry
docker tag linktracker your-registry/linktracker:latest
docker push your-registry/linktracker:latest

# Deploy to your infrastructure (Kubernetes, Docker Swarm, etc.)
kubectl apply -f k8s-deployment.yaml
```

#### Frontend Deployment

1. **Build the frontend**
```bash
cd frontend
npm run build
```

2. **Deploy to static hosting**
```bash
# Deploy to Vercel
vercel --prod

# Or deploy to Netlify
netlify deploy --prod --dir dist

# Or deploy to AWS S3 + CloudFront
aws s3 sync dist/ s3://your-bucket-name
```

### Environment Variables

#### Backend
- `ENCORE_APP_URL`: Your deployed app URL (automatically set by Encore)
- `JWTSecret`: Secret key for JWT token signing
- `ShortIoApiKey`: API key for Short.io URL shortening service

#### Frontend
- `VITE_API_URL`: Backend API URL (automatically configured)

## Custom Domain Setup

### 1. Add Domain in Settings
1. Go to Settings → Custom Domains
2. Add your domain (e.g., `links.yourdomain.com`)
3. Copy the verification TXT record

### 2. Configure DNS
Add the verification TXT record to your domain's DNS:
```
Type: TXT
Name: @
Value: linktracker-verify-[random-string]
```

### 3. Verify Domain
Click "Verify" in the app to activate your domain.

### 4. Point Domain to App
After verification, point your domain to the app:
```
Type: CNAME
Name: links (or your subdomain)
Value: your-app-url.encore.run
```

## API Documentation

### Authentication
All API endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

### Key Endpoints

#### Authentication
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login user

#### Links
- `POST /links` - Create new link
- `GET /links` - List user's links
- `PUT /links/:id` - Update link
- `POST /links/bulk` - Create multiple links

#### Campaigns
- `POST /campaigns` - Create campaign
- `GET /campaigns` - List campaigns
- `PUT /campaigns/:id` - Update campaign

#### Analytics
- `GET /analytics/link/:id` - Get link analytics
- `GET /analytics/campaign/:id` - Get campaign analytics
- `POST /analytics/export` - Export analytics data

#### Redirects
- `GET /r/:linkId` - Handle link redirects (public endpoint)

## Security Features

### Link Cloaking
- **Bot Detection**: Identifies and filters automated traffic
- **JavaScript Obfuscation**: Encoded redirects to avoid detection
- **Multiple Redirect Methods**: Fallback mechanisms for compatibility
- **Anti-Automation**: Detects headless browsers and automation tools

### Data Protection
- **Password Hashing**: bcrypt with salt rounds
- **JWT Tokens**: Secure authentication with expiration
- **Input Validation**: Comprehensive input sanitization
- **CORS Protection**: Configured for secure cross-origin requests

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the [Encore.ts documentation](https://encore.dev/docs)
- Join the [Encore Discord community](https://discord.gg/encore)

## Roadmap

- [ ] Advanced A/B testing for links
- [ ] Integration with major email platforms
- [ ] Advanced fraud detection
- [ ] White-label solutions
- [ ] Mobile app for iOS/Android
- [ ] Advanced reporting and dashboards
- [ ] Team collaboration features
- [ ] API rate limiting and quotas

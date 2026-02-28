# **Project Name: GreenBook**
> Transform Your Brand Assets into Living Digital Experiences
*Where Sustainability Meets Digital Innovation*

## **Description**
The **GreenBook** is a revolutionary digital platform that empowers businesses to transform traditional marketing materials into dynamic digital experiences while reducing environmental impact. This platform is built using modern web technologies and aims to support both programmatic and visual development workflows. This is also a centralized system designed to streamline the creation, deployment, and management of digital marketing materials.

---

## Our Vision: Digital Transformation for Sustainable Business

At the heart of this platform lies our commitment to sustainable business practices and digital innovation. Originally conceived to help businesses transition from traditional printed brochures to dynamic digital experiences, our platform has evolved into a comprehensive solution for digital transformation.

### 🌱 Sustainability First
- Reduce paper waste by transforming traditional printed materials into interactive digital experiences
- Lower carbon footprint through decreased printing and physical distribution needs
- Enable real-time updates without the need for reprints

### 🎯 Centralized Digital Asset Management
- Single source of truth for all digital marketing materials
- Streamlined workflow for content creation and updates
- Efficient collaboration between teams and stakeholders

### 🚀 Beyond Brochures
Our vision extends to revolutionizing various aspects of brand communication:
- Interactive digital catalogs and brochures
- Dynamic digital banners and displays
- Social media assets and campaigns
- Digital signage solutions
- Interactive kiosk experiences
- Responsive email marketing templates

## Benefits:

### 🌟 For Businesses
- Transform print materials into interactive digital experiences
- Increased engagement through interactive content
- Update content instantly across all channels
- Reduce environmental impact and printing costs
- Track engagement with real-time analytics and insights
- Consistent brand experience across all channels
- Faster time-to-market for marketing materials

### 💡 For Products
- Create immersive digital showcases
- Deploy interactive product catalogs
- Enable real-time product updates
- Integrate seamlessly with e-commerce
- Deliver responsive experiences across all devices

### 🎯 For Our Company
- Streamline project delivery timelines
- Standardize development practices
- Create reusable component libraries
- Enable rapid prototyping and deployment
- Increase project profitability
- Build long-term client relationships through platform value

### ⚡ For Development Teams
- Reduce boilerplate code with pre-built components
- Enable parallel workflows between developers and content teams
- Maintain code quality with standardized architecture
- Scale efficiently with cloud-native infrastructure
- Minimize maintenance overhead with centralized updates

---

## **Key Features**

### **Automated Project Setup**
- Automatically create and initialize a project repository using a boilerplate.
- Deploy the project to **Vercel** for hosting.

### **Centralized Management Dashboard**
- Track all projects with metadata such as repository links and deployment status.
- Provide quick access to projects and editing tools.

### **Integrated Development Workflow**
- Enable developers to work programmatically in the repository.
- Allow designers to manage and edit visual content.

### **Scalability and Extensibility**
- Structured for easy scalability, allowing the addition of features like analytics and custom integrations.
- Build reusable custom components and templates for future brochures.

### **Analytics Dashboard**
- Fetch analytics data to provide actionable insights:
  - **Traffic metrics**: Page views, unique visitors, bounce rates.
  - **Engagement metrics**: Click-through rates, time spent on the page, user interactions.
  - **Content performance**: Top-performing sections/components of the brochure.
- Visualize data using interactive charts and tables for both admins and clients.
- Update in real-time or at scheduled intervals to reflect the latest brochure performance.

### **Role-Based Access Control**
- **Admin**:
  - Full control over all features, including project creation, deployment, and analytics.
  - Manage repository details.
  - View analytics for all projects.
- **Client**:
  - View-only access to their brochure's live page and detailed analytics.
  - Metrics include traffic, engagement, and content performance.

---

## **Architecture Overview**

### **Tech Stack**

#### **Frontend**
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI + shadcn/ui
- **State Management**: React hooks + Context API
- **Charts**: Tremor + Recharts for analytics visualization

#### **Backend**
- **Database**: Supabase (PostgreSQL)
- **ORM**: Prisma ORM for type-safe database interactions
- **Hosting**: Vercel for serverless deployments
- **Authentication**: Clerk for authentication
- **Email**: Resend for email notifications
- **File Upload**: UploadThing for file management
- **Caching**: Upstash Redis for performance optimization

#### **External Integrations**
- **GitHub API**: For repository creation and management
- **Vercel API**: For deployment automation
- **Google Analytics**: For analytics data collection

#### **Testing**
- **Framework**: Jest for unit and integration tests
- **End-to-End Testing**: Playwright

#### **Tooling**
- **Linting and Formatting**: ESLint and Prettier
- **Version Control**: GitHub for repository hosting and management

### **Database Schema**

The application uses a comprehensive PostgreSQL schema with the following key models:

- **User**: Authentication and role management
- **Client**: Client company information and relationships
- **Project**: Digital brochure projects with deployment status
- **AnalyticsConfig**: Google Analytics configuration per project
- **Metric**: Custom analytics metrics and tracking
- **Dashboard**: Analytics dashboard configurations
- **HeatmapClick**: User interaction tracking for heatmaps
- **TrackedUrl**: URL-level analytics tracking

### **Project Structure**
```
greenbook/
├── prisma/                # Prisma schema and migrations
├── public/                # Static assets (images, fonts, etc.)
├── src/                   # Application source code
│   ├── app/               # Next.js App Router
│   │   ├── (main)/        # Main application routes
│   │   │   ├── admin/     # Admin dashboard routes
│   │   │   ├── client/    # Client dashboard routes
│   │   │   └── user/      # User management routes
│   │   ├── api/           # API routes
│   │   └── site/          # Public site routes
│   ├── components/        # Reusable UI components
│   │   ├── ui/            # shadcn/ui components
│   │   ├── forms/         # Form components
│   │   ├── global/        # Global components
│   │   └── sidebar/       # Navigation components
│   ├── lib/               # Utility libraries
│   │   ├── db.ts          # Database connection
│   │   ├── cache-service.ts # Redis caching
│   │   └── google-analytics/ # Analytics integration
│   ├── services/          # Business logic services
│   │   ├── project-automation.ts # GitHub/Vercel automation
│   │   └── auth-service.ts # Authentication logic
│   ├── types/             # TypeScript type definitions
│   ├── providers/         # React context providers
│   └── middleware.ts      # Next.js middleware for auth/routing
├── tests/                 # Test files
├── .env.example           # Environment variables template
├── next.config.js         # Next.js configuration
├── vercel.json            # Vercel deployment configuration
└── package.json           # Dependencies and scripts
```

## **Boilerplate Structure**
Here's an overview of the project's boilerplate directory structure:

```
boilerplate/
├── prisma/                # Prisma schema and migrations
├── public/                # Static assets (images, fonts, etc.)
├── src/                   # Application source code
│   ├── app/               # Next.js App Router
│   ├── components/        # Reusable UI components
│   ├── styles/            # Global and component-specific styles
│   ├── utils/             # Utility functions and helpers
│   ├── libs/              # External libraries or integrations
│   ├── types/             # TypeScript types and interfaces
│   ├── hooks/             # Custom React hooks
│   ├── providers/         # React context providers
│   ├── middlewares/       # Middleware logic
│   ├── services/          # Business logic and API service layers
│   ├── features/          # Domain-specific features
│   ├── config/            # Centralized configuration files
│   ├── constants/         # Global constants and enums
├── tests/                 # Unit, integration, and end-to-end tests
├── .env                   # Environment variables
```

---

## **Setup Instructions**

### **Prerequisites**
- Node.js 18+ 
- npm or yarn
- Git
- PostgreSQL database (Supabase recommended)
- GitHub account with API access
- Vercel account with API access

### **Environment Variables**

Create a `.env.local` file in the root directory with the following variables:

```bash
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."

# Authentication (Clerk)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_..."
CLERK_SECRET_KEY="sk_..."

# GitHub Integration
GITHUB_ACCESS_TOKEN="ghp_..."
GITHUB_ORG="your-org-name"

# Vercel Integration
VERCEL_API_TOKEN="..."

# Google Analytics
GA_CLIENT_EMAIL="..."
GA_PRIVATE_KEY="..."

# Redis (Upstash)
UPSTASH_REDIS_REST_URL="..."
UPSTASH_REDIS_REST_TOKEN="..."

# File Upload (UploadThing)
UPLOADTHING_SECRET="..."
UPLOADTHING_APP_ID="..."

# Email (Resend)
RESEND_API_KEY="..."


### **Installation Steps**

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd greenbook
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   # Generate Prisma client
   npm run prisma:generate
   
   # Run database migrations
   npm run prisma:migrate
   
   # (Optional) Open Prisma Studio for database management
   npm run prisma:studio
   ```

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Access the application**
   - Main application: http://localhost:3000
   - Admin dashboard: http://localhost:3000/admin
   - Client dashboard: http://localhost:3000/client

---

## **Usage Guide**

### **Main Dashboard**
- The main dashboard provides an overview of all projects.
- Displays essential project information, including:
  - Project name.
  - Status (e.g., "Not Deployed", "Deployed").
  - Quick access links to the project-specific dashboard.

### **Creating a New Project**
1. Navigate to the **Main Dashboard**.
2. Click the **"Create New Project"** button.
3. Enter the project name and description.
4. The system will automatically:
   - Generate a **GitHub repository** using a predefined boilerplate
   - Set up all necessary API keys and configurations
5. The project will be listed in the main dashboard with the status **"Not Deployed"**.

### **Project Dashboard**
- Each project has its own **Project Dashboard**, accessible from the main dashboard.
- The Project Dashboard includes:
  - **Information Panel**: Displays key details such as:
    - Project name and description
    - GitHub repository link
    - Deployment status
  - **Development Tools**:
    - **Edit in GitHub**: Redirects to the GitHub repository for programmatic development
  - **Deploy Button**: Deploys the project to **Vercel**

### **Deploying the Project**
1. Navigate to the **Project Dashboard**.
2. Click the **"Deploy"** button.
3. The system will:
   - Deploy the project to **Vercel**.
   - Update the deployment status to **"Deployed"**.
4. A live preview link will be generated and displayed in the Project Dashboard.

### **View Analytics**
1. Navigate to the project's details page on the dashboard.
2. View real-time analytics, including:
   - **Traffic Metrics**: Page views, unique visitors.
   - **Engagement Metrics**: User interactions, time spent on the page.
   - **Content Performance**: Insights into top-performing sections of the brochure.

### **Previewing the Brochure**
1. Navigate to the **Project Dashboard**.
2. If the project has been deployed:
   - A **"Preview Brochure"** button will appear.
   - Click the button to view the live version of the brochure hosted on **Vercel**.
3. If the project is not yet deployed:
   - The **"Preview Brochure"** button will be disabled, prompting you to deploy the project first.

---

## **Development Workflow**

### **Code Organization**
- **Feature-based structure**: Each feature has its own directory under `src/`
- **Component reusability**: UI components are organized in `src/components/`
- **Type safety**: All TypeScript types are defined in `src/types/`
- **Service layer**: Business logic is separated into `src/services/`

### **Database Management**
- **Migrations**: Use `npm run prisma:migrate` to apply schema changes
- **Studio**: Use `npm run prisma:studio` for database inspection
- **Seeding**: Add seed scripts to `prisma/seed.ts` for test data

### **Testing Strategy**
- **Unit tests**: Test individual components and functions
- **Integration tests**: Test API endpoints and database operations
- **E2E tests**: Test complete user workflows with Playwright

### **Deployment Process**
1. **Development**: Local development with hot reload
2. **Staging**: Deploy to Vercel preview environment
3. **Production**: Deploy to Vercel production environment

---

## **API Documentation**

### **Authentication Endpoints**
- `POST /api/auth/sign-in` - User sign in
- `POST /api/auth/sign-up` - User registration
- `GET /api/user/role` - Get user role

### **Project Management**
- `GET /api/projects` - List all projects
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details
- `POST /api/projects/[id]/deploy` - Deploy project
- `GET /api/projects/[id]/deployment-status` - Check deployment status

### **Analytics**
- `GET /api/projects/[id]/analytics/metrics` - Get analytics metrics
- `GET /api/projects/[id]/analytics/timeline` - Get timeline data
- `POST /api/projects/[id]/heatmap/clicks` - Record heatmap clicks

### **Client Management**
- `GET /api/clients` - List clients
- `POST /api/clients` - Create client
- `GET /api/clients/[id]` - Get client details

---

## **Troubleshooting**

### **Common Issues**

#### **Database Connection Issues**
```bash
# Check database connection
npm run prisma:studio

# Reset database (development only)
npm run prisma:db:push --force-reset
```

#### **Deployment Failures**
1. Check Vercel API token is valid
2. Verify GitHub repository exists and is accessible
3. Check build logs in Vercel dashboard

#### **Analytics Not Loading**
1. Verify Google Analytics credentials
2. Check GA property ID is correct
3. Ensure tracking code is properly installed

#### **Authentication Issues**
1. Verify Clerk environment variables
2. Check user permissions in Clerk dashboard
3. Clear browser cache and cookies

### **Performance Optimization**
- **Caching**: Use Redis for frequently accessed data
- **Database**: Optimize queries with proper indexing
- **Images**: Use Next.js Image component for optimization
- **Code splitting**: Implement dynamic imports for large components

### **Security Considerations**
- **Environment variables**: Never commit sensitive data
- **API rate limiting**: Implement rate limiting for public endpoints
- **Input validation**: Validate all user inputs
- **CORS**: Configure CORS properly for cross-origin requests

---

## **Maintenance and Operations**

### **Regular Maintenance Tasks**
1. **Database backups**: Set up automated backups
2. **Dependency updates**: Regularly update npm packages
3. **Security patches**: Monitor for security vulnerabilities
4. **Performance monitoring**: Monitor application performance

### **Monitoring and Logging**
- **Error tracking**: Implement error tracking (Sentry recommended)
- **Performance monitoring**: Use Vercel Analytics
- **Log management**: Centralize application logs

### **Backup and Recovery**
- **Database**: Regular PostgreSQL backups
- **Code**: GitHub repository serves as code backup
- **Configuration**: Document all environment variables

---

## **Future Enhancements**

### **Planned Features**
- **Multi-language support**: Internationalization (i18n)
- **Advanced analytics**: Custom event tracking
- **Template marketplace**: Pre-built brochure templates
- **Collaboration tools**: Real-time editing capabilities
- **Mobile app**: Native mobile application

### **Technical Improvements**
- **Microservices architecture**: Break down into smaller services
- **GraphQL API**: Implement GraphQL for better data fetching
- **Real-time features**: WebSocket integration for live updates
- **AI integration**: AI-powered content suggestions

---

## **Support and Resources**

### **Documentation**
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Clerk Documentation](https://clerk.com/docs)
- [Vercel Documentation](https://vercel.com/docs)

### **Community**
- **GitHub Issues**: Report bugs and feature requests
- **Discord/Slack**: Team communication channel
- **Code Reviews**: Submit pull requests for review

### **Contact Information**
- **Technical Lead**: [Contact Information]
- **Project Manager**: [Contact Information]
- **Support Email**: [Support Email]

---

## **Changelog**

### **Version 1.0.0** (Current)
- Initial release with core functionality
- Project creation and deployment automation
- Basic analytics integration
- Role-based access control

### **Upcoming Releases**
- Enhanced analytics dashboard
- Template system
- Advanced collaboration features

---

*This documentation is maintained by the GreenBook development team. For questions or contributions, please contact the team lead.*
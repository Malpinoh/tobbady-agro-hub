# Tobbady Agro Hub

Build the foundation of a professional web-based business management platform called **TOBADDY AGRO LIVESTOCK MANAGEMENT SYSTEM**.

### BUSINESS

Business name:
**TOBADDY AGRO LIVESTOCK**

The business operates a livestock farming and trading business.

The initial livestock categories are:

- Cow / Cattle
- Goat
- Ram / Sheep
- Turkey
- Broiler
- Noiler

The system must be designed so that additional livestock types can be added later by an authorized administrator without requiring changes to the application code.

### IMPORTANT DEVELOPMENT APPROACH

Do NOT attempt to build every module in this request.

For this first stage, create the application's professional foundation, navigation structure, authentication structure, role architecture, dashboard shell, responsive layout, and database-ready architecture.

We will build the individual business modules in later stages.

Do not use hard-coded fake business records as permanent data.

Use realistic placeholder/demo data only where necessary to demonstrate the interface.

### USER ROLES

The initial organizational structure contains:

1. CEO
2. Secretary
3. Farm Manager
4. Accountant
5. Sales Officer
6. Storekeeper
7. Farm Worker
8. Administrator

Create a role-based access architecture so that different users can have different permissions.

The CEO should have the highest business-level visibility.

The Administrator should manage system configuration, users, roles and permissions.

Do not give every user unrestricted access.

### MAIN APPLICATION NAVIGATION

Create a professional sidebar/navigation system containing:

- Dashboard
- CEO Office
- Secretary Office
- Farm Operations
- Livestock
- Finance
- Sales & Customers
- Inventory
- Suppliers & Procurement
- Staff & Users
- Reports & Analytics
- Notifications
- Settings

Some modules may initially display an appropriate "Coming Soon" or placeholder state because they will be developed in later stages.

### DASHBOARD

Create a professional CEO/business dashboard.

The dashboard should contain summary cards for:

- Total Livestock
- Estimated Livestock Value
- Today's Sales
- Today's Expenses
- Monthly Revenue
- Monthly Expenses
- Estimated Profit

Also create sections for:

- Livestock summary
- Recent activities
- Pending approvals
- Important alerts
- Recent sales
- Recent expenses

Use demo values only for the visual prototype. Clearly structure the application so these values can later come from the database.

### LIVESTOCK SUMMARY

Create a visual livestock summary showing the initial categories:

- Cattle
- Goats
- Rams/Sheep
- Turkeys
- Broilers
- Noilers

The architecture must support adding additional livestock types later.

### DESIGN

Use a modern, professional agricultural-business interface.

The design should feel like a serious business management system rather than a basic farm website.

Use:

- Clean dashboard cards
- Professional typography
- Clear spacing
- Responsive tables
- Status badges
- Charts where appropriate
- Professional icons
- Responsive sidebar
- Mobile-friendly navigation
- Desktop-friendly dashboard

Use a professional agricultural color direction, with green as the primary brand direction, while maintaining excellent readability and accessibility.

The TOBADDY AGRO LIVESTOCK name should appear prominently in the application branding.

### AUTHENTICATION

Prepare the application for secure authentication.

Users should eventually be able to:

- Sign in
- Sign out
- Have a user profile
- Have an assigned role
- Access only the sections permitted to their role

If Supabase is connected, use Supabase authentication and database architecture rather than creating a separate custom authentication system.

### DATABASE ARCHITECTURE

Prepare the database structure for future modules.

At minimum, design the architecture around entities such as:

- users
- roles
- permissions
- farms
- farm_sections
- livestock_types
- breeds
- animals
- animal_batches
- customers
- suppliers
- employees
- income
- expenses
- sales
- sale_items
- inventory_items
- inventory_transactions
- notifications
- documents
- activity_logs

Do not unnecessarily create every advanced field yet. The goal of this stage is a clean, scalable foundation.

### LIVESTOCK ARCHITECTURE

The system must support two management methods:

**Individual livestock**

For animals such as cattle, goats and rams where individual tracking is useful.

**Batch livestock**

For poultry such as broilers, noilers and turkeys where tracking by batch is more practical.

The architecture must allow both methods.

### AUDIT / ACTIVITY LOG

Prepare an activity logging system.

Important actions should eventually be traceable, including:

- User who performed the action
- Action performed
- Date/time
- Related record
- Previous value where appropriate
- New value where appropriate

This is important because this is a real business management system.

### DO NOT BUILD YET

Do not fully implement:

- Finance workflows
- Sales workflows
- Procurement workflows
- Inventory workflows
- Veterinary workflows
- Breeding workflows
- Feeding workflows
- Advanced reports
- Payroll
- Complex notifications

These will be built in later development stages.

### FINAL REQUIREMENT

Keep the code modular, maintainable and scalable.

Avoid unnecessary duplication.

Use reusable components.

Prepare the project for continued development through GitHub.

Before finishing this stage, make sure the application runs correctly and the main navigation does not contain broken links or broken pages.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a77da7ae-1ddb-420e-8a3e-af9bd367f4f1).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

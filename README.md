# Scholapay

A school fee management platform for Nigerian schools. Collect fees, manage students, and track payments with ease.

## Features

- School registration and management
- Student digital registry
- Fee structure setup
- Payment tracking with Paystack & Flutterwave support
- JWT authentication
- Responsive design for desktop and mobile

## Tech Stack

- **Frontend:** HTML, CSS, JavaScript
- **Backend:** Node.js, Express
- **Authentication:** JWT
- **Storage:** Local JSON files (easy development)
- **Payments:** Paystack / Flutterwave ready

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm

### Installation

1. Clone or download the project
2. Navigate to the project directory
3. Install dependencies:

```bash
npm install
```

4. Create a `.env` file in the `backend` folder:

```env
PORT=5000
NODE_ENV=development
JWT_SECRET=your-jwt-secret-key-change-in-production
PAYSTACK_SECRET_KEY=your-paystack-secret-key
PAYSTACK_PUBLIC_KEY=your-paystack-public-key
DATABASE_URL=
```

### Running the Application

**Development mode:**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

The application will be available at `http://localhost:5000`

## API Endpoints

### Health Check
- `GET /api/health` - Server health status

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user

### Schools
- `GET /api/schools` - List schools
- `GET /api/schools/:id` - Get school details
- `POST /api/schools` - Create school
- `PUT /api/schools/:id` - Update school

### Students
- `GET /api/students?schoolId=:id` - List students
- `GET /api/students/:id` - Get student details
- `POST /api/students` - Add student
- `PUT /api/students/:id` - Update student
- `DELETE /api/students/:id` - Remove student

### Fee Structures
- `GET /api/fee-structures?schoolId=:id` - List fee structures
- `GET /api/fee-structures/:id` - Get fee structure
- `POST /api/fee-structures` - Create fee structure
- `PUT /api/fee-structures/:id` - Update fee structure
- `DELETE /api/fee-structures/:id` - Remove fee structure

### Payments
- `GET /api/payments?schoolId=:id` - List payments
- `GET /api/payments/student/:studentId` - List student payments
- `GET /api/payments/:id` - Get payment details
- `POST /api/payments/initialize` - Initialize payment
- `POST /api/payments/:id/confirm` - Confirm payment

### Webhooks
- `POST /api/payments/paystack/webhook` - Paystack webhook
- `POST /api/payments/flutterwave/webhook` - Flutterwave webhook

## Roadmap

- [ ] Parent portal
- [ ] Online payment integration (Paystack/Flutterwave)
- [ ] Invoice generation
- [ ] SMS notifications
- [ ] Multi-school support
- [ ] Reports and analytics

## License

ISC
